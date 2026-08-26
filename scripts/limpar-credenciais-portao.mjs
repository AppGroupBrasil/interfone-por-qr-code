/**
 * Remove as credenciais eWeLink gravadas em texto plano na tabela system_config.
 *
 * O portão está desligado na v1 (ver docs/portao-desativado.md). Enquanto as
 * chaves continuarem no banco, qualquer leitura indevida do arquivo entrega o
 * acesso à conta eWeLink que controla as cancelas.
 *
 * Uso:
 *   node scripts/limpar-credenciais-portao.mjs            # relatório (dry-run)
 *   node scripts/limpar-credenciais-portao.mjs --apply    # apaga de fato
 *   DB_PATH=/app/data/data.db node scripts/... --apply    # dentro do container
 */
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "data.db");
const apply = process.argv.includes("--apply");

const KEYS = [
  "gate_ewelink_appid",
  "gate_ewelink_appsecret",
  "gate_ewelink_email",
  "gate_ewelink_password",
  "gate_ewelink_access_token",
  "gate_ewelink_refresh_token",
  "gate_ewelink_token_expires",
  "gate_ewelink_token_region",
  "gate_ewelink_region",
];

const db = new Database(dbPath);
const placeholders = KEYS.map(() => "?").join(",");
const found = db.prepare(`SELECT key FROM system_config WHERE key IN (${placeholders})`).all(...KEYS);

if (found.length === 0) {
  console.log(`[portao] nenhuma credencial eWeLink em ${dbPath}`);
} else {
  console.log(`[portao] ${found.length} chave(s) em ${dbPath}: ${found.map((r) => r.key).join(", ")}`);
  if (apply) {
    const info = db.prepare(`DELETE FROM system_config WHERE key IN (${placeholders})`).run(...KEYS);
    console.log(`[portao] removidas ${info.changes} chave(s).`);
  } else {
    console.log("[portao] dry-run. Rode com --apply para remover.");
  }
}
db.close();
