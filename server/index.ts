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
import faceRouter from "./faceRoutes.js";
import gateRouter from "./gateRoutes.js";
import whatsappRouter from "./whatsappRoutes.js";
import { loadModels as loadFaceModels } from "./faceService.js";
import { performBackup, cleanupDemoAccounts, cleanupExpiredAuthorizations, cleanupOldAuditLogs, cleanupVisitorQRShares, cleanupOldVisitors } from "./db.js";
import { authenticate, authorize } from "./middleware.js";
import { ALLOWED_ORIGINS, IS_PROD } from "./config.js";
import { log } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// JWT_SECRET validado em ./config.ts — falha-fast no import.

const app = express();
const PORT = parseInt(process.env.PORT || "3001");

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
app.use("/api/visitors", visitorsRouter);
app.use("/api/pre-authorizations", preAuthRouter);
app.use("/api/delivery-authorizations", deliveryRouter);
app.use("/api/vehicle-authorizations", vehicleRouter);
app.use("/api/condominio-config", condominioConfigRouter);
app.use("/api/correspondencias", correspondenciasRouter);
app.use("/api/livro-protocolo", livroProtocoloRouter);
app.use("/api/cameras", camerasRouter);
app.use("/api/rondas", rondasRouter);
app.use("/api/interfone", interfoneRouter);
app.use("/api/device-tokens", deviceTokensRouter);
app.use("/api/visitor-qr", visitorQRShareRouter);
app.use("/api/face", faceRouter);
app.use("/api/gate", gateRouter);
app.use("/api/whatsapp", whatsappRouter);

// Test routes — only available in development
if (process.env.NODE_ENV !== "production") {
  import("./testRoutes.js").then((m) => {
    app.use("/api/test", m.default);
    console.log("  🧪 Test routes enabled (dev only)");
  });
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
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

// Readiness
app.get("/api/ready", (_req, res) => {
  res.json({ status: "ready", uptime: process.uptime() });
});

server.listen(PORT, "0.0.0.0", () => {
  log.info(`HTTP escutando em 0.0.0.0:${PORT}`, { env: process.env.NODE_ENV });

  loadFaceModels().then(() => {
    log.info("Modelos de reconhecimento facial carregados");
  }).catch((err) => {
    log.warn("Falha ao carregar modelos de face", { message: err.message });
  });

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
