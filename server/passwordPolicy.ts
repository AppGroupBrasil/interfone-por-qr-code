// Política mínima de senha — 6 dígitos numéricos com blocklist de PINs triviais.
// Compatível com base existente (moradores idosos usam PIN).

const WEAK_PINS = new Set<string>([
  "000000", "111111", "222222", "333333", "444444",
  "555555", "666666", "777777", "888888", "999999",
  "654321", "012345", "543210",
  "123123", "321321", "112233", "121212", "212121",
  "100000", "101010", "010101", "987654", "456789",
]);

export interface PasswordCheckResult {
  ok: boolean;
  error?: string;
}

/** Helper para uso em rotas Express. Retorna true se OK, false se já respondeu com 400. */
export function validatePin(password: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }): boolean {
  const r = checkNumericPin(password);
  if (!r.ok) { res.status(400).json({ error: r.error }); return false; }
  return true;
}

export function checkNumericPin(password: unknown): PasswordCheckResult {
  if (typeof password !== "string") {
    return { ok: false, error: "Senha inválida." };
  }
  if (!/^\d{6}$/.test(password)) {
    return { ok: false, error: "Senha deve ter exatamente 6 dígitos numéricos." };
  }
  if (WEAK_PINS.has(password)) {
    return { ok: false, error: "Senha muito comum. Escolha 6 dígitos menos óbvios." };
  }
  return { ok: true };
}
