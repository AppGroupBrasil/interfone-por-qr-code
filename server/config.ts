import "dotenv/config";

const isProd = process.env.NODE_ENV === "production";

const DEV_JWT_FALLBACK = "dev-secret-change-in-production-32chars!!";

function readJwtSecret(): string {
  const v = process.env.JWT_SECRET;
  if (!v || v === DEV_JWT_FALLBACK) {
    if (isProd) {
      console.error("FATAL: JWT_SECRET ausente ou usando valor de desenvolvimento em produção.");
      process.exit(1);
    }
    return DEV_JWT_FALLBACK;
  }
  if (v.length < 32) {
    if (isProd) {
      console.error("FATAL: JWT_SECRET deve ter pelo menos 32 caracteres em produção.");
      process.exit(1);
    }
    console.warn("[CONFIG] JWT_SECRET curto — use ≥32 chars em produção.");
  }
  return v;
}

export const JWT_SECRET = readJwtSecret();
export const NODE_ENV = process.env.NODE_ENV || "development";
export const IS_PROD = isProd;

// Demo mode — quando ativo, cria condomínio + contas demo no startup e
// rotas /api/auth/demo retornam acesso a essas contas. Default: off em prod.
export const DEMO_MODE = (process.env.DEMO_MODE ?? (isProd ? "false" : "true")) === "true";

// Cria automaticamente "Morador Exemplo" + "Porteiro Exemplo" no cadastro
// de condomínio. Útil em onboarding; desativar em produção real.
export const SAMPLE_ACCOUNTS_ON_REGISTER = (process.env.SAMPLE_ACCOUNTS_ON_REGISTER ?? (isProd ? "false" : "true")) === "true";

// Origens permitidas via CORS (CSV). Em dev, rede local 192.168/10/172.16-31 é sempre aceita.
export const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ||
  "http://localhost:5173,https://localhost:5173,http://localhost:3001,https://appinterfone.com.br,https://www.appinterfone.com.br,capacitor://localhost,http://localhost"
).split(",").map(s => s.trim()).filter(Boolean);
