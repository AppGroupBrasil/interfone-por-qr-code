// Política mínima de senha — 6 dígitos numéricos, sem blocklist.
// Compatível com base existente (moradores idosos usam PIN).

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
  return { ok: true };
}
