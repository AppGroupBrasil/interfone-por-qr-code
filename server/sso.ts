import { Router } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import db, { type DbUser } from "./db.js";
import { JWT_SECRET } from "./config.js";

// ─────────────────────────────────────────────────────────────────────────────
// SSO da central (App Condomínio) — login único.
// A central assina o token com a chave PRIVADA (RS256); aqui verificamos só pela
// chave PÚBLICA do JWKS — nada a vazar. O cadastro da central é a fonte única da
// verdade: a cada acesso regravamos (read-only) o usuário. Fluxo: o hub redireciona
// para GET /sso?token=<JWT> → verifica → JIT upsert → seta o cookie de sessão
// PRÓPRIO do app → 302 /dashboard. Erro → 302 /login?sso=invalido.
// ─────────────────────────────────────────────────────────────────────────────

const router = Router();
const COOKIE_NAME = "session_token";
const COOKIE_MAX_AGE = 24 * 60 * 60 * 1000;
const ISS = "auth-central";
const AUDIENCE = process.env.SSO_AUDIENCE || "interfone-qr";
const JWKS_URL = process.env.SSO_JWKS_URL || "https://auth.appgroupbrasil.com.br/api/v1/sso/jwks.json";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// migração idempotente: condominios.central_uuid (users já tem)
try {
  db.prepare("SELECT central_uuid FROM condominios LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE condominios ADD COLUMN central_uuid TEXT");
  try {
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_condominios_central_uuid ON condominios(central_uuid) WHERE central_uuid IS NOT NULL");
  } catch {}
}

type Jwk = { kid?: string; kty: string; n: string; e: string; alg?: string };
let jwksCache: Map<string, string> | null = null;
let jwksCacheAt = 0;
const JWKS_TTL = 5 * 60 * 1000;

async function carregarJwks(): Promise<Map<string, string>> {
  if (jwksCache && Date.now() - jwksCacheAt < JWKS_TTL) return jwksCache;
  const res = await fetch(JWKS_URL, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`JWKS ${res.status}`);
  const body = (await res.json()) as { keys: Jwk[] };
  const pems = new Map<string, string>();
  for (const k of body.keys || []) {
    if (k.kty !== "RSA") continue;
    const pem = crypto.createPublicKey({ key: k as any, format: "jwk" }).export({ type: "spki", format: "pem" }) as string;
    pems.set(k.kid || "default", pem);
  }
  jwksCache = pems;
  jwksCacheAt = Date.now();
  return pems;
}

function lerKid(token: string): string | null {
  try {
    const head = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8"));
    return head.kid || null;
  } catch {
    return null;
  }
}

interface SsoClaims {
  sub: string;
  email: string;
  nome: string;
  cpf?: string | null;
  telefone?: string | null;
  perfil?: string | null;
  condominio_id?: string | null;
  condominio_nome?: string | null;
  unidade?: string | null;
  bloco?: string | null;
}

async function verificarSso(token: string): Promise<SsoClaims> {
  const pems = await carregarJwks();
  const kid = lerKid(token);
  const candidatos = kid && pems.has(kid) ? [pems.get(kid)!] : [...pems.values()];
  if (candidatos.length === 0) throw new Error("JWKS sem chave RSA");
  let ultimoErro: any;
  for (const pem of candidatos) {
    try {
      return jwt.verify(token, pem, { algorithms: ["RS256"], issuer: ISS, audience: AUDIENCE }) as unknown as SsoClaims;
    } catch (e) {
      ultimoErro = e;
    }
  }
  throw ultimoErro || new Error("assinatura inválida");
}

// central perfil → role do Interfone QR
function mapRole(perfil?: string | null): string {
  switch ((perfil || "").toLowerCase()) {
    case "master":
    case "superadmin":
      return "master";
    case "admin":
    case "administrador":
    case "administradora":
      return "administradora";
    case "gestor":
    case "sindico":
    case "síndico":
      return "sindico";
    case "funcionario":
      return "funcionario";
    default:
      return "morador";
  }
}

/** Upsert read-only do usuário pelos claims da central. Vínculo por central_uuid. */
function provisionarUsuario(c: SsoClaims): DbUser {
  const role = mapRole(c.perfil);
  const email = (c.email || "").toLowerCase().trim();
  const telefone = c.telefone ? String(c.telefone).replace(/\D/g, "") || null : null;
  const cpf = c.cpf ? String(c.cpf).replace(/\D/g, "") || null : null;

  // condomínio: vínculo por central_uuid (id local é autoincremento próprio)
  let condId: number | null = null;
  if (c.condominio_id && UUID_RE.test(c.condominio_id)) {
    const nome = c.condominio_nome || "Condomínio";
    const existente = db.prepare("SELECT id FROM condominios WHERE central_uuid = ?").get(c.condominio_id) as { id: number } | undefined;
    if (existente) {
      db.prepare("UPDATE condominios SET name = ?, updated_at = datetime('now') WHERE id = ?").run(nome, existente.id);
      condId = existente.id;
    } else {
      const info = db.prepare("INSERT INTO condominios (name, central_uuid) VALUES (?, ?)").run(nome, c.condominio_id);
      condId = Number(info.lastInsertRowid);
    }
  }

  // usuário: achar por central_uuid → senão por email (legado) → upsert
  let user = db.prepare("SELECT * FROM users WHERE central_uuid = ?").get(c.sub) as DbUser | undefined;
  if (!user && email) {
    user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as DbUser | undefined;
  }

  if (user) {
    db.prepare(
      `UPDATE users SET central_uuid = ?, email = ?, name = ?, role = ?, phone = COALESCE(?, phone),
        cpf = COALESCE(?, cpf), unit = COALESCE(?, unit), block = COALESCE(?, block),
        condominio_id = COALESCE(?, condominio_id), updated_at = datetime('now') WHERE id = ?`
    ).run(c.sub, email, c.nome || email, role, telefone, cpf, c.unidade || null, c.bloco || null, condId, user.id);
  } else {
    const info = db.prepare(
      `INSERT INTO users (name, email, password, role, central_uuid, phone, cpf, unit, block, condominio_id, aprovado)
       VALUES (?, ?, '!sso!', ?, ?, ?, ?, ?, ?, ?, 1)`
    ).run(c.nome || email, email, role, c.sub, telefone, cpf, c.unidade || null, c.bloco || null, condId);
    user = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(info.lastInsertRowid)) as DbUser;
  }
  return db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as DbUser;
}

// GET /sso?token=<JWT central> → seta cookie de sessão e 302 /dashboard
router.get("/", async (req, res) => {
  const token = String(req.query.token || "");
  if (!token) {
    res.redirect("/login?sso=invalido");
    return;
  }
  try {
    const claims = await verificarSso(token);
    const user = provisionarUsuario(claims);
    const appToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "24h" });
    res.cookie(COOKIE_NAME, appToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });
    res.redirect("/dashboard");
  } catch (err: any) {
    console.error("[SSO] falha:", err?.message || err);
    res.redirect("/login?sso=invalido");
  }
});

export default router;
