import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { findPublicTenant, getAvailableSlots } from "@/server/booking/booking-service";
import { DomainError } from "@/server/errors";
import { firstIssue } from "@/lib/validation";
import { localDay } from "@/lib/time";

export const runtime = "nodejs";

/**
 * GET /api/public/:slug/slots?serviceId=…&membershipId=…&from=YYYY-MM-DD
 * Créneaux disponibles (même logique que la page de réservation), utilisable par un widget tiers.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await findPublicTenant(slug);
  if (!tenant) return NextResponse.json({ error: "notFound" }, { status: 404 });
  const sp = req.nextUrl.searchParams;
  try {
    const days = await getAvailableSlots(tenant, {
      serviceId: sp.get("serviceId") ?? "",
      membershipId: sp.get("membershipId") ?? "",
      fromDay: sp.get("from") ?? localDay(new Date(), tenant.timezone),
    });
    return NextResponse.json({ tenant: tenant.slug, timezone: tenant.timezone, days });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: firstIssue(error) }, { status: 400 });
    if (error instanceof DomainError) return NextResponse.json({ error: error.code }, { status: 404 });
    throw error;
  }
}
