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
import { performBackup, cleanupDemoAccounts, cleanupExpiredAuthorizations, cleanupOldAuditLogs } from "./db.js";
import { authenticate, authorize } from "./middleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Validate critical env vars in production ───
if (process.env.NODE_ENV === "production") {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "dev-secret-change-in-production-32chars!!") {
    console.error("FATAL: JWT_SECRET must be set to a strong secret in production. Exiting.");
    process.exit(1);
  }
}

const app = express();
const PORT = parseInt(process.env.PORT || "3001");

// Middleware

// Security headers (helmet)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
      connectSrc: ["'self'", "wss:", "ws:", "https:", "http:"],
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

// CORS — restrito a origens conhecidas
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://localhost:5173",
  "http://localhost:3001",
  "https://appinterfone.com.br",
  "https://www.appinterfone.com.br",
  "capacitor://localhost",
  "http://localhost",
];

// Aceitar qualquer origem da rede local (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
const isLocalNetworkOrigin = (origin: string): boolean => {
  try {
    const url = new URL(origin);
    const host = url.hostname;
    return /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
  } catch { return false; }
};
app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sem origin (mobile apps, curl, etc)
    if (!origin || ALLOWED_ORIGINS.includes(origin) || isLocalNetworkOrigin(origin || "")) {
      callback(null, true);
    } else {
      callback(null, false);
    }
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
    const ip = ipKeyGenerator(req);
    return `${ip}:${email}`;
  },
  validate: { xForwardedForHeader: false, ip: false },
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

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
app.use("/api/auth", authRouter);
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
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Erro interno do servidor." });
});

// Start
const server = http.createServer(app);
initSignalingServer(server);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n  🚀 App Interfone running at http://0.0.0.0:${PORT}`);
  console.log(`  📦 API: http://localhost:${PORT}/api\n`);

  // Carregar modelos de reconhecimento facial em background
  loadFaceModels().then(() => {
    console.log("  🧠 Face recognition models loaded\n");
  }).catch((err) => {
    console.error("  ⚠️  Face models failed to load:", err.message);
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
  }, 6 * 60 * 60 * 1000);

  // Every hour: expire authorizations
  setInterval(() => {
    cleanupExpiredAuthorizations();
  }, 60 * 60 * 1000);
});
