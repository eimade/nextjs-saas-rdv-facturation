import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { withTenant } from "@/server/db";
import { bookAppointment, getAvailableSlots } from "@/server/booking/booking-service";
import { addAbsence, updateAppointmentStatus } from "@/server/booking/agenda-service";
import { createInvoiceFromAppointment, listInvoices, setInvoiceStatus } from "@/server/billing/billing-service";
import { getMonthKpis } from "@/server/reporting/kpi-service";
import { sendDueReminders } from "@/server/notifications/reminders";
import type { MailMessage } from "@/server/notifications/mailer";
import { localDay, addDays } from "@/lib/time";
import { GET as slotsRoute } from "@/app/api/public/[slug]/slots/route";
import { GET as healthRoute } from "@/app/api/health/route";
import { bookingInput, createCabinet, type TestCabinet } from "./helpers";

async function firstSlots(c: TestCabinet, n = 2): Promise<string[]> {
  const days = await getAvailableSlots(c.tenant, {
    serviceId: c.serviceId,
    membershipId: c.owner.membershipId,
    fromDay: localDay(new Date(), c.tenant.timezone),
  });
  return days.flatMap((d) => d.slots).slice(0, n);
}

describe("réservation publique", () => {
  it("réserve un créneau libre puis le retire des disponibilités", async () => {
    const c = await createCabinet("book");
    const [slot] = await firstSlots(c);
    const res = await bookAppointment(c.tenant, bookingInput(c, slot));
    expect(res.serviceName).toBe("Consultation");
    expect(await firstSlots(c, 50)).not.toContain(slot);
  });

  it("refuse un créneau déjà pris ou hors disponibilité", async () => {
    const c = await createCabinet("book");
    const [slot] = await firstSlots(c);
    await bookAppointment(c.tenant, bookingInput(c, slot));
    await expect(bookAppointment(c.tenant, bookingInput(c, slot))).rejects.toThrow("slotUnavailable");
    await expect(bookAppointment(c.tenant, bookingInput(c, "2020-01-01T08:00:00.000Z"))).rejects.toThrow(
      "slotUnavailable",
    );
  });

  it("deux réservations simultanées du même créneau : une seule réussit", async () => {
    const c = await createCabinet("race");
    const [slot] = await firstSlots(c);
    const results = await Promise.allSettled([
      bookAppointment(c.tenant, bookingInput(c, slot)),
      bookAppointment(c.tenant, bookingInput(c, slot)),
      bookAppointment(c.tenant, bookingInput(c, slot)),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("la contrainte d'exclusion PostgreSQL bloque un chevauchement écrit directement en base", async () => {
    const c = await createCabinet("excl");
    const [slot] = await firstSlots(c);
    const booked = await bookAppointment(c.tenant, bookingInput(c, slot));
    const start = new Date(new Date(slot).getTime() + 10 * 60000);
    await expect(
      withTenant(c.owner.tenantId, async (tx) => {
        const appt = await tx.appointment.findUniqueOrThrow({ where: { id: booked.appointmentId } });
        return tx.appointment.create({
          data: {
            tenantId: c.owner.tenantId,
            membershipId: c.owner.membershipId,
            serviceId: c.serviceId,
            clientId: appt.clientId,
            startsAt: start,
            endsAt: new Date(start.getTime() + 30 * 60000),
          },
        });
      }),
    ).rejects.toThrow(/appointments_no_overlap|23P01/);
  });

  it("une absence supprime les créneaux des jours concernés", async () => {
    const c = await createCabinet("abs");
    const day = addDays(localDay(new Date(), c.tenant.timezone), 3);
    await addAbsence(c.owner, { membershipId: c.owner.membershipId, startDay: day, endDay: day, reason: "Congé" });
    const days = await getAvailableSlots(c.tenant, { serviceId: c.serviceId, membershipId: c.owner.membershipId, fromDay: day });
    expect(days[0]).toEqual({ day, slots: [] });
  });
});

describe("facturation et indicateurs", () => {
  it("numérote les factures en séquence par tenant, refuse les doublons et met à jour le statut", async () => {
    const a = await createCabinet("bill");
    const b = await createCabinet("bill");
    const year = new Date().getFullYear();
    const [s1, , s2] = await firstSlots(a, 3); // pas de 15 min, prestation de 30 min
    const r1 = await bookAppointment(a.tenant, bookingInput(a, s1));
    const r2 = await bookAppointment(a.tenant, bookingInput(a, s2));

    await expect(createInvoiceFromAppointment(a.owner, r1.appointmentId)).rejects.toThrow("appointmentNotCompleted");
    await updateAppointmentStatus(a.owner, { appointmentId: r1.appointmentId, status: "COMPLETED" });
    await updateAppointmentStatus(a.owner, { appointmentId: r2.appointmentId, status: "COMPLETED" });

    const inv1 = await createInvoiceFromAppointment(a.owner, r1.appointmentId);
    const inv2 = await createInvoiceFromAppointment(a.owner, r2.appointmentId);
    expect(inv1.number).toBe(`F-${year}-0001`);
    expect(inv2.number).toBe(`F-${year}-0002`);
    expect(inv1.amountCents).toBe(4000);
    await expect(createInvoiceFromAppointment(a.owner, r1.appointmentId)).rejects.toThrow("alreadyInvoiced");

    // Le second cabinet a sa propre séquence et ne voit pas les rendez-vous du premier
    await expect(createInvoiceFromAppointment(b.owner, r1.appointmentId)).rejects.toThrow("notFound");
    const [sb] = await firstSlots(b, 1);
    const rb = await bookAppointment(b.tenant, bookingInput(b, sb));
    await updateAppointmentStatus(b.owner, { appointmentId: rb.appointmentId, status: "COMPLETED" });
    expect((await createInvoiceFromAppointment(b.owner, rb.appointmentId)).number).toBe(`F-${year}-0001`);

    await setInvoiceStatus(a.owner, { invoiceId: inv1.id, status: "PAID" });
    const unpaid = await listInvoices(a.owner, "UNPAID");
    expect(unpaid.map((i) => i.number)).toEqual([`F-${year}-0002`]);

    // un rendez-vous facturé ne change plus de statut
    await expect(updateAppointmentStatus(a.owner, { appointmentId: r1.appointmentId, status: "CANCELLED" })).rejects.toThrow(
      "appointmentInvoiced",
    );

    const kpis = await getMonthKpis(a.owner);
    if (kpis.month === localDay(new Date(s1), a.tenant.timezone).slice(0, 7)) {
      expect(kpis.completed).toBeGreaterThanOrEqual(1);
    }
    expect(kpis.revenueCents).toBe(8000);
    expect(kpis.collectedCents).toBe(4000);
    expect(kpis.outstandingCents).toBe(4000);
  });
});

describe("rappels par email (worker)", () => {
  it("envoie un rappel par rendez-vous dans les 24 h, une seule fois", async () => {
    const c = await createCabinet("remind");
    const [slot] = await firstSlots(c, 1);
    await bookAppointment(c.tenant, bookingInput(c, slot, "rappel@example.com"));
    const outbox: MailMessage[] = [];
    const stub = async (m: MailMessage) => {
      outbox.push(m);
    };
    await sendDueReminders(stub, new Date(), 24);
    const mine = outbox.filter((m) => m.to === "rappel@example.com");
    expect(mine).toHaveLength(1);
    expect(mine[0].subject).toMatch(/^Rappel/);

    outbox.length = 0;
    await sendDueReminders(stub, new Date(), 24);
    expect(outbox.filter((m) => m.to === "rappel@example.com")).toHaveLength(0);
  });

  it("un échec d'envoi libère le rendez-vous pour un nouvel essai", async () => {
    const c = await createCabinet("remind");
    const [slot] = await firstSlots(c, 1);
    await bookAppointment(c.tenant, bookingInput(c, slot, "echec@example.com"));
    const failing = async (m: MailMessage) => {
      if (m.to === "echec@example.com") throw new Error("SMTP indisponible");
    };
    const r = await sendDueReminders(failing, new Date(), 24);
    expect(r.failed).toBeGreaterThanOrEqual(1);
    const outbox: MailMessage[] = [];
    await sendDueReminders(async (m) => void outbox.push(m), new Date(), 24);
    expect(outbox.some((m) => m.to === "echec@example.com")).toBe(true);
  });
});

describe("API HTTP", () => {
  it("GET /api/public/:slug/slots renvoie les créneaux, 400 si paramètres invalides, 404 si cabinet inconnu", async () => {
    const c = await createCabinet("api");
    const url = `http://localhost/api/public/${c.tenant.slug}/slots?serviceId=${c.serviceId}&membershipId=${c.owner.membershipId}`;
    const ok = await slotsRoute(new NextRequest(url), { params: Promise.resolve({ slug: c.tenant.slug }) });
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.days.length).toBe(14);
    expect(body.days[1].slots.length).toBeGreaterThan(0);

    const bad = await slotsRoute(new NextRequest(`${url}&from=2026-13-45`), {
      params: Promise.resolve({ slug: c.tenant.slug }),
    });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toBe("invalidDate");

    const missing = await slotsRoute(new NextRequest("http://localhost/api/public/inconnu/slots"), {
      params: Promise.resolve({ slug: "inconnu-xyz" }),
    });
    expect(missing.status).toBe(404);
  });

  it("GET /api/health vérifie la base", async () => {
    const res = await healthRoute();
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
