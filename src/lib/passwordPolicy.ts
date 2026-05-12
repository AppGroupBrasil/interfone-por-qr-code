// Política de senha — espelha server/passwordPolicy.ts.
// Mantenha as duas listas em sincronia.

const WEAK_PINS = new Set<string>([
  "000000", "111111", "222222", "333333", "444444",
  "555555", "666666", "777777", "888888", "999999",
  "123456", "654321", "012345", "543210",
  "123123", "321321", "112233", "121212", "212121",
  "100000", "101010", "010101", "987654", "456789",
]);

export interface PinCheckResult {
  ok: boolean;
  error?: string;
}

export function checkPin(password: string): PinCheckResult {
  if (!/^\d{6}$/.test(password)) {
    return { ok: false, error: "Senha deve ter exatamente 6 dígitos numéricos." };
  }
  if (WEAK_PINS.has(password)) {
    return { ok: false, error: "Senha muito comum. Escolha 6 dígitos menos óbvios." };
  }
  return { ok: true };
}
