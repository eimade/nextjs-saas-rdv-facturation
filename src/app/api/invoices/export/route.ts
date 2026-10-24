import { NextResponse, type NextRequest } from "next/server";
import { getTenantContext } from "@/server/session";
import { listInvoices } from "@/server/billing/billing-service";
import { invoicesToCsv } from "@/server/billing/export";
import { DomainError } from "@/server/errors";

export const runtime = "nodejs";

/** GET /api/invoices/export?status=PAID|UNPAID : export CSV des factures du tenant courant. */
export async function GET(req: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const raw = req.nextUrl.searchParams.get("status");
  const status = raw === "PAID" || raw === "UNPAID" ? raw : undefined;
  try {
    const rows = await listInvoices(ctx, status);
    const csv = invoicesToCsv(rows, ctx.timezone);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="factures-${ctx.tenantSlug}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof DomainError) return NextResponse.json({ error: error.code }, { status: 403 });
    throw error;
  }
}
