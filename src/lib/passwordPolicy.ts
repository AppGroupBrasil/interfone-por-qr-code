// Política de senha — espelha server/passwordPolicy.ts.

export interface PinCheckResult {
  ok: boolean;
  error?: string;
}

export function checkPin(password: string): PinCheckResult {
  if (!/^\d{6}$/.test(password)) {
    return { ok: false, error: "Senha deve ter exatamente 6 dígitos numéricos." };
  }
  return { ok: true };
}
