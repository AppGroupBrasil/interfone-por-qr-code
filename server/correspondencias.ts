import { Router, Request, Response } from "express";
import crypto from "crypto";
import db from "./db.js";
import { authenticate } from "./middleware.js";
import { emailCorrespondenciaChegou } from "./emailService.js";
import { JWT_SECRET } from "./config.js";
import { log } from "./logger.js";

const router = Router();

// HMAC do protocolo para impedir enumeração da rota pública /foto.
function signProtocolo(protocolo: string): string {
  return crypto.createHmac("sha256", JWT_SECRET).update(protocolo).digest("base64url").slice(0, 16);
}
function verifyProtocolo(protocolo: string, sig: string | undefined): boolean {
  if (!sig || typeof sig !== "string") return false;
  const expected = signProtocolo(protocolo);
  if (expected.length !== sig.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

// Helper exportado para o front-end (via JSON response) e para outros routers.
export function buildFotoToken(protocolo: string): string {
  return signProtocolo(protocolo);
}

// ─── Helper: generate protocol number ────────────────────
function generateProtocolo(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  // Use MAX to find the last sequence number to avoid race condition
  const last = db
    .prepare("SELECT MAX(CAST(SUBSTR(protocolo, -4) AS INTEGER)) as maxSeq FROM correspondencias WHERE protocolo LIKE ?")
    .get(`CORR-${date}-%`) as { maxSeq: number | null };
  const seq = String((last?.maxSeq || 0) + 1).padStart(4, "0");
  return `CORR-${date}-${seq}`;
}

// ─── GET all correspondencias ────────────────────────────
// Morador sees own, porteiro/sindico+ sees all for condominio
router.get("/", authenticate, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const condominioId = user.condominio_id;
    const { status } = req.query;

    let query: string;
    const params: any[] = [];

    if (user.role === "morador") {
      query = "SELECT * FROM correspondencias WHERE morador_id = ?";
      params.push(user.id);
    } else {
      query = "SELECT * FROM correspondencias WHERE condominio_id = ?";
      params.push(condominioId);
    }

    if (status && status !== "todas") {
      query += " AND status = ?";
      params.push(status);
    }

    query += " ORDER BY created_at DESC";

    const results = db.prepare(query).all(...params) as Array<{ protocolo: string; [k: string]: unknown }>;
    // Anexa foto_token para que o front possa montar o link público.
    res.json(results.map(r => ({ ...r, foto_token: signProtocolo(r.protocolo) })));
  } catch (err: any) {
    log.error("Erro em correspondencias :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── CREATE correspondencia (porteiro/sindico+) ──────────
router.post("/", authenticate, (req: Request, res: Response) => {
  try {
    const user = req.user!;

    if (user.role === "morador") {
      res.status(403).json({ error: "Sem permissão." });
      return;
    }

    const {
      morador_id,
      morador_name,
      bloco,
      apartamento,
      tipo,
      remetente,
      descricao,
      foto,
    } = req.body;

    if (!morador_name || !bloco || !apartamento) {
      res.status(400).json({ error: "Morador, bloco e apartamento são obrigatórios." });
      return;
    }

    const protocolo = generateProtocolo();

    const result = db.prepare(`
      INSERT INTO correspondencias
        (condominio_id, protocolo, morador_id, morador_name, bloco, apartamento,
         tipo, remetente, descricao, foto, status, registrado_por)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?)
    `).run(
      user.condominio_id,
      protocolo,
      morador_id || null,
      morador_name,
      bloco,
      apartamento,
      tipo || "encomenda",
      remetente || null,
      descricao || null,
      foto || null,
      user.id
    );

    // 📧 Email: notify morador about new package
    if (user.condominio_id) {
      emailCorrespondenciaChegou({
        condominioId: user.condominio_id,
        moradorId: morador_id || undefined,
        moradorName: morador_name,
        bloco,
        apartamento,
        protocolo,
        tipo: tipo || "encomenda",
        remetente: remetente || undefined,
        descricao: descricao || undefined,
      }).catch((err) => log.error("[EMAIL] Erro correspondência:", err));
    }

    res.status(201).json({
      id: result.lastInsertRowid,
      protocolo,
      foto_token: signProtocolo(protocolo),
      message: "Correspondência registrada com sucesso.",
    });
  } catch (err: any) {
    log.error("Erro em correspondencias :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── MARK as retirada (picked up) ───────────────────────
router.put("/:id/retirar", authenticate, (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const user = req.user!;

    const corr = db.prepare("SELECT * FROM correspondencias WHERE id = ?").get(id) as any;
    if (!corr) {
      res.status(404).json({ error: "Correspondência não encontrada." });
      return;
    }

    // Only the morador or a porteiro/sindico+ from the SAME condominium can mark as picked up
    if (user.role === "morador" && corr.morador_id !== user.id) {
      res.status(403).json({ error: "Sem permissão." });
      return;
    }
    if (user.role !== "morador" && corr.condominio_id !== user.condominio_id) {
      res.status(403).json({ error: "Sem permissão." });
      return;
    }

    db.prepare(
      "UPDATE correspondencias SET status = 'retirada', retirado_at = datetime('now') WHERE id = ?"
    ).run(id);

    res.json({ message: "Correspondência marcada como retirada." });
  } catch (err: any) {
    log.error("Erro ao atualizar correspondência:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// ─── DELETE correspondencia (porteiro/sindico+) ──────────
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
    const corr = db.prepare("SELECT id FROM correspondencias WHERE id = ? AND condominio_id = ?").get(id, user.condominio_id) as any;
    if (!corr) {
      res.status(404).json({ error: "Correspondência não encontrada." });
      return;
    }

    db.prepare("DELETE FROM correspondencias WHERE id = ? AND condominio_id = ?").run(id, user.condominio_id);
    res.json({ message: "Correspondência removida." });
  } catch (err: any) {
    log.error("Erro ao excluir correspondência:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// ─── PUBLIC: Get photo by protocol (sem auth — usado em link de WhatsApp).
// Exige assinatura HMAC na query string (`?t=...`) para impedir enumeração.
router.get("/foto/:protocolo", (req: Request, res: Response) => {
  try {
    const protocolo = String(req.params.protocolo);
    if (!verifyProtocolo(protocolo, req.query.t as string | undefined)) {
      res.status(403).json({ error: "Link inválido ou expirado." });
      return;
    }
    const corr = db.prepare("SELECT foto FROM correspondencias WHERE protocolo = ?").get(protocolo) as { foto: string | null } | undefined;

    if (!corr || !corr.foto) {
      res.status(404).json({ error: "Foto não encontrada." });
      return;
    }

    // foto is base64 data URI like "data:image/jpeg;base64,..."
    const matches = corr.foto.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      res.status(400).json({ error: "Formato de foto inválido." });
      return;
    }

    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], "base64");

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (err: any) {
    log.error("Erro em correspondencias :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

export default router;
