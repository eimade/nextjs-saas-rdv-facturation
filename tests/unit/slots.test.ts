import { describe, expect, it } from "vitest";
import { computeSlots, openMinutesForDay, overlaps } from "@/server/booking/slots";
import { zonedToUtc } from "@/lib/time";

const TZ = "Europe/Paris";
const DAY = "2026-11-02"; // lundi
const rules = [
  { weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 },
  { weekday: 1, startMinute: 14 * 60, endMinute: 15 * 60 },
];
const now = new Date("2026-10-01T00:00:00Z");
const hhmm = (d: Date) => d.toLocaleTimeString("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

describe("calcul des créneaux", () => {
  it("découpe les plages selon la durée et le pas", () => {
    const slots = computeSlots({ day: DAY, timezone: TZ, durationMin: 60, rules, busy: [], now, stepMin: 30 });
    expect(slots.map(hhmm)).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00", "14:00"]);
  });

  it("exclut les créneaux qui chevauchent un rendez-vous ou une absence", () => {
    const busy = [{ startsAt: zonedToUtc(DAY, 10 * 60, TZ), endsAt: zonedToUtc(DAY, 10 * 60 + 30, TZ) }];
    const slots = computeSlots({ day: DAY, timezone: TZ, durationMin: 30, rules, busy, now, stepMin: 30 });
    expect(slots.map(hhmm)).toEqual(["09:00", "09:30", "10:30", "11:00", "11:30", "14:00", "14:30"]);
  });

  it("respecte le délai de prévenance", () => {
    const at = zonedToUtc(DAY, 9 * 60, TZ);
    const slots = computeSlots({ day: DAY, timezone: TZ, durationMin: 30, rules, busy: [], now: at, stepMin: 30, minNoticeMin: 60 });
    expect(hhmm(slots[0])).toBe("10:00");
  });

  it("ne renvoie rien un jour sans disponibilité ou pour une durée invalide", () => {
    expect(computeSlots({ day: "2026-11-03", timezone: TZ, durationMin: 30, rules, busy: [], now })).toEqual([]);
    expect(computeSlots({ day: DAY, timezone: TZ, durationMin: 0, rules, busy: [], now })).toEqual([]);
  });

  it("une prestation plus longue que la plage n'a aucun créneau", () => {
    expect(computeSlots({ day: DAY, timezone: TZ, durationMin: 240, rules, busy: [], now })).toEqual([]);
  });

  it("détecte les chevauchements (intervalles semi-ouverts)", () => {
    const a = new Date("2026-01-01T09:00:00Z");
    const b = new Date("2026-01-01T10:00:00Z");
    const c = new Date("2026-01-01T11:00:00Z");
    expect(overlaps(a, b, b, c)).toBe(false);
    expect(overlaps(a, c, b, c)).toBe(true);
  });

  it("calcule les minutes ouvertes en fusionnant les plages", () => {
    const merged = [...rules, { weekday: 1, startMinute: 11 * 60, endMinute: 13 * 60 }];
    expect(openMinutesForDay(DAY, merged)).toBe(4 * 60 + 60);
    expect(openMinutesForDay("2026-11-03", merged)).toBe(0);
  });
});
