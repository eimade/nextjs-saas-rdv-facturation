import { z } from "zod";
import { isValidDay } from "@/lib/time";

/** Schémas Zod partagés : les messages sont des clés de traduction (errors.*). */

const email = z.string().trim().toLowerCase().email("invalidEmail").max(200);
const password = z.string().min(8, "passwordTooShort").max(200);
const name = z.string().trim().min(2, "required").max(120);
const id = z.string().min(1).max(50);

export const roleSchema = z.enum(["OWNER", "PRACTITIONER", "SECRETARY"]);

export const signupSchema = z.object({
  cabinetName: name,
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/, "invalidSlug"),
  ownerName: name,
  email,
  password,
});

export const loginSchema = z.object({ email, password: z.string().min(1, "required") });

export const inviteSchema = z.object({ email, role: z.enum(["PRACTITIONER", "SECRETARY"]) });

export const acceptInviteSchema = z.object({ token: z.string().min(10).max(100), name, password });

export const serviceSchema = z.object({
  name: z.string().trim().min(2, "required").max(80),
  durationMin: z.coerce.number().int().min(5, "invalidDuration").max(480, "invalidDuration"),
  price: z.coerce.number().min(0, "invalidPrice").max(100000, "invalidPrice"),
});

export const daySchema = z.string().refine(isValidDay, "invalidDate");

export const slotsQuerySchema = z.object({
  serviceId: id,
  membershipId: id,
  fromDay: daySchema,
});

export const bookingSchema = z.object({
  serviceId: id,
  membershipId: id,
  startsAt: z.string().datetime("invalidDate"),
  name,
  email,
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+0-9 ().-]*$/, "invalidPhone")
    .optional()
    .transform((v) => (v ? v : undefined)),
  locale: z.enum(["fr", "en", "ar"]).default("fr"),
});

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/, "invalidTime");

export const availabilityRuleSchema = z
  .object({ weekday: z.coerce.number().int().min(0).max(6), start: hhmm, end: hhmm })
  .refine((r) => r.end > r.start, { message: "invalidRange", path: ["end"] });

export const availabilitySchema = z.object({
  membershipId: id,
  rules: z.array(availabilityRuleSchema).max(50),
});

export const absenceSchema = z
  .object({
    membershipId: id,
    startDay: daySchema,
    endDay: daySchema,
    reason: z.string().trim().max(120).optional(),
  })
  .refine((a) => a.endDay >= a.startDay, { message: "invalidRange", path: ["endDay"] });

export const appointmentStatusSchema = z.object({
  appointmentId: id,
  status: z.enum(["COMPLETED", "NO_SHOW", "CANCELLED", "BOOKED"]),
});

export const invoiceStatusSchema = z.object({ invoiceId: id, status: z.enum(["PAID", "UNPAID"]) });

/** Première clé d'erreur Zod, utilisée comme clé de traduction. */
export function firstIssue(error: z.ZodError): string {
  const msg = error.issues[0]?.message ?? "invalidInput";
  return /^[a-zA-Z]+$/.test(msg) ? msg : "invalidInput";
}
