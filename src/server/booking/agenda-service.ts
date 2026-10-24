import { addDays, hhmmToMinutes, zonedToUtc } from "@/lib/time";
import { absenceSchema, appointmentStatusSchema, availabilitySchema, daySchema } from "@/lib/validation";
import { isOverlapViolation, withTenant } from "@/server/db";
import type { TenantContext } from "@/server/context";
import { DomainError, NotFoundError } from "@/server/errors";
import { BOOKABLE_ROLES } from "@/server/booking/booking-service";
import { assertCan, canActOnPractitioner, can, ForbiddenError } from "@/server/tenancy/permissions";

/** Praticiens visibles par l'utilisateur (tous, ou lui seul s'il est praticien). */
export async function listPractitioners(ctx: TenantContext) {
  return withTenant(ctx.tenantId, async (tx) => {
    const rows = await tx.membership.findMany({
      where: {
        role: { in: [...BOOKABLE_ROLES] },
        ...(can(ctx.role, "agenda:viewAll") ? {} : { id: ctx.membershipId }),
      },
      orderBy: { user: { name: "asc" } },
      select: { id: true, role: true, user: { select: { name: true } } },
    });
    return rows.map((r) => ({ id: r.id, role: r.role, name: r.user.name }));
  });
}

export interface AgendaQuery {
  fromDay: string;
  days: number;
  membershipId?: string;
}

export async function listAppointments(ctx: TenantContext, query: AgendaQuery) {
  const fromDay = daySchema.parse(query.fromDay);
  const from = zonedToUtc(fromDay, 0, ctx.timezone);
  const to = zonedToUtc(addDays(fromDay, query.days), 0, ctx.timezone);
  let membershipFilter: string | undefined = query.membershipId;
  if (!can(ctx.role, "agenda:viewAll")) membershipFilter = ctx.membershipId;

  return withTenant(ctx.tenantId, (tx) =>
    tx.appointment.findMany({
      where: {
        startsAt: { gte: from, lt: to },
        ...(membershipFilter ? { membershipId: membershipFilter } : {}),
      },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        status: true,
        membershipId: true,
        service: { select: { name: true, priceCents: true } },
        client: { select: { name: true, email: true, phone: true } },
        membership: { select: { user: { select: { name: true } } } },
        invoice: { select: { id: true, number: true } },
      },
    }),
  );
}

export async function updateAppointmentStatus(ctx: TenantContext, input: unknown) {
  assertCan(ctx.role, "appointments:update");
  const { appointmentId, status } = appointmentStatusSchema.parse(input);
  try {
    return await withTenant(ctx.tenantId, async (tx) => {
      const appt = await tx.appointment.findFirst({ where: { id: appointmentId }, include: { invoice: true } });
      if (!appt) throw new NotFoundError();
      if (!canActOnPractitioner(ctx, appt.membershipId)) throw new ForbiddenError();
      if (appt.invoice) throw new DomainError("appointmentInvoiced");
      return tx.appointment.update({ where: { id: appt.id }, data: { status } });
    });
  } catch (error) {
    // Réactiver un RDV annulé dont le créneau a été repris
    if (isOverlapViolation(error)) throw new DomainError("slotUnavailable");
    throw error;
  }
}

export async function getAvailability(ctx: TenantContext, membershipId: string) {
  if (!canActOnPractitioner(ctx, membershipId)) throw new ForbiddenError();
  return withTenant(ctx.tenantId, async (tx) => {
    const member = await tx.membership.findFirst({
      where: { id: membershipId, role: { in: [...BOOKABLE_ROLES] } },
      select: { id: true, user: { select: { name: true } } },
    });
    if (!member) throw new NotFoundError();
    const [rules, absences] = await Promise.all([
      tx.availability.findMany({
        where: { membershipId },
        orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
      }),
      tx.absence.findMany({
        where: { membershipId, endsAt: { gt: new Date() } },
        orderBy: { startsAt: "asc" },
      }),
    ]);
    return { member: { id: member.id, name: member.user.name }, rules, absences };
  });
}

function assertManageAvailability(ctx: TenantContext, membershipId: string) {
  if (!can(ctx.role, "availability:manageAll") && ctx.membershipId !== membershipId) throw new ForbiddenError();
}

/** Remplace l'ensemble des plages hebdomadaires d'un praticien. */
export async function setWeeklyAvailability(ctx: TenantContext, input: unknown) {
  const data = availabilitySchema.parse(input);
  assertManageAvailability(ctx, data.membershipId);
  const rules = data.rules.map((r) => ({
    weekday: r.weekday,
    startMinute: hhmmToMinutes(r.start),
    endMinute: hhmmToMinutes(r.end),
  }));
  // Refuse les plages qui se chevauchent le même jour
  for (const a of rules)
    for (const b of rules)
      if (a !== b && a.weekday === b.weekday && a.startMinute < b.endMinute && b.startMinute < a.endMinute)
        throw new DomainError("overlappingRules");

  return withTenant(ctx.tenantId, async (tx) => {
    const member = await tx.membership.findFirst({
      where: { id: data.membershipId, role: { in: [...BOOKABLE_ROLES] } },
    });
    if (!member) throw new NotFoundError();
    await tx.availability.deleteMany({ where: { membershipId: member.id } });
    await tx.availability.createMany({
      data: rules.map((r) => ({ ...r, tenantId: ctx.tenantId, membershipId: member.id })),
    });
  });
}

export async function addAbsence(ctx: TenantContext, input: unknown) {
  const data = absenceSchema.parse(input);
  assertManageAvailability(ctx, data.membershipId);
  return withTenant(ctx.tenantId, async (tx) => {
    const member = await tx.membership.findFirst({ where: { id: data.membershipId } });
    if (!member) throw new NotFoundError();
    return tx.absence.create({
      data: {
        tenantId: ctx.tenantId,
        membershipId: member.id,
        startsAt: zonedToUtc(data.startDay, 0, ctx.timezone),
        endsAt: zonedToUtc(addDays(data.endDay, 1), 0, ctx.timezone),
        reason: data.reason || null,
      },
    });
  });
}

export async function deleteAbsence(ctx: TenantContext, absenceId: string) {
  return withTenant(ctx.tenantId, async (tx) => {
    const absence = await tx.absence.findFirst({ where: { id: absenceId } });
    if (!absence) throw new NotFoundError();
    assertManageAvailability(ctx, absence.membershipId);
    await tx.absence.delete({ where: { id: absence.id } });
  });
}
