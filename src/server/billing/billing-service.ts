import { invoiceStatusSchema } from "@/lib/validation";
import { isUniqueViolation, withTenant, type Tx } from "@/server/db";
import type { TenantContext } from "@/server/context";
import { DomainError, NotFoundError } from "@/server/errors";
import { formatInvoiceNumber } from "@/server/billing/numbering";
import { assertCan } from "@/server/tenancy/permissions";

/**
 * Réserve atomiquement le prochain numéro de facture du tenant pour l'année.
 * INSERT … ON CONFLICT DO UPDATE verrouille la ligne compteur : deux transactions
 * concurrentes obtiennent des numéros distincts et consécutifs, sans trou.
 */
export async function nextInvoiceNumber(tx: Tx, tenantId: string, year: number): Promise<string> {
  const rows = await tx.$queryRaw<{ last: number }[]>`
    INSERT INTO invoice_counters (tenant_id, year, last)
    VALUES (${tenantId}, ${year}, 1)
    ON CONFLICT (tenant_id, year) DO UPDATE SET last = invoice_counters.last + 1
    RETURNING last`;
  return formatInvoiceNumber(year, Number(rows[0].last));
}

function yearIn(date: Date, timeZone: string): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric" }).format(date));
}

/** Génère la facture d'un rendez-vous honoré (une seule facture par rendez-vous). */
export async function createInvoiceFromAppointment(ctx: TenantContext, appointmentId: string, now = new Date()) {
  assertCan(ctx.role, "billing:manage");
  try {
    return await withTenant(ctx.tenantId, async (tx) => {
      const appt = await tx.appointment.findFirst({
        where: { id: appointmentId },
        include: { service: true, invoice: true },
      });
      if (!appt) throw new NotFoundError();
      if (appt.status !== "COMPLETED") throw new DomainError("appointmentNotCompleted");
      if (appt.invoice) throw new DomainError("alreadyInvoiced");
      const number = await nextInvoiceNumber(tx, ctx.tenantId, yearIn(now, ctx.timezone));
      return tx.invoice.create({
        data: {
          tenantId: ctx.tenantId,
          appointmentId: appt.id,
          number,
          amountCents: appt.service.priceCents,
          issuedAt: now,
        },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError("alreadyInvoiced");
    throw error;
  }
}

export async function setInvoiceStatus(ctx: TenantContext, input: unknown, now = new Date()) {
  assertCan(ctx.role, "billing:manage");
  const { invoiceId, status } = invoiceStatusSchema.parse(input);
  return withTenant(ctx.tenantId, async (tx) => {
    const invoice = await tx.invoice.findFirst({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundError();
    return tx.invoice.update({
      where: { id: invoice.id },
      data: { status, paidAt: status === "PAID" ? now : null },
    });
  });
}

const invoiceSelect = {
  id: true,
  number: true,
  amountCents: true,
  status: true,
  issuedAt: true,
  paidAt: true,
  appointment: {
    select: {
      startsAt: true,
      service: { select: { name: true } },
      client: { select: { name: true, email: true } },
      membership: { select: { user: { select: { name: true } } } },
    },
  },
} as const;

export async function listInvoices(ctx: TenantContext, status?: "PAID" | "UNPAID") {
  assertCan(ctx.role, "billing:manage");
  return withTenant(ctx.tenantId, (tx) =>
    tx.invoice.findMany({
      where: status ? { status } : {},
      orderBy: { number: "desc" },
      select: invoiceSelect,
    }),
  );
}

export type InvoiceRow = Awaited<ReturnType<typeof listInvoices>>[number];

export async function getInvoice(ctx: TenantContext, invoiceId: string): Promise<InvoiceRow> {
  assertCan(ctx.role, "billing:manage");
  const invoice = await withTenant(ctx.tenantId, (tx) =>
    tx.invoice.findFirst({ where: { id: invoiceId }, select: invoiceSelect }),
  );
  if (!invoice) throw new NotFoundError();
  return invoice;
}

/** Rendez-vous honorés pas encore facturés (pour l'écran Facturation). */
export async function listBillableAppointments(ctx: TenantContext) {
  assertCan(ctx.role, "billing:manage");
  return withTenant(ctx.tenantId, (tx) =>
    tx.appointment.findMany({
      where: { status: "COMPLETED", invoice: null },
      orderBy: { startsAt: "desc" },
      take: 50,
      select: {
        id: true,
        startsAt: true,
        service: { select: { name: true, priceCents: true } },
        client: { select: { name: true } },
      },
    }),
  );
}
