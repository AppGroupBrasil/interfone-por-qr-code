import { Router } from "express";
import db, { deleteUserCascade, type DbUser, type DbCondominio } from "./db.js";
import { authenticate, authorize, getAccessibleCondominioIds } from "./middleware.js";
import bcrypt from "bcryptjs";
import { emailCondominioBloqueado, emailCondominioDesbloqueado } from "./emailService.js";
import { log } from "./logger.js";

const router = Router();

// All master routes require authentication + master or administradora role
router.use(authenticate);
router.use(authorize("master", "administradora"));

// ─── AUDIT LOG HELPER ────────────────────────────────────
function logAction(userId: number, action: string, entityType: string, entityId: number | null, details: string) {
  db.prepare(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
     VALUES (?, ?, ?, ?, ?)`
  ).run(userId, action, entityType, entityId, details);
}

// ─── ESCOPO DO GERENCIADOR ───────────────────────────────
// A administradora é revendedora: enxerga e opera SOMENTE os condomínios do
// próprio grupo. Nunca os de outra administradora. master = sistema inteiro.
function escopoCondominios(user: DbUser): number[] | null {
  if (user.role === "master") return null;
  return getAccessibleCondominioIds(user) || [];
}

// Cláusula pronta para o WHERE. Sem nenhum condomínio no grupo → 1=0.
function escopoSql(user: DbUser, coluna: string): { clause: string; params: number[] } {
  const ids = escopoCondominios(user);
  if (ids === null) return { clause: "1=1", params: [] };
  if (ids.length === 0) return { clause: "1=0", params: [] };
  return { clause: `${coluna} IN (${ids.map(() => "?").join(",")})`, params: ids };
}

// 404 (e não 403) para condomínio de terceiros: não confirmar que ele existe.
function podeGerirCondominio(user: DbUser, condominioId: number): boolean {
  const ids = escopoCondominios(user);
  return ids === null || ids.includes(condominioId);
}

// Todos os usuários da própria administradora (titular + sub-usuários).
function idsGrupoAdministradora(user: DbUser): number[] {
  const adminId = user.parent_administradora_id || user.id;
  const rows = db
    .prepare(
      "SELECT id FROM users WHERE (id = ? OR parent_administradora_id = ?) AND role = 'administradora'"
    )
    .all(adminId, adminId) as { id: number }[];
  const ids = rows.map((r) => r.id);
  return ids.length > 0 ? ids : [adminId];
}

// ─── ESTATÍSTICAS GERAIS ─────────────────────────────────
router.get("/stats", (req, res) => {
  try {
    const sCondo = escopoSql(req.user!, "id");
    const sUsers = escopoSql(req.user!, "condominio_id");
    const totalCondominios = db
      .prepare(`SELECT COUNT(*) as count FROM condominios WHERE ${sCondo.clause}`)
      .get(...sCondo.params) as { count: number };
    const totalUsers = db
      .prepare(`SELECT COUNT(*) as count FROM users WHERE ${sUsers.clause}`)
      .get(...sUsers.params) as { count: number };
    const totalBlocos = db
      .prepare(`SELECT COUNT(*) as count FROM blocks WHERE ${sUsers.clause}`)
      .get(...sUsers.params) as { count: number };
    const totalFuncionarios = db
      .prepare(`SELECT COUNT(*) as count FROM funcionarios WHERE ${sUsers.clause}`)
      .get(...sUsers.params) as { count: number };

    // Users by role
    const usersByRole = db.prepare(
      `SELECT role, COUNT(*) as count FROM users WHERE ${sUsers.clause} GROUP BY role ORDER BY
       CASE role
         WHEN 'master' THEN 1
         WHEN 'administradora' THEN 2
         WHEN 'sindico' THEN 3
         WHEN 'funcionario' THEN 4
         WHEN 'morador' THEN 5
       END`
    ).all(...sUsers.params) as { role: string; count: number }[];

    // Total moradores (role='morador' in users)
    const totalMoradores = db
      .prepare(`SELECT COUNT(*) as count FROM users WHERE role = 'morador' AND ${sUsers.clause}`)
      .get(...sUsers.params) as { count: number };

    // Recent condominios (last 5)
    const recentCondominios = db
      .prepare(
        `SELECT id, name, cnpj, created_at FROM condominios WHERE ${sCondo.clause} ORDER BY created_at DESC LIMIT 5`
      )
      .all(...sCondo.params);

    // Recent users (last 5)
    const recentUsers = db
      .prepare(
        `SELECT id, name, email, role, created_at FROM users WHERE ${sUsers.clause} ORDER BY created_at DESC LIMIT 5`
      )
      .all(...sUsers.params);

    res.json({
      totals: {
        condominios: totalCondominios.count,
        users: totalUsers.count,
        blocos: totalBlocos.count,
        funcionarios: totalFuncionarios.count,
        moradores: totalMoradores.count,
      },
      usersByRole,
      recentCondominios,
      recentUsers,
    });
  } catch (err) {
    log.error("Erro ao buscar estatísticas:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// ─── PAINEL ADMINISTRATIVO DE CONDOMÍNIOS ────────────────

// GET /api/master/condominios-dashboard - Dashboard completo com métricas
router.get("/condominios-dashboard", (req, res) => {
  try {
    const { search, status_pagamento, bloqueado, sort = "created_at", order = "desc" } = req.query;

    const escopo = escopoSql(req.user!, "c.id");
    let where = escopo.clause;
    const params: any[] = [...escopo.params];

    if (search) {
      where += " AND (c.name LIKE ? OR c.cnpj LIKE ? OR c.city LIKE ?)";
      const term = `%${search}%`;
      const docDigits = String(search).replace(/D/g, "");
      params.push(term, docDigits ? `%${docDigits}%` : term, term);
    }

    if (status_pagamento && status_pagamento !== "todos") {
      where += " AND c.status_pagamento = ?";
      params.push(status_pagamento);
    }

    if (bloqueado === "true") {
      where += " AND c.bloqueado = 1";
    } else if (bloqueado === "false") {
      where += " AND c.bloqueado = 0";
    }

    // Validate sort column
    const allowedSorts: Record<string, string> = {
      created_at: "c.created_at",
      name: "c.name",
      last_access_at: "c.last_access_at",
      access_count: "c.access_count",
      dias_cadastro: "c.created_at",
      total_users: "total_users",
    };
    const sortCol = allowedSorts[sort as string] || "c.created_at";
    const sortDir = (order as string).toUpperCase() === "ASC" ? "ASC" : "DESC";

    const condominios = db.prepare(`
      SELECT 
        c.id, c.name, c.cnpj, c.address, c.city, c.state,
        c.units_count, c.created_at, c.updated_at,
        c.status_pagamento, c.bloqueado, c.bloqueado_at, c.bloqueado_motivo,
        c.last_access_at, c.access_count,
        c.admin_user_id,
        (SELECT COUNT(*) FROM users WHERE condominio_id = c.id) as total_users,
        (SELECT COUNT(*) FROM users WHERE condominio_id = c.id AND role = 'morador') as total_moradores,
        (SELECT COUNT(*) FROM users WHERE condominio_id = c.id AND role = 'sindico') as total_sindicos,
        (SELECT COUNT(*) FROM users WHERE condominio_id = c.id AND role = 'funcionario') as total_funcionarios,
        (SELECT COUNT(*) FROM blocks WHERE condominio_id = c.id) as total_blocos,
        (SELECT name FROM users WHERE id = c.admin_user_id) as admin_name,
        (SELECT email FROM users WHERE id = c.admin_user_id) as admin_email,
        CAST(julianday('now') - julianday(c.created_at) AS INTEGER) as dias_cadastro
      FROM condominios c
      WHERE ${where}
      ORDER BY ${sortCol} ${sortDir}
    `).all(...params) as any[];

    // Summary stats
    const totalCondominios = condominios.length;
    const adimplentes = condominios.filter(c => c.status_pagamento === "adimplente").length;
    const inadimplentes = condominios.filter(c => c.status_pagamento === "inadimplente").length;
    const bloqueados = condominios.filter(c => c.bloqueado === 1).length;
    const ativos30d = condominios.filter(c => {
      if (!c.last_access_at) return false;
      const diff = Date.now() - new Date(c.last_access_at).getTime();
      return diff < 30 * 24 * 60 * 60 * 1000;
    }).length;
    const semAcesso = condominios.filter(c => !c.last_access_at || c.access_count === 0).length;

    res.json({
      condominios,
      summary: {
        total: totalCondominios,
        adimplentes,
        inadimplentes,
        bloqueados,
        ativos30d,
        semAcesso,
      },
    });
  } catch (err) {
    log.error("Erro ao buscar dashboard de condomínios:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// PUT /api/master/condominios/:id/status-pagamento - Atualizar status de pagamento
router.put("/condominios/:id/status-pagamento", (req, res) => {
  try {
    const { id } = req.params;
    const { status_pagamento } = req.body;

    if (!["adimplente", "inadimplente"].includes(status_pagamento)) {
      res.status(400).json({ error: "Status inválido. Use 'adimplente' ou 'inadimplente'." });
      return;
    }

    const condo = db.prepare("SELECT id, name FROM condominios WHERE id = ?").get(parseInt(id)) as any;
    if (!condo || !podeGerirCondominio(req.user!, parseInt(id))) {
      res.status(404).json({ error: "Condomínio não encontrado." });
      return;
    }

    db.prepare("UPDATE condominios SET status_pagamento = ?, updated_at = datetime('now') WHERE id = ?")
      .run(status_pagamento, parseInt(id));

    logAction(req.user!.id, "UPDATE_BILLING", "condominio", parseInt(id),
      `Alterou status de pagamento de "${condo.name}" para ${status_pagamento}`);

    res.json({ success: true, message: `Status alterado para ${status_pagamento}.` });
  } catch (err) {
    log.error("Erro ao atualizar status de pagamento:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// PUT /api/master/condominios/:id/bloquear - Bloquear/Desbloquear condomínio
router.put("/condominios/:id/bloquear", (req, res) => {
  try {
    const { id } = req.params;
    const { bloqueado, motivo } = req.body;

    const condo = db.prepare("SELECT id, name, bloqueado FROM condominios WHERE id = ?").get(parseInt(id)) as any;
    if (!condo || !podeGerirCondominio(req.user!, parseInt(id))) {
      res.status(404).json({ error: "Condomínio não encontrado." });
      return;
    }

    if (bloqueado) {
      db.prepare(`
        UPDATE condominios 
        SET bloqueado = 1, bloqueado_at = datetime('now'), bloqueado_motivo = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(motivo || "Inadimplência", parseInt(id));

      logAction(req.user!.id, "BLOCK_CONDOMINIO", "condominio", parseInt(id),
        `Bloqueou condomínio "${condo.name}". Motivo: ${motivo || "Inadimplência"}`);

      // 📧 Email: notify síndico about block
      emailCondominioBloqueado({
        condominioId: parseInt(id),
        condominioNome: condo.name,
        motivo: motivo || "Inadimplência",
      }).catch((err) => log.error("[EMAIL] Erro condomínio bloqueado:", err));
    } else {
      db.prepare(`
        UPDATE condominios 
        SET bloqueado = 0, bloqueado_at = NULL, bloqueado_motivo = NULL, updated_at = datetime('now')
        WHERE id = ?
      `).run(parseInt(id));

      logAction(req.user!.id, "UNBLOCK_CONDOMINIO", "condominio", parseInt(id),
        `Desbloqueou condomínio "${condo.name}"`);

      // 📧 Email: notify síndico about unblock
      emailCondominioDesbloqueado({
        condominioId: parseInt(id),
        condominioNome: condo.name,
      }).catch((err) => log.error("[EMAIL] Erro condomínio desbloqueado:", err));
    }

    res.json({
      success: true,
      message: bloqueado ? `Condomínio "${condo.name}" bloqueado.` : `Condomínio "${condo.name}" desbloqueado.`,
    });
  } catch (err) {
    log.error("Erro ao bloquear/desbloquear condomínio:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// ─── GESTÃO GLOBAL DE USUÁRIOS ───────────────────────────

// GET /api/master/users - Listar todos os usuários do sistema
router.get("/users", (req, res) => {
  try {
    const { role, search, page = "1", limit = "20" } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let where = "1=1";
    const params: any[] = [];

    // Non-master users cannot see master users
    if (req.user!.role !== "master") {
      where += " AND u.role != 'master'";
    }

    // Administradora users cannot see other administradoras and are scoped to their condominios
    if (req.user!.role === "administradora") {
      where += " AND u.role != 'administradora'";
      // Scope to their condominios
      const adminId = req.user!.parent_administradora_id || req.user!.id;
      const groupIds = db.prepare(
        "SELECT id FROM users WHERE (id = ? OR parent_administradora_id = ?) AND role = 'administradora'"
      ).all(adminId, adminId) as { id: number }[];
      const allAdminIds = groupIds.map(r => r.id);
      if (allAdminIds.length === 0) allAdminIds.push(adminId);
      const ph = allAdminIds.map(() => "?").join(",");
      const condoIds = db.prepare(
        `SELECT id FROM condominios WHERE administradora_id IN (${ph})`
      ).all(...allAdminIds) as { id: number }[];
      if (condoIds.length > 0) {
        const condoPlaceholders = condoIds.map(() => "?").join(",");
        where += ` AND u.condominio_id IN (${condoPlaceholders})`;
        params.push(...condoIds.map(c => c.id));
      } else {
        where += " AND 1=0"; // No condominios = no users visible
      }
    }

    if (role && role !== "all") {
      where += " AND u.role = ?";
      params.push(role);
    }

    if (search) {
      where += " AND (u.name LIKE ? OR u.email LIKE ? OR u.cpf LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const total = db.prepare(
      `SELECT COUNT(*) as count FROM users u WHERE ${where}`
    ).get(...params) as { count: number };

    const users = db.prepare(
      `SELECT u.id, u.name, u.email, u.phone, u.cpf, u.role, u.perfil, u.unit, u.block,
              u.condominio_id, u.parent_administradora_id, u.created_at, u.updated_at,
              c.name as condominio_nome,
              pa.name as parent_administradora_nome
       FROM users u
       LEFT JOIN condominios c ON u.condominio_id = c.id
       LEFT JOIN users pa ON u.parent_administradora_id = pa.id
       WHERE ${where}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`
    ).all(...params, parseInt(limit as string), offset);

    res.json({ users, total: total.count, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (err) {
    log.error("Erro ao listar usuários:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// PUT /api/master/users/:id - Editar qualquer usuário
router.put("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as DbUser | undefined;
    if (!user) {
      res.status(404).json({ error: "Usuário não encontrado." });
      return;
    }

    const { name, email, phone, cpf, role, unit, block, condominio_id, password } = req.body;

    // Non-master users cannot edit master users
    if (req.user!.role !== "master" && user.role === "master") {
      res.status(403).json({ error: "Sem permissão para editar usuários Master." });
      return;
    }

    // Non-master users cannot assign the master role
    if (req.user!.role !== "master" && role === "master") {
      res.status(403).json({ error: "Sem permissão para atribuir o cargo Master." });
      return;
    }

    // Administradora cannot edit/assign other administradoras
    if (req.user!.role === "administradora" && (user.role === "administradora" || role === "administradora")) {
      res.status(403).json({ error: "Sem permissão para editar/atribuir o cargo Administradora." });
      return;
    }

    // O usuário precisa morar num condomínio do grupo — e não pode ser movido
    // para fora dele. Sem isto uma administradora editaria (e trocaria a senha
    // de) síndicos e moradores de condomínios de outra administradora.
    if (!podeGerirCondominio(req.user!, user.condominio_id ?? 0)) {
      res.status(404).json({ error: "Usuário não encontrado." });
      return;
    }
    if (
      condominio_id !== undefined &&
      condominio_id !== null &&
      !podeGerirCondominio(req.user!, parseInt(String(condominio_id)))
    ) {
      res.status(403).json({ error: "Condomínio de destino fora do seu escopo." });
      return;
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (name) { updates.push("name = ?"); params.push(name.trim()); }
    if (email) { updates.push("email = ?"); params.push(email.trim().toLowerCase()); }
    if (phone !== undefined) { updates.push("phone = ?"); params.push(phone?.trim() || null); }
    if (cpf !== undefined) { updates.push("cpf = ?"); params.push(cpf?.trim() || null); }
    if (role) { updates.push("role = ?"); params.push(role); }
    if (unit !== undefined) { updates.push("unit = ?"); params.push(unit?.trim() || null); }
    if (block !== undefined) { updates.push("block = ?"); params.push(block?.trim() || null); }
    if (condominio_id !== undefined) { updates.push("condominio_id = ?"); params.push(condominio_id || null); }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      updates.push("password = ?");
      params.push(hash);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: "Nenhum campo para atualizar." });
      return;
    }

    updates.push("updated_at = datetime('now')");
    params.push(userId);

    db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...params);

    logAction(req.user!.id, "EDIT_USER", "user", userId, `Editou usuário "${user.name}" (${user.email})`);

    res.json({ success: true, message: "Usuário atualizado." });
  } catch (err: any) {
    if (err.message?.includes("UNIQUE constraint")) {
      res.status(409).json({ error: "Email já cadastrado." });
      return;
    }
    log.error("Erro ao editar usuário:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// DELETE /api/master/users/:id - Excluir qualquer usuário
router.delete("/users/:id", (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);

    if (userId === req.user!.id) {
      res.status(400).json({ error: "Você não pode excluir seu próprio usuário." });
      return;
    }

    const user = db.prepare("SELECT id, name, email, role FROM users WHERE id = ?").get(userId) as DbUser | undefined;
    if (!user) {
      res.status(404).json({ error: "Usuário não encontrado." });
      return;
    }

    // Non-master users cannot delete master users
    if (req.user!.role !== "master" && user.role === "master") {
      res.status(403).json({ error: "Sem permissão para excluir usuários Master." });
      return;
    }

    // Administradora cannot delete other administradoras
    if (req.user!.role === "administradora" && user.role === "administradora") {
      res.status(403).json({ error: "Sem permissão para excluir Administradoras." });
      return;
    }

    // Excluir só dentro dos próprios condomínios.
    if (!podeGerirCondominio(req.user!, user.condominio_id ?? 0)) {
      res.status(404).json({ error: "Usuário não encontrado." });
      return;
    }

    deleteUserCascade(userId);

    logAction(req.user!.id, "DELETE_USER", "user", userId, `Excluiu usuário "${user.name}" (${user.email}) role=${user.role}`);

    res.json({ success: true, message: `Usuário "${user.name}" excluído.` });
  } catch (err) {
    log.error("Erro ao excluir usuário:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// ─── CONFIGURAÇÕES DO SISTEMA ────────────────────────────

// GET /api/master/config - Obter todas as configs (master only)
router.get("/config", (req, res) => {
  if (req.user!.role !== "master") { res.status(403).json({ error: "Acesso restrito ao master." }); return; }
  try {
    const configs = db.prepare("SELECT * FROM system_config ORDER BY key ASC").all();
    res.json(configs);
  } catch (err) {
    log.error("Erro ao buscar configurações:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// PUT /api/master/config - Salvar configs (bulk upsert, master only)
router.put("/config", (req, res) => {
  if (req.user!.role !== "master") { res.status(403).json({ error: "Acesso restrito ao master." }); return; }
  try {
    const { configs } = req.body;
    if (!configs || !Array.isArray(configs)) {
      res.status(400).json({ error: "Envie { configs: [{key, value}] }." });
      return;
    }

    const stmt = db.prepare(
      `INSERT INTO system_config (key, value, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    );

    const transaction = db.transaction(() => {
      for (const { key, value } of configs) {
        stmt.run(key, value);
      }
    });

    transaction();

    logAction(req.user!.id, "UPDATE_CONFIG", "system", null, `Atualizou ${configs.length} configuração(ões)`);

    res.json({ success: true, message: "Configurações salvas." });
  } catch (err) {
    log.error("Erro ao salvar configurações:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// ─── LOGS DE AUDITORIA ───────────────────────────────────

// GET /api/master/logs - Listar logs de auditoria
router.get("/logs", (req, res) => {
  try {
    const { action, entity_type, page = "1", limit = "50" } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let where = "1=1";
    const params: any[] = [];

    // Auditoria da administradora: só as ações dela mesma e de quem está nos
    // seus condomínios. O histórico do master e o de outras administradoras
    // não aparecem.
    if (req.user!.role !== "master") {
      const grupo = idsGrupoAdministradora(req.user!);
      const gph = grupo.map(() => "?").join(",");
      const cIds = escopoCondominios(req.user!) || [];
      if (cIds.length > 0) {
        const cph = cIds.map(() => "?").join(",");
        where += ` AND (a.user_id IN (${gph}) OR a.user_id IN (SELECT id FROM users WHERE condominio_id IN (${cph})))`;
        params.push(...grupo, ...cIds);
      } else {
        where += ` AND a.user_id IN (${gph})`;
        params.push(...grupo);
      }
    }

    if (action) {
      where += " AND a.action = ?";
      params.push(action);
    }

    if (entity_type) {
      where += " AND a.entity_type = ?";
      params.push(entity_type);
    }

    const total = db.prepare(
      `SELECT COUNT(*) as count FROM audit_logs a WHERE ${where}`
    ).get(...params) as { count: number };

    const logs = db.prepare(
      `SELECT a.*, u.name as user_name, u.email as user_email
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE ${where}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`
    ).all(...params, parseInt(limit as string), offset);

    res.json({ logs, total: total.count, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (err) {
    log.error("Erro ao buscar logs:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

export default router;
