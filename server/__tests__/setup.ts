import fs from "fs";
import os from "os";
import path from "path";
import { afterAll } from "vitest";

// Roda antes dos imports do arquivo de teste: db.ts lê DB_PATH no topo do
// módulo, então o banco descartável precisa estar definido aqui. Um arquivo
// por arquivo de teste — o db é singleton de módulo e não pode ser dividido.
const dbFile = path.join(os.tmpdir(), `appinterfone-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
process.env.DB_PATH = dbFile;
process.env.JWT_SECRET ||= "test-secret";

afterAll(() => {
  for (const f of [dbFile, `${dbFile}-wal`, `${dbFile}-shm`]) {
    try { fs.rmSync(f, { force: true }); } catch { /* o SO limpa o tmp */ }
  }
});
