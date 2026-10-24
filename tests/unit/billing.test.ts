import { describe, expect, it } from "vitest";
import { formatInvoiceNumber, parseInvoiceNumber } from "@/server/billing/numbering";
import { buildInvoicePdf, invoicesToCsv, toWinAnsi, type InvoiceExportRow } from "@/server/billing/export";

const row: InvoiceExportRow = {
  number: "F-2026-0007",
  issuedAt: new Date("2026-10-20T10:00:00Z"),
  amountCents: 3500,
  status: "PAID",
  paidAt: new Date("2026-10-21T10:00:00Z"),
  appointment: {
    startsAt: new Date("2026-10-20T08:00:00Z"),
    service: { name: "Séance; kiné" },
    client: { name: 'Léa "LF" Fournier', email: "lea@example.com" },
    membership: { user: { name: "Claire Martin" } },
  },
};

describe("numérotation des factures", () => {
  it("formate F-AAAA-NNNN et relit le numéro", () => {
    expect(formatInvoiceNumber(2026, 7)).toBe("F-2026-0007");
    expect(formatInvoiceNumber(2026, 12345)).toBe("F-2026-12345");
    expect(parseInvoiceNumber("F-2026-0042")).toEqual({ year: 2026, sequence: 42 });
    expect(parseInvoiceNumber("X-1")).toBeNull();
  });

  it("refuse une séquence invalide", () => {
    expect(() => formatInvoiceNumber(2026, 0)).toThrow();
    expect(() => formatInvoiceNumber(2026, 1.5)).toThrow();
  });
});

describe("export CSV", () => {
  it("produit un CSV « ; » avec BOM, échappement et montants décimaux", () => {
    const csv = invoicesToCsv([row], "Europe/Paris");
    expect(csv.startsWith("﻿numero;date_emission")).toBe(true);
    const line = csv.split("\r\n")[1];
    expect(line).toBe(
      'F-2026-0007;2026-10-20;"Léa ""LF"" Fournier";lea@example.com;"Séance; kiné";Claire Martin;35.00;payee;2026-10-21',
    );
  });
});

describe("PDF de facture", () => {
  it("génère un PDF valide", async () => {
    const bytes = await buildInvoicePdf(row, { name: "Cabinet Test", address: null, timezone: "Europe/Paris", currency: "EUR" });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("remplace les caractères non encodables par les polices standard", () => {
    expect(toWinAnsi("Clinique ابن")).toBe("Clinique ???");
    expect(toWinAnsi("45,00 €")).toBe("45,00 €");
  });
});
