export type DocTipo = "cpf" | "cnpj";

export const DOC_LABEL: Record<DocTipo, string> = { cpf: "CPF", cnpj: "CNPJ" };
export const DOC_PLACEHOLDER: Record<DocTipo, string> = {
  cpf: "000.000.000-00",
  cnpj: "00.000.000/0000-00",
};
export const DOC_LENGTH: Record<DocTipo, number> = { cpf: 11, cnpj: 14 };

export const onlyDigits = (value: string) => value.replace(/\D/g, "");

export function formatCpf(value: string) {
  const n = onlyDigits(value).slice(0, 11);
  if (n.length <= 3) return n;
  if (n.length <= 6) return `${n.slice(0, 3)}.${n.slice(3)}`;
  if (n.length <= 9) return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6)}`;
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9, 11)}`;
}

export function formatCnpj(value: string) {
  const n = onlyDigits(value).slice(0, 14);
  if (n.length <= 2) return n;
  if (n.length <= 5) return `${n.slice(0, 2)}.${n.slice(2)}`;
  if (n.length <= 8) return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5)}`;
  if (n.length <= 12) return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8)}`;
  return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12, 14)}`;
}

export const formatDocTipo = (value: string, tipo: DocTipo) =>
  tipo === "cpf" ? formatCpf(value) : formatCnpj(value);

/** Formata um documento já gravado, deduzindo o tipo pelo tamanho. */
export function formatDoc(value: string | null | undefined) {
  const n = onlyDigits(value ?? "");
  if (!n) return "";
  return n.length <= 11 ? formatCpf(n) : formatCnpj(n);
}

export const docTipoOf = (value: string | null | undefined): DocTipo =>
  onlyDigits(value ?? "").length <= 11 ? "cpf" : "cnpj";

export const docLabelOf = (value: string | null | undefined) => DOC_LABEL[docTipoOf(value)];

export const isDocCompleto = (value: string, tipo: DocTipo) =>
  onlyDigits(value).length === DOC_LENGTH[tipo];

export const docLabelFinal = (value: string | null | undefined) => {
  const n = onlyDigits(value ?? "").length;
  if (n === DOC_LENGTH.cpf) return DOC_LABEL.cpf;
  if (n === DOC_LENGTH.cnpj) return DOC_LABEL.cnpj;
  return "";
};
