import { NextResponse } from "next/server";
import { getTenantContext } from "@/server/session";
import { getInvoice } from "@/server/billing/billing-service";
import { buildInvoicePdf } from "@/server/billing/export";
import { systemDb } from "@/server/db";
import { DomainError } from "@/server/errors";

export const runtime = "nodejs";

/** GET /api/invoices/:id/pdf : facture PDF (404 si la facture n'appartient pas au tenant courant). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;
  try {
    const invoice = await getInvoice(ctx, id);
    const tenant = await systemDb.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } });
    const pdf = await buildInvoicePdf(invoice, {
      name: tenant.name,
      address: tenant.address,
      timezone: tenant.timezone,
      currency: tenant.currency,
    });
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="facture-${invoice.number}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof DomainError) {
      const status = error.code === "forbidden" ? 403 : 404;
      return NextResponse.json({ error: error.code }, { status });
    }
    throw error;
  }
}
