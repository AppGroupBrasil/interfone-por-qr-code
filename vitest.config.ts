import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // O servidor é ESM/NodeNext: os imports carregam ".js" apontando para o
    // ".ts" ao lado. Tirar a extensão deixa o resolver do Vite achar a fonte.
    alias: [{ find: /^(\.{1,2}\/.*)\.js$/, replacement: "$1" }],
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts"],
    setupFiles: ["server/__tests__/setup.ts"],
    // Cada arquivo tem o seu banco: rodar em paralelo no mesmo processo faria
    // dois testes abrirem o mesmo db.ts (singleton de módulo).
    fileParallelism: false,
    testTimeout: 15000,
  },
});
