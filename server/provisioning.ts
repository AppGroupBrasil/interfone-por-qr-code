import { Router, Request, Response } from "express";
import db from "./db.js";

const router = Router();

function mapearRole(role: string): string {
  const r = (role || "").toLowerCase();
  if (r === "superadmin" || r === "master") return "master";
  if (r === "admin" || r === "administrador" || r === "administradora") return "administradora";
  if (r === "sindico") return "sindico";
  if (r === "funcionario") return "funcionario";
  return "morador";
}

router.post("/usuario", (req: Request, res: Response) => {
  const secret = req.headers["x-provisioning-secret"];
  const expected = process.env.PROVISIONING_SECRET;
  if (!expected || secret !== expected) {
    res.status(403).json({ error: "Assinatura inválida" });
    return;
  }
  const b = req.body || {};
  if (!b.usuario_id || !b.email || !b.nome) {
    res.status(400).json({ error: "Campos obrigatórios ausentes" });
    return;
  }
  const roleLocal = mapearRole(b.role);

  const existing = db.prepare("SELECT * FROM users WHERE central_uuid = ?").get(b.usuario_id) as any;
  if (existing) {
    db.prepare(
      `UPDATE users SET name = ?, email = ?, role = ?, updated_at = datetime('now') WHERE central_uuid = ?`
    ).run(b.nome, b.email, roleLocal, b.usuario_id);
    res.json({ ok: true, usuario_id: b.usuario_id, id_local: existing.id });
    return;
  }

  const byEmail = db.prepare("SELECT * FROM users WHERE email = ?").get(b.email) as any;
  if (byEmail) {
    db.prepare(
      `UPDATE users SET central_uuid = ?, name = ?, role = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(b.usuario_id, b.nome, roleLocal, byEmail.id);
    res.json({ ok: true, usuario_id: b.usuario_id, id_local: byEmail.id });
    return;
  }

  const info = db.prepare(
    `INSERT INTO users (name, email, password, role, central_uuid)
     VALUES (?, ?, '!central!', ?, ?)`
  ).run(b.nome, b.email, roleLocal, b.usuario_id);
  res.json({ ok: true, usuario_id: b.usuario_id, id_local: Number(info.lastInsertRowid) });
});

export default router;
