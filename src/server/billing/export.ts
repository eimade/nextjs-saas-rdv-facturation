import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface InvoiceExportRow {
  number: string;
  issuedAt: Date;
  amountCents: number;
  status: "PAID" | "UNPAID";
  paidAt: Date | null;
  appointment: {
    startsAt: Date;
    service: { name: string };
    client: { name: string; email: string };
    membership: { user: { name: string } };
  };
}

export interface IssuerInfo {
  name: string;
  address: string | null;
  timezone: string;
  currency: string;
}

function isoDay(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function csvCell(value: string): string {
  return /[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Export CSV (séparateur « ; », BOM UTF-8 pour Excel, montants au format décimal point). */
export function invoicesToCsv(rows: InvoiceExportRow[], timeZone: string): string {
  const header = ["numero", "date_emission", "client", "email", "prestation", "praticien", "montant", "statut", "date_paiement"];
  const lines = rows.map((r) =>
    [
      r.number,
      isoDay(r.issuedAt, timeZone),
      r.appointment.client.name,
      r.appointment.client.email,
      r.appointment.service.name,
      r.appointment.membership.user.name,
      (r.amountCents / 100).toFixed(2),
      r.status === "PAID" ? "payee" : "impayee",
      r.paidAt ? isoDay(r.paidAt, timeZone) : "",
    ]
      .map(csvCell)
      .join(";"),
  );
  return "﻿" + [header.join(";"), ...lines].join("\r\n") + "\r\n";
}

/** Les polices standard PDF (WinAnsi) ne couvrent pas tous les alphabets : on remplace l'inencodable. */
export function toWinAnsi(text: string): string {
  return [...text]
    .map((ch) => {
      const code = ch.codePointAt(0)!;
      if (ch === "€") return ch;
      if (code === 0x202f || code === 0x00a0) return " ";
      return code >= 0x20 && code <= 0xff ? ch : "?";
    })
    .join("");
}

function money(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")} ${currency}`;
}

/** Génère la facture PDF (A4) d'une ligne de facturation. */
export async function buildInvoicePdf(invoice: InvoiceExportRow, issuer: IssuerInfo): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Facture ${invoice.number}`);
  pdf.setAuthor(toWinAnsi(issuer.name));
  pdf.setLanguage("fr-FR");
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const dark = rgb(0.1, 0.12, 0.16);
  const muted = rgb(0.35, 0.38, 0.45);
  const text = (value: string, x: number, y: number, size = 11, f = font, color = dark) =>
    page.drawText(toWinAnsi(value), { x, y, size, font: f, color });

  const day = (d: Date) => isoDay(d, issuer.timezone).split("-").reverse().join("/");

  text(issuer.name, 50, 780, 18, bold);
  if (issuer.address) text(issuer.address, 50, 760, 10, font, muted);
  text("FACTURE", 400, 780, 18, bold);
  text(`N° ${invoice.number}`, 400, 760, 11);
  text(`Date : ${day(invoice.issuedAt)}`, 400, 744, 11);

  text("Facturé à", 50, 700, 10, bold, muted);
  text(invoice.appointment.client.name, 50, 684, 12, bold);
  text(invoice.appointment.client.email, 50, 668, 10, font, muted);

  page.drawRectangle({ x: 50, y: 600, width: 495, height: 24, color: rgb(0.93, 0.95, 0.98) });
  text("Désignation", 58, 608, 10, bold);
  text("Montant", 470, 608, 10, bold);
  text(invoice.appointment.service.name, 58, 578, 11);
  text(
    `Séance du ${day(invoice.appointment.startsAt)} - ${invoice.appointment.membership.user.name}`,
    58,
    562,
    9,
    font,
    muted,
  );
  text(money(invoice.amountCents, issuer.currency), 470, 578, 11);
  page.drawLine({ start: { x: 50, y: 545 }, end: { x: 545, y: 545 }, thickness: 1, color: muted });
  text("Total TTC", 360, 522, 12, bold);
  text(money(invoice.amountCents, issuer.currency), 470, 522, 12, bold);

  const status = invoice.status === "PAID" && invoice.paidAt ? `Payée le ${day(invoice.paidAt)}` : "En attente de paiement";
  text(status, 50, 480, 11, bold, invoice.status === "PAID" ? rgb(0.05, 0.45, 0.2) : rgb(0.65, 0.15, 0.1));
  text("TVA non applicable, article 261-4-1° du CGI (actes de soins).", 50, 80, 8, font, muted);
  text("Document généré par Kalendo.", 50, 66, 8, font, muted);

  return pdf.save();
}
