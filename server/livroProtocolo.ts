import { Router, Request, Response } from "express";
import db from "./db.js";
import { authenticate } from "./middleware.js";
import { notifyPortariaWhatsApp } from "./whatsappService.js";
import { log } from "./logger.js";

const router = Router();

// ─── Helper: generate protocol number ────────────────────
function generateProtocolo(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  // Use MAX to find the last sequence number to avoid race condition
  const last = db
    .prepare("SELECT MAX(CAST(SUBSTR(protocolo, -4) AS INTEGER)) as maxSeq FROM livro_protocolo WHERE protocolo LIKE ?")
    .get(`LP-${date}-%`) as { maxSeq: number | null };
  const seq = String((last?.maxSeq || 0) + 1).padStart(4, "0");
  return `LP-${date}-${seq}`;
}

// ─── GET all entries ─────────────────────────────────────
router.get("/", authenticate, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { tipo } = req.query;

    let query = "SELECT * FROM livro_protocolo WHERE condominio_id = ?";
    const params: any[] = [user.condominio_id];

    if (tipo && tipo !== "todas") {
      query += " AND tipo = ?";
      params.push(tipo);
    }

    query += " ORDER BY created_at DESC";
    const results = db.prepare(query).all(...params);
    res.json(results);
  } catch (err: any) {
    log.error("Erro em livroProtocolo :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── CREATE entry (porteiro/sindico+) ────────────────────
router.post("/", authenticate, (req: Request, res: Response) => {
  try {
    const user = req.user!;

    if (user.role === "morador") {
      res.status(403).json({ error: "Sem permissao." });
      return;
    }

    const {
      tipo,
      deixada_por,
      para,
      o_que_e,
      entregue_para,
      retirada_por,
      foto,
      assinatura,
      titulo,
      descricao,
      audio,
    } = req.body;

    if (!tipo) {
      res.status(400).json({ error: "Tipo e obrigatorio." });
      return;
    }

    // Porteiro name always comes from the logged-in user
    const porteiroNome = (user as any).name || "Porteiro";

    const protocolo = generateProtocolo();

    const result = db.prepare(`
      INSERT INTO livro_protocolo
        (condominio_id, protocolo, tipo, deixada_por, para, o_que_e,
         entregue_para, porteiro_entregou, retirada_por, porteiro,
         foto, assinatura, titulo, descricao, audio, registrado_por)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.condominio_id,
      protocolo,
      tipo,
      deixada_por || null,
      para || null,
      o_que_e || null,
      entregue_para || null,
      tipo === "entrega" ? porteiroNome : null,
      retirada_por || null,
      tipo === "retirada" || tipo === "ocorrencia" ? porteiroNome : null,
      foto || null,
      assinatura || null,
      titulo || null,
      descricao || null,
      audio || null,
      user.id
    );

    // WhatsApp: notify portaria about new protocol entry
    notifyPortariaWhatsApp(
      user.condominio_id!,
      "whatsapp_notify_livro_protocolo",
      `📖 Livro Protocolo #${protocolo}: ${tipo}${titulo ? " — " + titulo : ""}${o_que_e ? " — " + o_que_e : ""}${para ? " para " + para : ""}${deixada_por ? " (deixado por " + deixada_por + ")" : ""}`
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      protocolo,
      message: "Registro criado com sucesso.",
    });
  } catch (err: any) {
    log.error("Erro em livroProtocolo :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── GET single entry ────────────────────────────────────
router.get("/:id", authenticate, (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido." });
      return;
    }
    const user = req.user!;
    const entry = db.prepare("SELECT * FROM livro_protocolo WHERE id = ? AND condominio_id = ?").get(id, user.condominio_id);
    if (!entry) {
      res.status(404).json({ error: "Registro não encontrado." });
      return;
    }
    res.json(entry);
  } catch (err: any) {
    log.error("Erro ao buscar registro:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// ─── DELETE entry (porteiro/sindico+) ────────────────────
router.delete("/:id", authenticate, (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido." });
      return;
    }
    const user = req.user!;

    if (user.role === "morador") {
      res.status(403).json({ error: "Sem permissão." });
      return;
    }

    // Verify the record belongs to the user's condominium
    const entry = db.prepare("SELECT id FROM livro_protocolo WHERE id = ? AND condominio_id = ?").get(id, user.condominio_id) as any;
    if (!entry) {
      res.status(404).json({ error: "Registro não encontrado." });
      return;
    }

    db.prepare("DELETE FROM livro_protocolo WHERE id = ? AND condominio_id = ?").run(id, user.condominio_id);
    res.json({ message: "Registro removido." });
  } catch (err: any) {
    log.error("Erro ao excluir registro:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// ─── PUBLIC: Get photo by protocol ───────────────────────
router.get("/foto/:protocolo", (req: Request, res: Response) => {
  try {
    const protocolo = String(req.params.protocolo);
    const entry = db.prepare("SELECT foto FROM livro_protocolo WHERE protocolo = ?").get(protocolo) as { foto: string | null } | undefined;

    if (!entry || !entry.foto) {
      res.status(404).json({ error: "Foto nao encontrada." });
      return;
    }

    const matches = entry.foto.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      res.status(400).json({ error: "Formato invalido." });
      return;
    }

    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], "base64");
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (err: any) {
    log.error("Erro em livroProtocolo :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

export default router;
