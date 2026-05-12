import { Router, Request, Response } from "express";
import db from "./db.js";
import { authenticate, authorize } from "./middleware.js";
import { captureSnapshot, captureSnapshotForCondominio } from "./cameraSnapshot.js";
import { log } from "./logger.js";

const router = Router();

interface Camera {
  id: number;
  condominio_id: number;
  nome: string;
  setor: string;
  localizacao: string | null;
  url_stream: string | null;
  tipo_stream: string;
  protocolo: string;
  ip: string | null;
  porta: number | null;
  usuario: string | null;
  senha: string | null;
  ativa: number;
  ordem: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

// Remove user:pass@ embutidos em URL (ex: rtsp://u:p@host → rtsp://host).
function stripUrlCredentials(u: string | null | undefined): string | null {
  if (!u) return null;
  try { return u.replace(/^(\w+:\/\/)[^@/]+@/, "$1"); } catch { return null; }
}

// ─── GET all cameras for current condominio ──────────────
router.get("/", authenticate, (req: Request, res: Response) => {
  try {
    const condominioId = req.user!.condominio_id;
    const cameras = db
      .prepare("SELECT * FROM cameras WHERE condominio_id = ? ORDER BY ordem ASC, nome ASC")
      .all(condominioId) as Camera[];

    // Mask credenciais para usuários não-admin (inclui credenciais embutidas na URL).
    const role = req.user!.role;
    const isAdmin = role === "sindico" || role === "master" || role === "administradora";
    const masked = cameras.map((c) => ({
      ...c,
      senha: isAdmin ? c.senha : "***",
      usuario: isAdmin ? c.usuario : "***",
      url_stream: isAdmin ? c.url_stream : stripUrlCredentials(c.url_stream),
    }));

    res.json(masked);
  } catch (err: any) {
    log.error("Erro em cameras :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── GET single camera ────────────────────────────────────
router.get("/:id", authenticate, (req: Request, res: Response) => {
  try {
    const condominioId = req.user!.condominio_id;
    const camera = db
      .prepare("SELECT * FROM cameras WHERE id = ? AND condominio_id = ?")
      .get(req.params.id, condominioId) as Camera | undefined;

    if (!camera) {
      return res.status(404).json({ error: "Câmera não encontrada" });
    }

    // Mask credentials for non-admin users
    const role = req.user!.role;
    const isAdmin = role === "sindico" || role === "master" || role === "administradora";
    res.json({
      ...camera,
      senha: isAdmin ? camera.senha : "***",
      usuario: isAdmin ? camera.usuario : "***",
      url_stream: isAdmin ? camera.url_stream : stripUrlCredentials(camera.url_stream),
    });
  } catch (err: any) {
    log.error("Erro ao buscar câmera:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// ─── CREATE camera (sindico+ only) ────────────────────────
router.post(
  "/",
  authenticate,
  authorize("master", "administradora", "sindico"),
  (req: Request, res: Response) => {
    try {
      const condominioId = req.user!.condominio_id;
      const { nome, setor, localizacao, url_stream, tipo_stream, protocolo, ip, porta, usuario, senha, ordem } = req.body;

      if (!nome) {
        return res.status(400).json({ error: "Nome é obrigatório" });
      }

      const result = db.prepare(`
        INSERT INTO cameras (condominio_id, nome, setor, localizacao, url_stream, tipo_stream, protocolo, ip, porta, usuario, senha, ordem, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        condominioId,
        nome,
        setor || "outros",
        localizacao || null,
        url_stream || null,
        tipo_stream || "mjpeg",
        protocolo || "http",
        ip || null,
        porta || null,
        usuario || null,
        senha || null,
        ordem || 0,
        req.user!.id
      );

      const camera = db.prepare("SELECT * FROM cameras WHERE id = ?").get(result.lastInsertRowid) as Camera;
      res.status(201).json(camera);
    } catch (err: any) {
    log.error("Erro em cameras :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
    }
  }
);

// ─── UPDATE camera (sindico+ only) ────────────────────────
router.put(
  "/:id",
  authenticate,
  authorize("master", "administradora", "sindico"),
  (req: Request, res: Response) => {
    try {
      const condominioId = req.user!.condominio_id;
      const { nome, setor, localizacao, url_stream, tipo_stream, protocolo, ip, porta, usuario, senha, ativa, ordem } = req.body;

      const existing = db
        .prepare("SELECT * FROM cameras WHERE id = ? AND condominio_id = ?")
        .get(req.params.id, condominioId) as Camera | undefined;

      if (!existing) {
        return res.status(404).json({ error: "Câmera não encontrada" });
      }

      db.prepare(`
        UPDATE cameras SET
          nome = ?, setor = ?, localizacao = ?, url_stream = ?, tipo_stream = ?,
          protocolo = ?, ip = ?, porta = ?, usuario = ?, senha = ?, ativa = ?, ordem = ?,
          updated_at = datetime('now')
        WHERE id = ? AND condominio_id = ?
      `).run(
        nome ?? existing.nome,
        setor ?? existing.setor,
        localizacao ?? existing.localizacao,
        url_stream ?? existing.url_stream,
        tipo_stream ?? existing.tipo_stream,
        protocolo ?? existing.protocolo,
        ip ?? existing.ip,
        porta ?? existing.porta,
        usuario ?? existing.usuario,
        senha ?? existing.senha,
        ativa !== undefined ? ativa : existing.ativa,
        ordem ?? existing.ordem,
        req.params.id,
        condominioId
      );

      const camera = db.prepare("SELECT * FROM cameras WHERE id = ?").get(req.params.id) as Camera;
      res.json(camera);
    } catch (err: any) {
    log.error("Erro em cameras :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
    }
  }
);

// ─── DELETE camera (sindico+ only) ────────────────────────
router.delete(
  "/:id",
  authenticate,
  authorize("master", "administradora", "sindico"),
  (req: Request, res: Response) => {
    try {
      const condominioId = req.user!.condominio_id;
      const result = db
        .prepare("DELETE FROM cameras WHERE id = ? AND condominio_id = ?")
        .run(req.params.id, condominioId);

      if (result.changes === 0) {
        return res.status(404).json({ error: "Câmera não encontrada" });
      }

      res.json({ message: "Câmera removida com sucesso" });
    } catch (err: any) {
    log.error("Erro em cameras :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
    }
  }
);

// ─── TOGGLE camera active status ──────────────────────────
router.patch(
  "/:id/toggle",
  authenticate,
  authorize("master", "administradora", "sindico", "funcionario"),
  (req: Request, res: Response) => {
    try {
      const condominioId = req.user!.condominio_id;
      const existing = db
        .prepare("SELECT * FROM cameras WHERE id = ? AND condominio_id = ?")
        .get(req.params.id, condominioId) as Camera | undefined;

      if (!existing) {
        return res.status(404).json({ error: "Câmera não encontrada" });
      }

      db.prepare("UPDATE cameras SET ativa = ?, updated_at = datetime('now') WHERE id = ?")
        .run(existing.ativa ? 0 : 1, req.params.id);

      const camera = db.prepare("SELECT * FROM cameras WHERE id = ?").get(req.params.id) as Camera;
      res.json(camera);
    } catch (err: any) {
    log.error("Erro em cameras :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
    }
  }
);

// ─── CAPTURE SNAPSHOT from specific camera ───────────────
router.get(
  "/:id/snapshot",
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const camera = db.prepare(
        "SELECT * FROM cameras WHERE id = ? AND condominio_id = ?"
      ).get(req.params.id, user.condominio_id) as Camera | undefined;

      if (!camera) {
        res.status(404).json({ error: "Câmera não encontrada." });
        return;
      }
      if (!camera.url_stream) {
        res.status(400).json({ error: "Câmera sem URL de stream configurada." });
        return;
      }

      const snapshot = await captureSnapshot(camera as any);
      if (!snapshot) {
        res.status(500).json({ error: "Não foi possível capturar snapshot da câmera." });
        return;
      }

      res.json({ snapshot, camera_nome: camera.nome, captured_at: new Date().toISOString() });
    } catch (err: any) {
    log.error("Erro em cameras :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
    }
  }
);

// ─── CAPTURE SNAPSHOT from best camera for sector ────────
router.get(
  "/snapshot/sector/:setor",
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const setor = req.params.setor as string;
      const result = await captureSnapshotForCondominio(user.condominio_id!, [setor]);
      if (!result) {
        res.status(404).json({ error: "Nenhuma câmera ativa encontrada para este setor." });
        return;
      }
      res.json({ ...result, captured_at: new Date().toISOString() });
    } catch (err: any) {
    log.error("Erro em cameras :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
    }
  }
);

export default router;
