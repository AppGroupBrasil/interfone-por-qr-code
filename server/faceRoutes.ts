/**
 * Face Recognition API Routes
 * 
 * POST /api/face/compare-visitors   — Compara foto contra visitantes cadastrados
 * POST /api/face/compare-preauths   — Compara foto contra pré-autorizações ativas
 * POST /api/face/extract            — Extrai descriptor de uma foto (e opcionalmente salva)
 */

import { Router, Request, Response } from "express";
import db from "./db.js";
import { authenticate, authorize } from "./middleware.js";
import { extractDescriptor, compareFaces, isReady } from "./faceService.js";
import { log } from "./logger.js";

const router = Router();

// ─── Middleware: verificar se modelos estão carregados ───
const ensureModelsReady = (_req: Request, res: Response, next: Function) => {
  if (!isReady()) {
    res.status(503).json({ error: "Modelos de reconhecimento facial ainda carregando. Tente novamente em alguns segundos." });
    return;
  }
  next();
};

// ─── POST /compare-visitors — Compara foto com visitantes ───
router.post("/compare-visitors", authenticate, authorize("master", "administradora", "sindico", "funcionario"), ensureModelsReady, async (req: Request, res: Response) => {
  try {
    const { photo } = req.body;
    if (!photo || typeof photo !== "string") {
      res.status(400).json({ error: "Campo 'photo' (base64) é obrigatório." });
      return;
    }
    if (photo.length > 4_000_000) { // ~3MB base64
      res.status(413).json({ error: "Foto muito grande (máx ~3MB)." });
      return;
    }

    const condominioId = req.user!.condominio_id;

    // 1. Extrair descriptor da foto enviada
    const descriptor = await extractDescriptor(photo);
    if (!descriptor) {
      res.json({ matched: false, error: "Nenhum rosto detectado na foto." });
      return;
    }

    // 2. Buscar visitantes com descriptor no DB
    const visitors = db.prepare(
      "SELECT id, nome, documento, bloco, apartamento, face_descriptor, created_at FROM visitors WHERE (condominio_id = ? OR condominio_id IS NULL) AND face_descriptor IS NOT NULL ORDER BY created_at DESC"
    ).all(condominioId) as any[];

    const knownFaces = visitors
      .map((v: any) => ({
        id: v.id,
        nome: v.nome,
        face_descriptor: JSON.parse(v.face_descriptor),
      }))
      .filter((v: any) => v.face_descriptor && Array.isArray(v.face_descriptor));

    // 3. Comparar
    const result = compareFaces(descriptor, knownFaces);

    // 4. Se encontrou match, retornar dados completos do visitante
    if (result.matched && result.visitorId) {
      const visitor = db.prepare(
        "SELECT id, nome, documento, telefone, foto, bloco, apartamento, created_at FROM visitors WHERE id = ?"
      ).get(result.visitorId) as any;

      res.json({
        matched: true,
        similarity: result.similarity,
        distance: result.distance,
        visitor: visitor || null,
      });
      return;
    }

    // 5. Se não encontrou, tentar processar visitantes com foto mas sem descriptor
    const pending = db.prepare(
      "SELECT id, nome, documento, foto, bloco, apartamento, created_at FROM visitors WHERE (condominio_id = ? OR condominio_id IS NULL) AND face_descriptor IS NULL AND foto IS NOT NULL ORDER BY created_at DESC LIMIT 50"
    ).all(condominioId) as any[];

    let bestPendingMatch: any = null;
    let bestPendingDistance = 1;

    for (const v of pending) {
      try {
        const pendingDescriptor = await extractDescriptor(v.foto);
        if (pendingDescriptor) {
          // Salvar descriptor para próximas comparações serem instantâneas
          db.prepare("UPDATE visitors SET face_descriptor = ? WHERE id = ?").run(
            JSON.stringify(pendingDescriptor),
            v.id
          );

          // Comparar
          let sum = 0;
          for (let i = 0; i < descriptor.length; i++) {
            sum += (descriptor[i] - pendingDescriptor[i]) ** 2;
          }
          const dist = Math.sqrt(sum);

          if (dist < bestPendingDistance) {
            bestPendingDistance = dist;
            bestPendingMatch = v;
          }

          // Se achou match bom, parar
          if (dist < 0.6) break;
        }
      } catch {
        // pular foto sem rosto
      }
    }

    if (bestPendingMatch && bestPendingDistance < 0.6) {
      res.json({
        matched: true,
        similarity: Math.round((1 - bestPendingDistance) * 100),
        distance: bestPendingDistance,
        visitor: bestPendingMatch,
      });
      return;
    }

    res.json({
      matched: false,
      descriptor: descriptor, // retorna para o frontend salvar se cadastrar novo
    });
  } catch (err: any) {
    log.error("[FaceRoutes] Erro em compare-visitors:", err);
    res.status(500).json({ error: "Erro ao processar reconhecimento facial." });
  }
});

