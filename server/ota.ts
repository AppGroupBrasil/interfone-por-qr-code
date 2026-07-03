/**
 * ═══════════════════════════════════════════════════════════
 * OTA UPDATES — endpoint self-hosted do @capgo/capacitor-updater
 * O app nativo consulta POST /api/app-update a cada abertura.
 * Bundles são gerados no build Docker (scripts/build-ota-bundle.mjs),
 * copiados para o volume persistente no boot (initOta) e publicados
 * no canal beta; produção só muda via /promote (master).
 * Canais: beta = usuários em OTA_BETA_USERS ou devices em
 * OTA_BETA_DEVICES; todos os demais recebem production.
 * ═══════════════════════════════════════════════════════════
 */

import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { authenticate, authorize } from "./middleware.js";
import { IS_PROD } from "./config.js";
import { log } from "./logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ota-build vem baked na imagem Docker; o store fica no volume (sobrevive a deploys)
const BUILD_DIR = IS_PROD ? "/app/ota-build" : path.join(__dirname, "..", "ota-build");
const STORE_DIR = IS_PROD ? path.join("/app", "data", "ota") : path.join(__dirname, "..", "ota-store");
const STATE_FILE = path.join(STORE_DIR, "state.json");
const KEEP_BUNDLES = 10;

const APP_URL = (process.env.APP_URL || "https://appinterfone.com.br").replace(/\/$/, "");
// versionCode nativo mínimo exigido para receber bundles (subir quando um
// bundle passar a depender de plugin nativo ausente em APKs antigos)
const MIN_NATIVE_CODE = parseInt(process.env.OTA_MIN_NATIVE_CODE || "0", 10) || 0;
const BETA_USERS = new Set(
  (process.env.OTA_BETA_USERS || "").split(",").map((s) => s.trim()).filter(Boolean)
);
const BETA_DEVICES = new Set(
  (process.env.OTA_BETA_DEVICES || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
);

interface BundleMeta {
  file: string;
  checksum: string;
  builtAt: string;
}

interface OtaState {
  bundles: Record<string, BundleMeta>;
  beta: string | null;
  production: string | null;
}

let state: OtaState = { bundles: {}, beta: null, production: null };

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function cleanupOldBundles() {
  const keep = new Set([state.beta, state.production].filter(Boolean) as string[]);
  const versions = Object.keys(state.bundles).sort().reverse();
  for (const v of versions.slice(KEEP_BUNDLES)) {
    if (keep.has(v)) continue;
    const meta = state.bundles[v];
    try {
      fs.unlinkSync(path.join(STORE_DIR, meta.file));
    } catch {}
    delete state.bundles[v];
  }
}

/** Copia o bundle gerado no build para o volume e o publica no canal beta. */
export function initOta() {
  try {
    fs.mkdirSync(STORE_DIR, { recursive: true });
    if (fs.existsSync(STATE_FILE)) {
      try {
        state = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")) as OtaState;
      } catch {}
    }
    const manifestPath = path.join(BUILD_DIR, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      log.info("OTA: nenhum bundle no build — endpoint responderá sem update.");
      saveState();
      return;
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
      version: string;
      checksum: string;
      builtAt: string;
    };
    const { version } = manifest;
    if (!state.bundles[version]) {
      const file = `bundle-${version}.zip`;
      fs.copyFileSync(path.join(BUILD_DIR, "bundle.zip"), path.join(STORE_DIR, file));
      state.bundles[version] = { file, checksum: manifest.checksum, builtAt: manifest.builtAt };
    }
    state.beta = version;
    if (!state.production) state.production = version;
    cleanupOldBundles();
    saveState();
    log.info(`OTA: bundle ${version} registrado`, { beta: state.beta, production: state.production });
  } catch (err: any) {
    log.error("OTA: falha ao registrar bundle do build", { message: err?.message });
  }
}

const router = Router();

// ────────────────────────────────────────────────────────────
// POST /api/app-update — checagem do plugin (sem auth: o request
// nativo não carrega cookies/JWT; expõe apenas versão e URL do zip)
// ────────────────────────────────────────────────────────────
router.post("/", (req: Request, res: Response) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const platform = String(b.platform ?? "");
  const customId = String(b.custom_id ?? "");
  const deviceId = String(b.device_id ?? "").toLowerCase();
  const currentBundle = String(b.version_name ?? "");
  const nativeCode = parseInt(String(b.version_code ?? "0"), 10) || 0;

  if (platform !== "android") {
    res.json({ message: "Plataforma sem OTA.", version: "" });
    return;
  }
  if (MIN_NATIVE_CODE > 0 && nativeCode < MIN_NATIVE_CODE) {
    res.json({ message: "Versão nativa antiga — atualize pela Play Store.", version: "" });
    return;
  }

  const channel = BETA_USERS.has(customId) || BETA_DEVICES.has(deviceId) ? "beta" : "production";
  const version = channel === "beta" ? state.beta : state.production;
  const meta = version ? state.bundles[version] : undefined;
  if (!version || !meta) {
    res.json({ message: "Nenhum bundle publicado.", version: "" });
    return;
  }
  if (currentBundle === version) {
    res.json({ message: "Atualizado.", version: "" });
    return;
  }

  res.json({
    version,
    url: `${APP_URL}/api/app-update/bundle/${meta.file}`,
    checksum: meta.checksum,
  });
});

// ────────────────────────────────────────────────────────────
// GET /api/app-update/bundle/:file — download do zip (sem auth,
// mesmo nível de exposição dos assets estáticos do site)
// ────────────────────────────────────────────────────────────
router.get("/bundle/:file", (req: Request, res: Response) => {
  const file = String(req.params.file ?? "");
  if (!/^bundle-[\w.-]+\.zip$/.test(file)) {
    res.status(400).json({ error: "Nome inválido." });
    return;
  }
  const abs = path.join(STORE_DIR, file);
  if (!fs.existsSync(abs)) {
    res.status(404).json({ error: "Bundle não encontrado." });
    return;
  }
  res.sendFile(abs);
});

// ────────────────────────────────────────────────────────────
// GET /api/app-update/status — estado dos canais (master)
// ────────────────────────────────────────────────────────────
router.get("/status", authenticate, authorize("master"), (_req: Request, res: Response) => {
  res.json({
    beta: state.beta,
    production: state.production,
    minNativeCode: MIN_NATIVE_CODE,
    betaUsers: [...BETA_USERS],
    bundles: Object.entries(state.bundles)
      .sort(([a], [b2]) => (a < b2 ? 1 : -1))
      .map(([version, m]) => ({ version, builtAt: m.builtAt })),
  });
});

// ────────────────────────────────────────────────────────────
// POST /api/app-update/promote — publica o beta em produção;
// body { version } permite promover/reverter para versão específica (master)
// ────────────────────────────────────────────────────────────
router.post("/promote", authenticate, authorize("master"), (req: Request, res: Response) => {
  const target = String((req.body as Record<string, unknown>)?.version || state.beta || "");
  if (!target || !state.bundles[target]) {
    res.status(400).json({ error: "Versão desconhecida." });
    return;
  }
  state.production = target;
  saveState();
  log.info(`OTA: production promovido para ${target}`);
  res.json({ success: true, production: state.production, beta: state.beta });
});

export default router;
