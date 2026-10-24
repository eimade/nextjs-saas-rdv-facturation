import { randomBytes } from "node:crypto";
import { systemDb } from "@/server/db";
import type { TenantContext } from "@/server/context";
import { signupCabinet } from "@/server/tenancy/tenancy-service";
import { createService } from "@/server/tenancy/tenancy-service";
import { setWeeklyAvailability } from "@/server/booking/agenda-service";
import { findPublicTenant, type PublicTenant } from "@/server/booking/booking-service";

export function uid(): string {
  return randomBytes(4).toString("hex");
}

export async function contextFor(userId: string): Promise<TenantContext> {
  const m = await systemDb.membership.findUniqueOrThrow({
    where: { userId },
    include: { tenant: true, user: true },
  });
  return {
    tenantId: m.tenantId,
    tenantSlug: m.tenant.slug,
    tenantName: m.tenant.name,
    timezone: m.tenant.timezone,
    currency: m.tenant.currency,
    userId: m.userId,
    userName: m.user.name,
    membershipId: m.id,
    role: m.role,
  };
}

export interface TestCabinet {
  owner: TenantContext;
  tenant: PublicTenant;
  serviceId: string;
}

/** Cabinet de test : propriétaire disponible 7 j/7, 24 h/24, et une prestation de 30 min à 40 €. */
export async function createCabinet(label = "test"): Promise<TestCabinet> {
  const id = uid();
  const { userId } = await signupCabinet({
    cabinetName: `Cabinet ${label} ${id}`,
    slug: `${label}-${id}`,
    ownerName: `Praticien ${label}`,
    email: `owner-${id}@test.kalendo.local`,
    password: "Password123!",
  });
  const owner = await contextFor(userId);
  const service = await createService(owner, { name: "Consultation", durationMin: 30, price: 40 });
  await setWeeklyAvailability(owner, {
    membershipId: owner.membershipId,
    rules: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start: "00:00", end: "24:00" })),
  });
  const tenant = (await findPublicTenant(owner.tenantSlug))!;
  return { owner, tenant, serviceId: service.id };
}

export function bookingInput(c: TestCabinet, startsAt: string, email = `patient-${uid()}@example.com`) {
  return {
    serviceId: c.serviceId,
    membershipId: c.owner.membershipId,
    startsAt,
    name: "Patient Test",
    email,
    locale: "fr",
  };
}
