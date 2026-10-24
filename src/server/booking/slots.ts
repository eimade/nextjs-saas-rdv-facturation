import { weekdayOf, zonedToUtc } from "@/lib/time";

export interface WeeklyRule {
  weekday: number;
  startMinute: number;
  endMinute: number;
}

export interface BusyInterval {
  startsAt: Date;
  endsAt: Date;
}

export interface SlotQuery {
  /** Jour local du cabinet, YYYY-MM-DD */
  day: string;
  timezone: string;
  durationMin: number;
  rules: WeeklyRule[];
  /** Rendez-vous non annulés + absences du praticien */
  busy: BusyInterval[];
  now: Date;
  stepMin?: number;
  /** Délai minimal de prévenance avant un créneau (minutes) */
  minNoticeMin?: number;
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Calcule les créneaux disponibles d'un praticien pour un jour donné.
 * Un créneau [début, début + durée) doit tenir entièrement dans une plage de
 * disponibilité, ne chevaucher aucun intervalle occupé et respecter le délai de prévenance.
 */
export function computeSlots(q: SlotQuery): Date[] {
  const step = q.stepMin ?? 15;
  const notice = q.minNoticeMin ?? 60;
  if (q.durationMin <= 0 || step <= 0) return [];
  const earliest = q.now.getTime() + notice * 60000;
  const weekday = weekdayOf(q.day);
  const result = new Map<number, Date>();

  for (const rule of q.rules) {
    if (rule.weekday !== weekday) continue;
    for (let m = rule.startMinute; m + q.durationMin <= rule.endMinute; m += step) {
      const start = zonedToUtc(q.day, m, q.timezone);
      const end = new Date(start.getTime() + q.durationMin * 60000);
      if (start.getTime() < earliest) continue;
      if (q.busy.some((b) => overlaps(start, end, b.startsAt, b.endsAt))) continue;
      result.set(start.getTime(), start);
    }
  }
  return [...result.values()].sort((a, b) => a.getTime() - b.getTime());
}

/** Minutes ouvertes d'un jour (plages fusionnées), base du taux de remplissage. */
export function openMinutesForDay(day: string, rules: WeeklyRule[]): number {
  const wd = weekdayOf(day);
  const ranges = rules
    .filter((r) => r.weekday === wd)
    .map((r) => [r.startMinute, r.endMinute] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cur: [number, number] | null = null;
  for (const r of ranges) {
    if (!cur || r[0] > cur[1]) {
      if (cur) total += cur[1] - cur[0];
      cur = [r[0], r[1]];
    } else cur[1] = Math.max(cur[1], r[1]);
  }
  if (cur) total += cur[1] - cur[0];
  return total;
}