// ─── POST /compare-preauths — Compara foto com pré-autorizações ativas ───
router.post("/compare-preauths", authenticate, authorize("master", "administradora", "sindico", "funcionario"), ensureModelsReady, async (req: Request, res: Response) => {
  try {
    const { photo } = req.body;
    if (!photo || typeof photo !== "string") {
      res.status(400).json({ error: "Campo 'photo' (base64) é obrigatório." });
      return;
    }
    if (photo.length > 4_000_000) { // ~3MB base64
      res.status(413).json({ error: "Foto muito grande (máx ~3MB)." });
      return;
    }

    const condominioId = req.user!.condominio_id;

    // 1. Extrair descriptor da foto
    const descriptor = await extractDescriptor(photo);
    if (!descriptor) {
      res.json({ matched: false, error: "Nenhum rosto detectado na foto." });
      return;
    }

    // 2. Buscar pré-autorizações ativas com descriptor
    const results = db.prepare(`
      SELECT id, visitante_nome, visitante_documento, visitante_foto,
             face_descriptor, bloco, apartamento, morador_name, morador_phone,
             data_inicio, data_fim, hora_inicio, hora_fim, observacao
      FROM pre_authorizations 
      WHERE condominio_id = ? AND status = 'ativa' AND face_descriptor IS NOT NULL
    `).all(condominioId) as any[];

    const knownFaces = results
      .map((r: any) => ({
        id: r.id,
        nome: r.visitante_nome,
        face_descriptor: JSON.parse(r.face_descriptor),
      }))
      .filter((r: any) => r.face_descriptor && Array.isArray(r.face_descriptor));

    // 3. Comparar
    const result = compareFaces(descriptor, knownFaces, 0.5); // Threshold mais rígido para pré-auth

    if (result.matched && result.visitorId) {
      const preAuth = results.find((r: any) => r.id === result.visitorId);
      res.json({
        matched: true,
        similarity: result.similarity,
        distance: result.distance,
        preAuth: preAuth ? {
          ...preAuth,
          face_descriptor: undefined, // não enviar descriptor de volta
        } : null,
      });
      return;
    }

    res.json({ matched: false });
  } catch (err: any) {
    log.error("[FaceRoutes] Erro em compare-preauths:", err);
    res.status(500).json({ error: "Erro ao processar reconhecimento facial." });
  }
});

// ─── POST /extract — Extrai descriptor de uma foto ───
router.post("/extract", authenticate, authorize("master", "administradora", "sindico", "funcionario"), ensureModelsReady, async (req: Request, res: Response) => {
  try {
    const { photo, visitor_id } = req.body;
    if (!photo) {
      res.status(400).json({ error: "Campo 'photo' (base64) é obrigatório." });
      return;
    }

    const descriptor = await extractDescriptor(photo);
    if (!descriptor) {
      res.json({ success: false, error: "Nenhum rosto detectado." });
      return;
    }

    // Se forneceu visitor_id, salvar no DB
    if (visitor_id) {
      db.prepare("UPDATE visitors SET face_descriptor = ? WHERE id = ?").run(
        JSON.stringify(descriptor),
        visitor_id
      );
    }

    res.json({ success: true, descriptor });
  } catch (err: any) {
    log.error("[FaceRoutes] Erro em extract:", err);
    res.status(500).json({ error: "Erro ao extrair descriptor facial." });
  }
});

