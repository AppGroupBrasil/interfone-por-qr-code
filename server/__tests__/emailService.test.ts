import { describe, expect, it } from "vitest";

// Sem AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY o sesClient nem é criado, então
// importar o módulo aqui não manda e-mail nenhum.
const { podeAvisarChamadaPerdida } = await import("../emailService.js");

const MORADOR = 901;
const OUTRO = 902;
const JANELA_MS = 3 * 60 * 1000;

describe("podeAvisarChamadaPerdida", () => {
  it("avisa a primeira vez e cala nas insistências do visitante", () => {
    const t0 = Date.now();
    expect(podeAvisarChamadaPerdida(MORADOR, t0)).toBe(true);
    expect(podeAvisarChamadaPerdida(MORADOR, t0 + 1_000)).toBe(false);
    expect(podeAvisarChamadaPerdida(MORADOR, t0 + JANELA_MS - 1)).toBe(false);
  });

  it("volta a avisar depois da janela de 3 min", () => {
    const t0 = Date.now() + 1_000_000;
    expect(podeAvisarChamadaPerdida(MORADOR, t0)).toBe(true);
    expect(podeAvisarChamadaPerdida(MORADOR, t0 + JANELA_MS)).toBe(true);
  });

  it("o silêncio é por morador, não global", () => {
    const t0 = Date.now() + 2_000_000;
    expect(podeAvisarChamadaPerdida(MORADOR, t0)).toBe(true);
    expect(podeAvisarChamadaPerdida(OUTRO, t0)).toBe(true);
    expect(podeAvisarChamadaPerdida(OUTRO, t0 + 1_000)).toBe(false);
  });
});
