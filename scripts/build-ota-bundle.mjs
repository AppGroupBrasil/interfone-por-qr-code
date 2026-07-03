// Gera o bundle OTA (Capgo self-hosted): zipa dist/ e escreve manifest.json
// com checksum SHA-256 — o mesmo algoritmo que o plugin usa para validar o download.
import AdmZip from "adm-zip";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distDir = path.join(root, "dist");
const outDir = path.join(root, "ota-build");

if (!fs.existsSync(path.join(distDir, "index.html"))) {
  console.error("dist/index.html não encontrado — rode `npm run build` antes.");
  process.exit(1);
}

// Versão monotônica automática: 1.0.<UTC yyyymmddHHMM>
const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const stamp =
  `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
  `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}`;
const version = `1.0.${stamp}`;

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const zip = new AdmZip();
zip.addLocalFolder(distDir);
const zipPath = path.join(outDir, "bundle.zip");
zip.writeZip(zipPath);

const checksum = createHash("sha256").update(fs.readFileSync(zipPath)).digest("hex");
fs.writeFileSync(
  path.join(outDir, "manifest.json"),
  JSON.stringify({ version, checksum, builtAt: now.toISOString() }, null, 2)
);

const sizeMb = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
console.log(`OTA bundle ${version} gerado (${sizeMb} MB)`);
