import { describe, expect, it } from "vitest";
import { assertCan, can, canActOnPractitioner, ForbiddenError } from "@/server/tenancy/permissions";
import { computeKpis } from "@/server/reporting/kpi-service";

describe("matrice des rôles", () => {
  it("le propriétaire gère l'équipe, pas la secrétaire ni le praticien", () => {
    expect(can("OWNER", "team:manage")).toBe(true);
    expect(can("SECRETARY", "team:manage")).toBe(false);
    expect(can("PRACTITIONER", "team:manage")).toBe(false);
  });

  it("la secrétaire facture, le praticien non", () => {
    expect(can("SECRETARY", "billing:manage")).toBe(true);
    expect(() => assertCan("PRACTITIONER", "billing:manage")).toThrow(ForbiddenError);
  });

  it("un praticien n'agit que sur son propre agenda", () => {
    expect(canActOnPractitioner({ role: "PRACTITIONER", membershipId: "a" }, "a")).toBe(true);
    expect(canActOnPractitioner({ role: "PRACTITIONER", membershipId: "a" }, "b")).toBe(false);
    expect(canActOnPractitioner({ role: "SECRETARY", membershipId: "s" }, "b")).toBe(true);
  });
});

describe("indicateurs", () => {
  const base = {
    openMinutes: 0,
    bookedMinutes: 0,
    completed: 0,
    noShow: 0,
    upcoming: 0,
    invoicedCents: 0,
    paidCents: 0,
    unpaidCents: 0,
  };

  it("calcule remplissage, no-show et CA", () => {
    const k = computeKpis({
      ...base,
      openMinutes: 1000,
      bookedMinutes: 250,
      completed: 9,
      noShow: 1,
      invoicedCents: 31500,
      paidCents: 28000,
      unpaidCents: 3500,
    });
    expect(k.fillRate).toBe(0.25);
    expect(k.noShowRate).toBe(0.1);
    expect(k.revenueCents).toBe(31500);
    expect(k.outstandingCents).toBe(3500);
  });

  it("renvoie null sans données et plafonne le remplissage à 100 %", () => {
    expect(computeKpis(base).fillRate).toBeNull();
    expect(computeKpis(base).noShowRate).toBeNull();
    expect(computeKpis({ ...base, openMinutes: 60, bookedMinutes: 90 }).fillRate).toBe(1);
  });
});
