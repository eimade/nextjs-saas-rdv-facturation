import { addDays, localDay, zonedToUtc } from "@/lib/time";
import { bookingSchema, slotsQuerySchema } from "@/lib/validation";
import { isOverlapViolation, systemDb, withTenant, type Tx } from "@/server/db";
import { DomainError, NotFoundError } from "@/server/errors";
import { computeSlots, type BusyInterval } from "@/server/booking/slots";

export const BOOKING_WINDOW_DAYS = 14;
export const BOOKABLE_ROLES = ["OWNER", "PRACTITIONER"] as const;

export interface PublicTenant {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  currency: string;
  address: string | null;
}

/** Résolution publique d'un cabinet (table tenants : non soumise à RLS). */
export async function findPublicTenant(slug: string): Promise<PublicTenant | null> {
  return systemDb.tenant.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, timezone: true, currency: true, address: true },
  });
}

/** Prestations actives et praticiens réservables (ayant au moins une plage de disponibilité). */
export async function getBookingCatalog(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    const [services, practitioners] = await Promise.all([
      tx.service.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, durationMin: true, priceCents: true },
      }),
      tx.membership.findMany({
        where: { role: { in: [...BOOKABLE_ROLES] }, availability: { some: {} } },
        orderBy: { user: { name: "asc" } },
        select: { id: true, user: { select: { name: true } } },
      }),
    ]);
    return {
      services,
      practitioners: practitioners.map((p) => ({ id: p.id, name: p.user.name })),
    };
  });
}

async function loadBusy(tx: Tx, membershipId: string, from: Date, to: Date): Promise<BusyInterval[]> {
  const [appointments, absences] = await Promise.all([
    tx.appointment.findMany({
      where: { membershipId, status: { not: "CANCELLED" }, startsAt: { lt: to }, endsAt: { gt: from } },
      select: { startsAt: true, endsAt: true },
    }),
    tx.absence.findMany({
      where: { membershipId, startsAt: { lt: to }, endsAt: { gt: from } },
      select: { startsAt: true, endsAt: true },
    }),
  ]);
  return [...appointments, ...absences];
}

async function loadBookable(tx: Tx, serviceId: string, membershipId: string) {
  const [service, practitioner] = await Promise.all([
    tx.service.findFirst({ where: { id: serviceId, active: true } }),
    tx.membership.findFirst({
      where: { id: membershipId, role: { in: [...BOOKABLE_ROLES] } },
      include: { availability: true },
    }),
  ]);
  if (!service || !practitioner) throw new NotFoundError();
  return { service, practitioner };
}

export interface DaySlots {
  day: string;
  slots: string[];
}

/** Créneaux libres sur la fenêtre de réservation, jour par jour (une seule lecture en base). */
export async function getAvailableSlots(
  tenant: PublicTenant,
  input: unknown,
  now = new Date(),
): Promise<DaySlots[]> {
  const q = slotsQuerySchema.parse(input);
  const today = localDay(now, tenant.timezone);
  const fromDay = q.fromDay < today ? today : q.fromDay;
  const lastDay = addDays(today, BOOKING_WINDOW_DAYS - 1);
  if (fromDay > lastDay) return [];

  return withTenant(tenant.id, async (tx) => {
    const { service, practitioner } = await loadBookable(tx, q.serviceId, q.membershipId);
    const rangeStart = zonedToUtc(fromDay, 0, tenant.timezone);
    const rangeEnd = zonedToUtc(addDays(lastDay, 1), 0, tenant.timezone);
    const busy = await loadBusy(tx, practitioner.id, rangeStart, rangeEnd);

    const days: DaySlots[] = [];
    for (let day = fromDay; day <= lastDay; day = addDays(day, 1)) {
      const slots = computeSlots({
        day,
        timezone: tenant.timezone,
        durationMin: service.durationMin,
        rules: practitioner.availability,
        busy,
        now,
      });
      days.push({ day, slots: slots.map((s) => s.toISOString()) });
    }
    return days;
  });
}

export interface BookingResult {
  appointmentId: string;
  startsAt: string;
  serviceName: string;
  practitionerName: string;
}

/**
 * Réservation publique. Le créneau est revérifié côté serveur ; la contrainte
 * d'exclusion PostgreSQL tranche les réservations concurrentes sur le même créneau.
 */
export async function bookAppointment(
  tenant: PublicTenant,
  input: unknown,
  now = new Date(),
): Promise<BookingResult> {
  const data = bookingSchema.parse(input);
  const startsAt = new Date(data.startsAt);

  try {
    return await withTenant(tenant.id, async (tx) => {
      const { service, practitioner } = await loadBookable(tx, data.serviceId, data.membershipId);
      const day = localDay(startsAt, tenant.timezone);
      const endsAt = new Date(startsAt.getTime() + service.durationMin * 60000);
      const busy = await loadBusy(tx, practitioner.id, startsAt, endsAt);
      const valid = computeSlots({
        day,
        timezone: tenant.timezone,
        durationMin: service.durationMin,
        rules: practitioner.availability,
        busy,
        now,
      }).some((s) => s.getTime() === startsAt.getTime());
      if (!valid) throw new DomainError("slotUnavailable");

      const client = await tx.client.upsert({
        where: { tenantId_email: { tenantId: tenant.id, email: data.email } },
        create: { tenantId: tenant.id, name: data.name, email: data.email, phone: data.phone, locale: data.locale },
        update: { name: data.name, phone: data.phone, locale: data.locale },
      });
      const appointment = await tx.appointment.create({
        data: {
          tenantId: tenant.id,
          membershipId: practitioner.id,
          serviceId: service.id,
          clientId: client.id,
          startsAt,
          endsAt,
        },
        include: { membership: { include: { user: { select: { name: true } } } } },
      });
      return {
        appointmentId: appointment.id,
        startsAt: appointment.startsAt.toISOString(),
        serviceName: service.name,
        practitionerName: appointment.membership.user.name,
      };
    });
  } catch (error) {
    if (isOverlapViolation(error)) throw new DomainError("slotUnavailable");
    throw error;
  }
}
