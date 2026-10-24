/** Format de numéro de facture : F-AAAA-NNNN, séquence continue par tenant et par année. */
export function formatInvoiceNumber(year: number, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) throw new Error("Séquence de facture invalide");
  return `F-${year}-${String(sequence).padStart(4, "0")}`;
}

export function parseInvoiceNumber(number: string): { year: number; sequence: number } | null {
  const m = /^F-(\d{4})-(\d{4,})$/.exec(number);
  return m ? { year: Number(m[1]), sequence: Number(m[2]) } : null;
}
