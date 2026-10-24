import { describe, expect, it } from "vitest";
import { addDays, isValidDay, localDay, localMinutes, startOfWeek, weekdayOf, zonedToUtc } from "@/lib/time";

describe("fuseaux horaires", () => {
  it("convertit une heure locale de Paris en UTC (hiver et été)", () => {
    expect(zonedToUtc("2026-01-15", 9 * 60, "Europe/Paris").toISOString()).toBe("2026-01-15T08:00:00.000Z");
    expect(zonedToUtc("2026-07-15", 9 * 60, "Europe/Paris").toISOString()).toBe("2026-07-15T07:00:00.000Z");
  });

  it("gère le jour du changement d'heure", () => {
    // 29 mars 2026 : passage à l'heure d'été à 02:00 (Paris)
    expect(zonedToUtc("2026-03-29", 10 * 60, "Europe/Paris").toISOString()).toBe("2026-03-29T08:00:00.000Z");
  });

  it("retrouve jour et minutes locales d'un instant", () => {
    const d = new Date("2026-10-24T22:30:00Z");
    expect(localDay(d, "Europe/Paris")).toBe("2026-10-25");
    expect(localMinutes(d, "Europe/Paris")).toBe(30);
    expect(localDay(d, "America/Montreal")).toBe("2026-10-24");
  });

  it("valide les jours et calcule les dates relatives", () => {
    expect(isValidDay("2026-02-29")).toBe(false);
    expect(isValidDay("2028-02-29")).toBe(true);
    expect(isValidDay("26-1-1")).toBe(false);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(weekdayOf("2026-10-24")).toBe(6); // samedi
    expect(startOfWeek("2026-10-25")).toBe("2026-10-19"); // dimanche -> lundi précédent
  });
});
