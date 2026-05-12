import { Router, Request, Response } from "express";
import db from "./db.js";
import crypto from "crypto";
import { log } from "./logger.js";

const router = Router();

/* ─── POST /api/visitor-qr/share — create short share token ─── */
router.post("/share", (req: Request, res: Response) => {
  try {
    const {
      qr_data,
      visitor_name,
      visitor_doc,
      visitor_parentesco,
      data_inicio,
      hora_inicio,
      data_fim,
      hora_fim,
      morador_nome,
      bloco,
      unidade,
      condominio_nome,
    } = req.body;

    if (!qr_data || !visitor_name || !data_inicio || !data_fim) {
      return res.status(400).json({ error: "Dados obrigatórios ausentes." });
    }
    // Limites de tamanho — endpoint público, evita abuso de storage.
    const tooLong = (s: unknown, n: number) => typeof s === "string" && s.length > n;
    if (tooLong(qr_data, 4096) || tooLong(visitor_name, 120) || tooLong(visitor_doc, 30) ||
        tooLong(visitor_parentesco, 60) || tooLong(morador_nome, 120) || tooLong(bloco, 60) ||
        tooLong(unidade, 30) || tooLong(condominio_nome, 200)) {
      return res.status(400).json({ error: "Campo excede o tamanho permitido." });
    }
    // data_inicio/data_fim devem ser YYYY-MM-DD
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRe.test(data_inicio) || !dateRe.test(data_fim)) {
      return res.status(400).json({ error: "Datas inválidas." });
    }

    // Generate a short unique token (8 chars)
    const token = crypto.randomBytes(6).toString("base64url").slice(0, 8);

    db.prepare(`
      INSERT INTO visitor_qr_shares (token, qr_data, visitor_name, visitor_doc, visitor_parentesco, data_inicio, hora_inicio, data_fim, hora_fim, morador_nome, bloco, unidade, condominio_nome)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      token,
      qr_data,
      visitor_name,
      visitor_doc || null,
      visitor_parentesco || null,
      data_inicio,
      hora_inicio,
      data_fim,
      hora_fim,
      morador_nome || null,
      bloco || null,
      unidade || null,
      condominio_nome || null,
    );

    res.json({ token });
  } catch (err) {
    log.error("Erro ao criar share token:", err);
    res.status(500).json({ error: "Erro interno." });
  }
});

/* ─── GET /api/visitor-qr/:token — fetch share data (public) ─── */
router.get("/:token", (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const row = db.prepare(`
      SELECT * FROM visitor_qr_shares WHERE token = ?
    `).get(token) as any;

    if (!row) {
      return res.status(404).json({ error: "QR Code não encontrado ou expirado." });
    }

    res.json({
      visitor_name: row.visitor_name,
      visitor_doc: row.visitor_doc,
      visitor_parentesco: row.visitor_parentesco,
      data_inicio: row.data_inicio,
      hora_inicio: row.hora_inicio,
      data_fim: row.data_fim,
      hora_fim: row.hora_fim,
      morador_nome: row.morador_nome,
      bloco: row.bloco,
      unidade: row.unidade,
      condominio_nome: row.condominio_nome,
      qr_data: row.qr_data,
    });
  } catch (err) {
    log.error("Erro ao buscar share:", err);
    res.status(500).json({ error: "Erro interno." });
  }
});

export default router;
