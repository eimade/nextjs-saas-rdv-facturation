"use server";

import { runAction, type ActionResult } from "@/actions/result";
import {
  bookAppointment,
  findPublicTenant,
  getAvailableSlots,
  type BookingResult,
  type DaySlots,
} from "@/server/booking/booking-service";
import { NotFoundError } from "@/server/errors";

/** Actions publiques de la page de réservation (sans authentification). */
async function tenantOrThrow(slug: string) {
  const tenant = await findPublicTenant(slug);
  if (!tenant) throw new NotFoundError();
  return tenant;
}

export async function getSlotsAction(slug: string, input: unknown): Promise<ActionResult<DaySlots[]>> {
  return runAction(async () => getAvailableSlots(await tenantOrThrow(slug), input));
}

export async function bookAction(slug: string, input: unknown): Promise<ActionResult<BookingResult>> {
  return runAction(async () => bookAppointment(await tenantOrThrow(slug), input));
}
