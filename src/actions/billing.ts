"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/actions/result";
import { field, requireContext } from "@/actions/protected";
import { createInvoiceFromAppointment, setInvoiceStatus } from "@/server/billing/billing-service";

export async function createInvoiceAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    await createInvoiceFromAppointment(await requireContext(), field(fd, "appointmentId"));
  });
  if (result.ok) revalidatePath("/[locale]/app", "layout");
  return result;
}

export async function setInvoiceStatusAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    await setInvoiceStatus(await requireContext(), {
      invoiceId: field(fd, "invoiceId"),
      status: field(fd, "status"),
    });
  });
  if (result.ok) revalidatePath("/[locale]/app", "layout");
  return result;
}
