import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";
import { initSignalingServer } from "./websocket.js";
import authRouter from "./auth.js";
import ssoRouter from "./sso.js";
import provisioningRouter from "./provisioning.js";
import funcionariosRouter from "./funcionarios.js";
import blocosRouter from "./blocos.js";
import moradoresRouter from "./moradores.js";
import condominiosRouter from "./condominios.js";
import usersRouter from "./users.js";
import masterRouter from "./master.js";
import visitorsRouter from "./visitors.js";
import preAuthRouter from "./preAuthorizations.js";
import deliveryRouter from "./deliveryAuthorizations.js";
import vehicleRouter from "./vehicleAuthorizations.js";
import condominioConfigRouter from "./condominioConfig.js";
import correspondenciasRouter from "./correspondencias.js";
import livroProtocoloRouter from "./livroProtocolo.js";
import camerasRouter from "./cameras.js";
import rondasRouter from "./rondas.js";
import interfoneRouter from "./interfone.js";
import deviceTokensRouter from "./deviceTokens.js";
import visitorQRShareRouter from "./visitorQRShare.js";
import whatsappRouter from "./whatsappRoutes.js";
import otaRouter, { initOta } from "./ota.js";
import { encerrarChamadasOrfas } from "./callLog.js";
import { performBackup, cleanupDemoAccounts, cleanupExpiredAuthorizations, cleanupOldAuditLogs, cleanupVisitorQRShares, cleanupOldVisitors, checkDbHealth } from "./db.js";
import { authenticate, authorize } from "./middleware.js";
import { ALLOWED_ORIGINS, IS_PROD, DEMO_MODE } from "./config.js";
import { log } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// JWT_SECRET validado em ./config.ts — falha-fast no import.

// Escopo do produto v1 = interfonia sem fio. Tudo o mais fica no código,
// desligado por padrão, e volta ligando a flag no .env.
const EXTRA_MODULES_ENABLED = process.env.EXTRA_MODULES_ENABLED === "true";
const GATE_ENABLED = process.env.GATE_ENABLED === "true";

const app = express();
const PORT = parseInt(process.env.PORT || "3001");

// Atrás do Traefik (Coolify): confiar em 1 hop para obter req.ip/protocolo reais
// (rate limiting por IP do cliente, cookies secure). Não usar `true` — seria spoofável.
app.set("trust proxy", 1);

// Middleware

// Security headers (helmet)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://appgroupbrasil.com.br"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: IS_PROD
        ? ["'self'", "data:", "blob:", "https:"]
        : ["'self'", "data:", "blob:", "https:", "http:"],
      connectSrc: IS_PROD
        ? ["'self'", "wss:", "https:"]
        : ["'self'", "wss:", "ws:", "https:", "http:"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      mediaSrc: ["'self'", "blob:", "data:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Permite carregar recursos de câmeras/CDNs
}));

// CORS — restrito a origens conhecidas (ALLOWED_ORIGINS via env).
// Em dev/staging, rede local também aceita (LAN do condomínio).
const isLocalNetworkOrigin = (origin: string): boolean => {
  try {
    const url = new URL(origin);
    const host = url.hostname;
    return /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
  } catch { return false; }
};
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // mobile/curl
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    if (!IS_PROD && isLocalNetworkOrigin(origin)) return callback(null, true);
    callback(null, false);
  },
  credentials: true,
}));

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// Rate limiting global — 200 req/min por IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Tente novamente em 1 minuto." },
});
app.use("/api", globalLimiter);

// Rate limiting rigoroso para autenticação — 5 tentativas/15min
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas de login. Tente novamente em 15 minutos." },
  keyGenerator: (req) => {
    // Limita por IP + email para evitar lockout coletivo
    const email = req.body?.email?.toLowerCase?.() || "";
    const ip = ipKeyGenerator(req.ip || req.socket.remoteAddress || "unknown");
    return `${ip}:${email}`;
  },
  validate: { xForwardedForHeader: false, ip: false },
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/password-reset", authLimiter);

// Rate limit para criação de visitantes / QR público (anti-abuso)
const visitorWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Aguarde 1 minuto." },
});
// Aplica apenas em métodos de escrita
const writeOnly = (limiter: any) => (req: any, res: any, next: any) =>
  ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) ? limiter(req, res, next) : next();
