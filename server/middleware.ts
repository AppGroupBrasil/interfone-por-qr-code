import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import db, { type DbUser } from "./db.js";
import { JWT_SECRET } from "./config.js";

const COOKIE_NAME = "session_token";

// ─── ROLES HIERARCHY ─────────────────────────────────────
// master > administradora > sindico > funcionario > morador
export type Role = "master" | "administradora" | "sindico" | "funcionario" | "morador";

const ROLE_LEVEL: Record<Role, number> = {
  master: 100,
  administradora: 80,
  sindico: 60,
  funcionario: 40,
  morador: 20,
};

// ─── EXTEND EXPRESS REQUEST ──────────────────────────────
declare global {
  namespace Express {
    interface Request {
      user?: DbUser;
    }
  }
}

// ─── AUTHENTICATE ────────────────────────────────────────
// Extracts user from JWT cookie OR Authorization Bearer header and attaches to req.user
export function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    // 1) Try Authorization header first (Capacitor / mobile app)
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }
    // 2) Fall back to cookie (web browser)
    if (!token) {
      token = req.cookies?.[COOKIE_NAME];
    }
    if (!token) {
      res.status(401).json({ error: "Não autenticado." });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId?: number; funcId?: number };

    // ─── FUNCIONÁRIO TOKEN ──────────────────────────────────
    if (decoded.funcId) {
      const func = db.prepare("SELECT * FROM funcionarios WHERE id = ?").get(decoded.funcId) as any;
      if (!func) {
        res.clearCookie(COOKIE_NAME);
        res.status(401).json({ error: "Funcionário não encontrado." });
        return;
      }
      // Map funcionário to DbUser-like shape for downstream compatibility
      req.user = {
        id: func.id,
        name: `${func.nome} ${func.sobrenome}`,
        email: func.login,
        phone: null,
        cpf: null,
        password: func.password,
        role: "funcionario",
        perfil: func.cargo,
        unit: null,
        block: null,
        condominio_id: func.condominio_id,
        parent_administradora_id: null,
        avatar_url: null,
        created_at: func.created_at,
        updated_at: func.updated_at,
      } as DbUser;
      next();
      return;
    }

    // ─── REGULAR USER TOKEN ────────────────────────────────
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(decoded.userId) as DbUser | undefined;

    if (!user) {
      res.clearCookie(COOKIE_NAME);
      res.status(401).json({ error: "Usuário não encontrado." });
      return;
    }

    // Block check: if user's condomínio is blocked, deny access (except master)
    if (user.condominio_id && user.role !== "master") {
      const condo = db.prepare("SELECT bloqueado FROM condominios WHERE id = ?")
        .get(user.condominio_id) as { bloqueado: number } | undefined;
      if (condo && condo.bloqueado === 1) {
        res.status(403).json({
          error: "Usuário bloqueado! Entre em contato com seu síndico ou administradora.",
          blocked: true,
        });
        return;
      }
    }

    req.user = user;
    next();
  } catch {
    res.clearCookie(COOKIE_NAME);
    res.status(401).json({ error: "Sessão inválida." });
  }
}

// ─── AUTHORIZE (require specific roles) ──────────────────
// Usage: authorize("master", "administradora", "sindico")
export function authorize(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Não autenticado." });
      return;
    }

    const userRole = req.user.role as Role;
    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({ error: "Sem permissão para esta ação." });
      return;
    }

    next();
  };
}

// ─── PERMISSION HELPERS ──────────────────────────────────

/** Can this user edit/create data? (funcionário and morador cannot edit others' data) */
export function canEdit(user: DbUser): boolean {
  const level = ROLE_LEVEL[user.role as Role] || 0;
  return level >= ROLE_LEVEL.sindico; // sindico, administradora, master
}

/** Can this user delete data? Same as canEdit but morador/funcionário blocked */
export function canDelete(user: DbUser): boolean {
  const level = ROLE_LEVEL[user.role as Role] || 0;
  return level >= ROLE_LEVEL.sindico;
}

/** Only master can delete condominiums */
export function canDeleteCondominio(user: DbUser): boolean {
  return user.role === "master";
}

/** Check if user has at least this role level */
export function hasMinRole(user: DbUser, minRole: Role): boolean {
  const userLevel = ROLE_LEVEL[user.role as Role] || 0;
  return userLevel >= ROLE_LEVEL[minRole];
}

// ─── CONDOMINIO SCOPING ──────────────────────────────────

/**
 * Returns the list of condominio IDs this user can access.
 * - master: null (means ALL)
 * - administradora: all condominios where administradora_id = user.id OR user's parent
 *   (supports sub-users: if parent_administradora_id is set, use it)
 * - sindico/funcionario/morador: [user.condominio_id]
 */
export function getAccessibleCondominioIds(user: DbUser): number[] | null {
  if (user.role === "master") return null; // null = all

  if (user.role === "administradora") {
    // Resolve the "main" administradora ID (either this user or their parent)
    const adminId = user.parent_administradora_id || user.id;
    // Get all user IDs in this administradora group (main + all sub-users)
    const groupIds = db.prepare(
      "SELECT id FROM users WHERE (id = ? OR parent_administradora_id = ?) AND role = 'administradora'"
    ).all(adminId, adminId) as { id: number }[];
    const allIds = groupIds.map((r) => r.id);
    if (allIds.length === 0) allIds.push(adminId);
    const placeholders = allIds.map(() => "?").join(",");
    const rows = db.prepare(
      `SELECT id FROM condominios WHERE administradora_id IN (${placeholders})`
    ).all(...allIds) as { id: number }[];
    return rows.map((r) => r.id);
  }

  // sindico, funcionario, morador → only their own condominio
  return user.condominio_id ? [user.condominio_id] : [];
}

/**
 * Builds a SQL WHERE clause for condominio filtering.
 * Returns { clause: string, params: any[] }
 *   - master: clause = "1=1" (no filter)
 *   - administradora: clause = "condominio_id IN (?,?,...)"
 *   - others: clause = "condominio_id = ?"
 */
export function condominioScope(user: DbUser, columnName = "condominio_id"): { clause: string; params: any[] } {
  if (user.role === "master") {
    return { clause: "1=1", params: [] };
  }

  if (user.role === "administradora") {
    const ids = getAccessibleCondominioIds(user);
    if (!ids || ids.length === 0) {
      return { clause: "1=0", params: [] }; // no access
    }
    const placeholders = ids.map(() => "?").join(",");
    return { clause: `${columnName} IN (${placeholders})`, params: ids };
  }

  // sindico, funcionario, morador
  if (!user.condominio_id) {
    return { clause: "1=0", params: [] };
  }
  return { clause: `${columnName} = ?`, params: [user.condominio_id] };
}

/**
 * For morador: restrict to only their own records
 */
export function moradorSelfScope(user: DbUser): { clause: string; params: any[] } {
  if (user.role === "morador") {
    return { clause: "id = ?", params: [user.id] };
  }
  // Others can see all (within their condominio scope)
  return { clause: "1=1", params: [] };
}