// ─── POST /compare-two — Compara duas fotos diretamente ───
router.post("/compare-two", authenticate, authorize("master", "administradora", "sindico", "funcionario"), ensureModelsReady, async (req: Request, res: Response) => {
  try {
    const { photo1, photo2 } = req.body;
    if (!photo1 || !photo2 || typeof photo1 !== "string" || typeof photo2 !== "string") {
      res.status(400).json({ error: "Campos 'photo1' e 'photo2' (base64) são obrigatórios." });
      return;
    }
    if (photo1.length > 4_000_000 || photo2.length > 4_000_000) {
      res.status(413).json({ error: "Foto muito grande (máx ~3MB)." });
      return;
    }

    // 1. Extrair descriptors das duas fotos
    const [desc1, desc2] = await Promise.all([
      extractDescriptor(photo1),
      extractDescriptor(photo2),
    ]);

    if (!desc1) {
      res.json({ matched: false, error: "Nenhum rosto detectado na primeira foto." });
      return;
    }
    if (!desc2) {
      res.json({ matched: false, error: "Nenhum rosto detectado na segunda foto." });
      return;
    }

    // 2. Calcular distância euclidiana
    let sum = 0;
    for (let i = 0; i < desc1.length; i++) {
      sum += (desc1[i] - desc2[i]) ** 2;
    }
    const distance = Math.sqrt(sum);
    const similarity = Math.max(0, Math.min(100, Math.round((1 - distance) * 100)));
    const matched = distance < 0.5;

    res.json({ matched, similarity, distance });
  } catch (err: any) {
    log.error("[FaceRoutes] Erro em compare-two:", err);
    res.status(500).json({ error: "Erro ao comparar fotos." });
  }
});

// ─── GET /status — Verifica se o serviço está pronto ───
router.get("/status", (_req: Request, res: Response) => {
  res.json({ ready: isReady() });
});

// ─── POST /register-my-face — Morador registra seu rosto (selfie) ───
router.post(
  "/register-my-face",
  authenticate,
  authorize("master", "administradora", "sindico", "funcionario", "morador"),
  ensureModelsReady,
  async (req: Request, res: Response) => {
    try {
      const { photo } = req.body;
      if (!photo) {
        res.status(400).json({ error: "Campo 'photo' (base64) é obrigatório." });
        return;
      }

      const descriptor = await extractDescriptor(photo);
      if (!descriptor) {
        res.json({ success: false, error: "Nenhum rosto detectado na foto. Posicione seu rosto no centro da câmera." });
        return;
      }

      db.prepare("UPDATE users SET face_descriptor = ? WHERE id = ?").run(
        JSON.stringify(descriptor),
        req.user!.id
      );

      res.json({ success: true, message: "Rosto cadastrado com sucesso!" });
    } catch (err: any) {
      log.error("[FaceRoutes] Erro ao registrar rosto:", err);
      res.status(500).json({ error: "Erro ao registrar rosto." });
    }
  }
);

// ─── GET /my-face-status — Verifica se morador já cadastrou rosto ───
router.get(
  "/my-face-status",
  authenticate,
  authorize("master", "administradora", "sindico", "funcionario", "morador"),
  (_req: Request, res: Response) => {
    const row = db.prepare("SELECT face_descriptor FROM users WHERE id = ?").get((_req as any).user!.id) as any;
    res.json({ registered: !!(row && row.face_descriptor) });
  }
);

// ─── POST /selfie-auth — Morador autentica por selfie para abrir portão ───
router.post(
  "/selfie-auth",
  authenticate,
  authorize("master", "administradora", "sindico", "funcionario", "morador"),
  ensureModelsReady,
  async (req: Request, res: Response) => {
    try {
      const { photo } = req.body;
      if (!photo) {
        res.status(400).json({ error: "Campo 'photo' (base64) é obrigatório." });
        return;
      }

      const userId = req.user!.id;

      // Get stored descriptor
      const row = db.prepare("SELECT face_descriptor FROM users WHERE id = ?").get(userId) as any;
      if (!row || !row.face_descriptor) {
        res.json({ matched: false, error: "Você ainda não cadastrou seu rosto. Cadastre na Portaria Virtual." });
        return;
      }

      // Extract descriptor from selfie
      const selfieDescriptor = await extractDescriptor(photo);
      if (!selfieDescriptor) {
        res.json({ matched: false, error: "Nenhum rosto detectado. Posicione bem seu rosto na câmera." });
        return;
      }

      // Compare
      const storedDescriptor = JSON.parse(row.face_descriptor) as number[];
      const result = compareFaces(selfieDescriptor, [
        { id: userId, nome: req.user!.name, face_descriptor: storedDescriptor }
      ], 0.55); // threshold 0.55 — mais permissivo que visitantes mas seguro

      res.json({
        matched: result.matched,
        similarity: result.similarity,
        distance: result.distance,
      });
    } catch (err: any) {
      log.error("[FaceRoutes] Erro selfie-auth:", err);
      res.status(500).json({ error: "Erro ao autenticar por selfie." });
    }
  }
);

export default router;