app.use("/api/visitors", writeOnly(visitorWriteLimiter));
app.use("/api/visitor-qr", writeOnly(visitorWriteLimiter));
app.use("/api/pre-authorizations", writeOnly(visitorWriteLimiter));
app.use("/api/delivery-authorizations", writeOnly(visitorWriteLimiter));
app.use("/api/vehicle-authorizations", writeOnly(visitorWriteLimiter));

// Interfone digital: POST /calls é público (visitante inicia chamada).
// Limite mais agressivo para evitar abuso/DoS de chamadas falsas.
const interfoneCallLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas chamadas. Aguarde 1 minuto." },
});
app.use("/api/interfone/calls", writeOnly(interfoneCallLimiter));
app.use("/api/interfone/whatsapp-fallback", writeOnly(interfoneCallLimiter));

// Câmeras: upload de snapshot pode ser pesado (10MB body); limite mais agressivo
const cameraUploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitos uploads de câmera. Aguarde 1 minuto." },
});
app.use("/api/cameras", writeOnly(cameraUploadLimiter));

// Ensure UTF-8 charset on all JSON responses
app.use((_req, res, next) => {
  const origJson = res.json.bind(res);
  res.json = (body: any) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return origJson(body);
  };
  next();
});

// Request logging (somente em desenvolvimento)
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const ms = Date.now() - start;
      console.log(`${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
    });
    next();
  });
}

// Routes
app.use("/sso", ssoRouter);
app.use("/api/auth", authRouter);
app.use("/api/provisioning", provisioningRouter);
app.use("/api/funcionarios", funcionariosRouter);
app.use("/api/blocos", blocosRouter);
app.use("/api/moradores", moradoresRouter);
app.use("/api/condominios", condominiosRouter);
app.use("/api/users", usersRouter);
app.use("/api/master", masterRouter);
app.use("/api/condominio-config", condominioConfigRouter);
app.use("/api/interfone", interfoneRouter);
app.use("/api/device-tokens", deviceTokensRouter);

// ─── Módulos fora do escopo v1 — DESLIGADOS ───
// O produto v1 é interfonia sem fio: visitante chama, morador (ou portaria)
// atende. Controle de visitantes, pré-autorizações, entregas, veículos,
// correspondências, livro de protocolo, câmeras, rondas, QR de visitante e
// reconhecimento facial seguem inteiros no código, mas não sobem: cada rota
// montada é superfície de ataque e mais um lugar onde um condomínio que só
// comprou interfone poderia ver erro. Para reativar: EXTRA_MODULES_ENABLED=true.
if (EXTRA_MODULES_ENABLED) {
  app.use("/api/visitors", visitorsRouter);
  app.use("/api/pre-authorizations", preAuthRouter);
  app.use("/api/delivery-authorizations", deliveryRouter);
  app.use("/api/vehicle-authorizations", vehicleRouter);
  app.use("/api/correspondencias", correspondenciasRouter);
  app.use("/api/livro-protocolo", livroProtocoloRouter);
  app.use("/api/cameras", camerasRouter);
  app.use("/api/rondas", rondasRouter);
  app.use("/api/visitor-qr", visitorQRShareRouter);
  // face-api/canvas só é carregado aqui. canvas é devDependency: a imagem de
  // produção não o instala, então reativar face exige rebuild sem --omit=dev.
  // Falhar o import não pode derrubar o interfone — só desliga /api/face.
  try {
    const { default: faceRouter } = await import("./faceRoutes.js");
    app.use("/api/face", faceRouter);
  } catch (err: any) {
    console.warn("[extras] /api/face indisponível (canvas/face-api ausentes):", err?.message);
  }
  console.warn("[extras] módulos fora do escopo v1 habilitados via EXTRA_MODULES_ENABLED=true");
}
// ─── Portão (eWeLink/SONOFF) — DESLIGADO na v1 ───
// Escopo v1 = interfonia sem fio. A abertura remota de portão está fora do produto
// até existirem: sinalização WebSocket autenticada, autorização validada no servidor
// por condomínio+unidade, pulso com teto em segundos (nunca estado "ligado"),
// cooldown por unidade, log imutável e acionamento por controlador local.
// Mapa completo e pré-condições de retomada em docs/portao-desativado.md
if (GATE_ENABLED) {
  try {
    const { default: gateRouter } = await import("./gateRoutes.js");
    app.use("/api/gate", gateRouter);
    console.warn("[gate] rotas de portão habilitadas via GATE_ENABLED=true");
  } catch (err: any) {
    console.warn("[gate] rotas de portão indisponíveis (falha ao carregar gateRoutes):", err?.message);
  }
}
app.use("/api/whatsapp", whatsappRouter);
app.use("/api/app-update", otaRouter);

// Test routes — only available in development
if (process.env.NODE_ENV !== "production") {
  import("./testRoutes.js").then((m) => {
    app.use("/api/test", m.default);
    console.log("  🧪 Test routes enabled (dev only)");
  });
}

// Health check
app.get("/api/health", (_req, res) => {
  // demo: a landing usa para nao exibir botoes de demonstracao que o servidor
  // recusaria com 404 (DEMO_MODE desligado e o padrao em producao).
  res.json({ status: "ok", timestamp: new Date().toISOString(), demo: DEMO_MODE });
});

// Readiness — precisa vir ANTES do catch-all /api (senão devolve 404)
// É este (não o /api/health) que o HEALTHCHECK do Docker consulta: 503 aqui
// marca o container unhealthy, que é o sinal de que o banco parou de responder.
app.get("/api/ready", (_req, res) => {
  const db = checkDbHealth();
  if (!db.ok) {
    log.error("Readiness falhou: banco inacessível", { message: db.error });
    return res.status(503).json({ status: "degraded", db: "erro", uptime: process.uptime() });
  }
  res.json({ status: "ready", db: "ok", uptime: process.uptime() });
});

// Manual backup endpoint (master only)
app.post("/api/backup", authenticate, authorize("master"), (_req, res) => {
  const backupPath = performBackup();
  if (backupPath) {
    res.json({ success: true, path: backupPath });
  } else {
    res.status(500).json({ error: "Falha ao criar backup." });
  }
});

// Unknown API routes → 404 JSON (evita o fallback SPA devolver index.html em /api/*)
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Rota não encontrada." });
});

// Serve static frontend files in production
if (process.env.NODE_ENV === "production") {
  const distPath = path.resolve(__dirname, "../dist");
  app.use(express.static(distPath));
  // SPA fallback — serve index.html for all non-API routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// Global error handler — prevents internal error details from leaking to clients
app.use((err: any, _req: any, res: any, _next: any) => {
  log.error("Unhandled error", { message: err?.message, stack: IS_PROD ? undefined : err?.stack });
  res.status(500).json({ error: "Erro interno do servidor." });
});

// Start
const server = http.createServer(app);
initSignalingServer(server);

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`\n[${signal}] Encerrando servidor...`);
  server.close(() => {
    console.log("[shutdown] HTTP fechado.");
    process.exit(0);
  });
  setTimeout(() => {
    log.error("[shutdown] Timeout — forçando saída.");
    process.exit(1);
  }, 10000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Resiliência: registrar (não derrubar silenciosamente) erros não tratados
process.on("unhandledRejection", (reason: any) => {
  log.error("unhandledRejection", { message: reason?.message ?? String(reason) });
});
process.on("uncaughtException", (err: any) => {
  log.error("uncaughtException", { message: err?.message, stack: IS_PROD ? undefined : err?.stack });
});

server.listen(PORT, "0.0.0.0", () => {
  log.info(`HTTP escutando em 0.0.0.0:${PORT}`, { env: process.env.NODE_ENV });

  initOta();
  encerrarChamadasOrfas();

  // Só faz sentido carregar os modelos de face se algum módulo que os usa subiu.
  if (EXTRA_MODULES_ENABLED || GATE_ENABLED) {
    import("./faceService.js")
      .then((m) => m.loadModels())
      .then(() => {
        log.info("Modelos de reconhecimento facial carregados");
      })
      .catch((err) => {
        log.warn("Falha ao carregar modelos de face", { message: err.message });
      });
  }

  // ─── Scheduled Tasks ───
  // Run cleanup + backup on startup
  cleanupExpiredAuthorizations();
  cleanupDemoAccounts();
  performBackup();

  // Every 6 hours: backup + cleanup (resilient to restarts)
  setInterval(() => {
    performBackup();
    cleanupExpiredAuthorizations();
    cleanupDemoAccounts();
    cleanupOldAuditLogs();
    cleanupVisitorQRShares();
    cleanupOldVisitors();
  }, 6 * 60 * 60 * 1000);

  // Every hour: expire authorizations
  setInterval(() => {
    cleanupExpiredAuthorizations();
  }, 60 * 60 * 1000);
});
