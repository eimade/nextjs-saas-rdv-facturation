import { addDays, daysInMonth, localDay, zonedToUtc } from "@/lib/time";
import { withTenant } from "@/server/db";
import type { TenantContext } from "@/server/context";
import { openMinutesForDay, type WeeklyRule } from "@/server/booking/slots";
import { assertCan, can } from "@/server/tenancy/permissions";

export interface KpiInput {
  openMinutes: number;
  bookedMinutes: number;
  completed: number;
  noShow: number;
  upcoming: number;
  invoicedCents: number;
  paidCents: number;
  unpaidCents: number;
}

export interface Kpis {
  fillRate: number | null;
  noShowRate: number | null;
  revenueCents: number;
  collectedCents: number;
  outstandingCents: number;
  completed: number;
  noShow: number;
  upcoming: number;
}

/** Règles de calcul des indicateurs (fonction pure, testée unitairement). */
export function computeKpis(i: KpiInput): Kpis {
  const attended = i.completed + i.noShow;
  return {
    fillRate: i.openMinutes > 0 ? Math.min(1, i.bookedMinutes / i.openMinutes) : null,
    noShowRate: attended > 0 ? i.noShow / attended : null,
    revenueCents: i.invoicedCents,
    collectedCents: i.paidCents,
    outstandingCents: i.unpaidCents,
    completed: i.completed,
    noShow: i.noShow,
    upcoming: i.upcoming,
  };
}

/** Indicateurs du mois civil courant (fuseau du cabinet). */
export async function getMonthKpis(ctx: TenantContext, now = new Date()) {
  assertCan(ctx.role, "kpi:view");
  const today = localDay(now, ctx.timezone);
  const [year, month] = today.split("-").map(Number);
  const firstDay = `${today.slice(0, 7)}-01`;
  const nbDays = daysInMonth(year, month);
  const from = zonedToUtc(firstDay, 0, ctx.timezone);
  const to = zonedToUtc(addDays(firstDay, nbDays), 0, ctx.timezone);
  const scope = can(ctx.role, "agenda:viewAll") ? {} : { membershipId: ctx.membershipId };

  const data = await withTenant(ctx.tenantId, async (tx) => {
    const [rules, appointments, invoices] = await Promise.all([
      tx.availability.findMany({ where: scope, select: { weekday: true, startMinute: true, endMinute: true } }),
      tx.appointment.findMany({
        where: { ...scope, startsAt: { gte: from, lt: to }, status: { not: "CANCELLED" } },
        select: { startsAt: true, endsAt: true, status: true },
      }),
      tx.invoice.findMany({
        where: { issuedAt: { gte: from, lt: to }, ...(scope.membershipId ? { appointment: scope } : {}) },
        select: { amountCents: true, status: true },
      }),
    ]);
    return { rules, appointments, invoices };
  });

  let openMinutes = 0;
  const rules: WeeklyRule[] = data.rules;
  for (let d = 0; d < nbDays; d++) openMinutes += openMinutesForDay(addDays(firstDay, d), rules);

  const sum = (xs: { amountCents: number }[]) => xs.reduce((s, x) => s + x.amountCents, 0);
  const kpis = computeKpis({
    openMinutes,
    bookedMinutes: data.appointments.reduce((s, a) => s + (a.endsAt.getTime() - a.startsAt.getTime()) / 60000, 0),
    completed: data.appointments.filter((a) => a.status === "COMPLETED").length,
    noShow: data.appointments.filter((a) => a.status === "NO_SHOW").length,
    upcoming: data.appointments.filter((a) => a.status === "BOOKED" && a.startsAt > now).length,
    invoicedCents: sum(data.invoices),
    paidCents: sum(data.invoices.filter((i) => i.status === "PAID")),
    unpaidCents: sum(data.invoices.filter((i) => i.status === "UNPAID")),
  });
  return { month: today.slice(0, 7), ...kpis };
}
