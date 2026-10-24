"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/actions/result";
import { field, requireContext } from "@/actions/protected";
import {
  addAbsence,
  deleteAbsence,
  setWeeklyAvailability,
  updateAppointmentStatus,
} from "@/server/booking/agenda-service";

export async function updateStatusAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    await updateAppointmentStatus(await requireContext(), {
      appointmentId: field(fd, "appointmentId"),
      status: field(fd, "status"),
    });
  });
  if (result.ok) revalidatePath("/[locale]/app", "layout");
  return result;
}

export async function saveAvailabilityAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    let rules: unknown = null;
    try {
      rules = JSON.parse(field(fd, "rules") || "[]");
    } catch {
      // laissé à null : rejeté par la validation Zod
    }
    await setWeeklyAvailability(await requireContext(), { membershipId: field(fd, "membershipId"), rules });
  });
  if (result.ok) revalidatePath("/[locale]/app/availability", "page");
  return result;
}

export async function addAbsenceAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    await addAbsence(await requireContext(), {
      membershipId: field(fd, "membershipId"),
      startDay: field(fd, "startDay"),
      endDay: field(fd, "endDay"),
      reason: field(fd, "reason") || undefined,
    });
  });
  if (result.ok) revalidatePath("/[locale]/app/availability", "page");
  return result;
}

export async function deleteAbsenceAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    await deleteAbsence(await requireContext(), field(fd, "absenceId"));
  });
  if (result.ok) revalidatePath("/[locale]/app/availability", "page");
  return result;
}
