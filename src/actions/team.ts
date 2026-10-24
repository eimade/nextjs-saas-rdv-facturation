"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/actions/result";
import { field, requireContext } from "@/actions/protected";
import { sendMail } from "@/server/notifications/mailer";
import { createService, inviteMember, toggleService } from "@/server/tenancy/tenancy-service";

export async function inviteAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    await inviteMember(await requireContext(), { email: field(fd, "email"), role: field(fd, "role") }, sendMail);
  });
  if (result.ok) revalidatePath("/[locale]/app/team", "page");
  return result;
}

export async function createServiceAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    await createService(await requireContext(), {
      name: field(fd, "name"),
      durationMin: field(fd, "durationMin"),
      price: field(fd, "price").replace(",", "."),
    });
  });
  if (result.ok) revalidatePath("/[locale]/app/services", "page");
  return result;
}

export async function toggleServiceAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    await toggleService(await requireContext(), field(fd, "serviceId"));
  });
  if (result.ok) revalidatePath("/[locale]/app/services", "page");
  return result;
}
