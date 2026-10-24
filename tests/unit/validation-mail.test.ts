import { describe, expect, it } from "vitest";
import { availabilityRuleSchema, bookingSchema, firstIssue, signupSchema } from "@/lib/validation";
import { reminderEmail } from "@/server/notifications/reminders";
import { consoleMailer, consoleOutbox, resolveMailer, smtpMailer } from "@/server/notifications/mailer";
import { directionOf } from "@/i18n/routing";

describe("validation des entrées", () => {
  it("normalise l'inscription et refuse un slug invalide", () => {
    const ok = signupSchema.parse({
      cabinetName: "Cabinet",
      slug: " Mon-Cabinet ",
      ownerName: "Jean",
      email: "JEAN@EX.COM ",
      password: "12345678",
    });
    expect(ok.slug).toBe("mon-cabinet");
    expect(ok.email).toBe("jean@ex.com");
    const bad = signupSchema.safeParse({ cabinetName: "Cabinet", slug: "-x", ownerName: "Jean", email: "a@b.co", password: "12345678" });
    expect(bad.success).toBe(false);
    expect(firstIssue(bad.error!)).toBe("invalidSlug");
  });

  it("refuse une réservation avec un email ou un téléphone invalide", () => {
    const base = { serviceId: "s", membershipId: "m", startsAt: "2026-11-02T08:00:00.000Z", name: "Léa F" };
    expect(firstIssue(bookingSchema.safeParse({ ...base, email: "pas-un-email" }).error!)).toBe("invalidEmail");
    expect(firstIssue(bookingSchema.safeParse({ ...base, email: "a@b.fr", phone: "06<script>" }).error!)).toBe("invalidPhone");
    expect(bookingSchema.parse({ ...base, email: "a@b.fr", phone: "" }).locale).toBe("fr");
  });

  it("refuse une plage horaire inversée", () => {
    expect(availabilityRuleSchema.safeParse({ weekday: 1, start: "12:00", end: "09:00" }).success).toBe(false);
    expect(availabilityRuleSchema.safeParse({ weekday: 1, start: "09:00", end: "24:00" }).success).toBe(true);
  });
});

describe("i18n et rappels", () => {
  const data = {
    clientName: "Amine",
    cabinetName: "Cabinet",
    practitionerName: "Claire",
    serviceName: "Bilan",
    startsAt: new Date("2026-11-02T08:00:00Z"),
    timezone: "Europe/Paris",
    bookingUrl: "http://localhost/book/x",
  };

  it("l'arabe est en RTL, le français en LTR", () => {
    expect(directionOf("ar")).toBe("rtl");
    expect(directionOf("fr")).toBe("ltr");
  });

  it("rédige le rappel dans la langue du patient", () => {
    expect(reminderEmail("a@b.fr", { ...data, locale: "fr" }).subject).toMatch(/^Rappel/);
    expect(reminderEmail("a@b.fr", { ...data, locale: "en" }).subject).toMatch(/^Reminder/);
    expect(reminderEmail("a@b.fr", { ...data, locale: "ar" }).subject).toMatch(/^تذكير/);
    expect(reminderEmail("a@b.fr", { ...data, locale: "fr" }).text).toContain("09:00");
  });

  it("le bouchon email conserve les messages", async () => {
    expect(resolveMailer("console")).toBe(consoleMailer);
    expect(resolveMailer("smtp")).toBe(smtpMailer);
    await consoleMailer({ to: "x@y.fr", subject: "Test", text: "..." });
    expect(consoleOutbox.at(-1)?.subject).toBe("Test");
  });
});
