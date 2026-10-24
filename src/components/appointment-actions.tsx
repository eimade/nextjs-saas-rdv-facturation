import { getTranslations } from "next-intl/server";
import { updateStatusAction } from "@/actions/agenda";
import { createInvoiceAction } from "@/actions/billing";
import { ActionButton } from "@/components/action-button";
import { Badge } from "@/components/ui/badge";

type Status = "BOOKED" | "COMPLETED" | "NO_SHOW" | "CANCELLED";

export async function StatusBadge({ status }: { status: Status }) {
  const t = await getTranslations("status");
  const variant = { BOOKED: "secondary", COMPLETED: "success", NO_SHOW: "warning", CANCELLED: "destructive" } as const;
  return <Badge variant={variant[status]}>{t(status)}</Badge>;
}

/** Actions contextuelles d'un rendez-vous selon son statut et les droits de l'utilisateur. */
export async function AppointmentActions({
  appointment,
  canBill,
  label,
}: {
  appointment: { id: string; status: Status; startsAt: Date; invoice: { id: string; number: string } | null };
  canBill: boolean;
  label: string;
}) {
  const t = await getTranslations("agenda");
  const set = (status: Status) => ({ appointmentId: appointment.id, status });
  if (appointment.invoice) {
    return (
      <a
        href={`/api/invoices/${appointment.invoice.id}/pdf`}
        className="text-sm font-medium text-primary underline"
        aria-label={t("viewInvoiceFor", { number: appointment.invoice.number, label })}
      >
        {t("viewInvoice", { number: appointment.invoice.number })}
      </a>
    );
  }
  const started = appointment.startsAt <= new Date();
  return (
    <div className="flex flex-wrap gap-2">
      {appointment.status === "BOOKED" && (
        <>
          {started && (
            <>
              <ActionButton action={updateStatusAction} fields={set("COMPLETED")} aria-label={t("markCompletedFor", { label })}>
                {t("markCompleted")}
              </ActionButton>
              <ActionButton action={updateStatusAction} fields={set("NO_SHOW")} aria-label={t("markNoShowFor", { label })}>
                {t("markNoShow")}
              </ActionButton>
            </>
          )}
          <ActionButton
            action={updateStatusAction}
            fields={set("CANCELLED")}
            variant="ghost"
            aria-label={t("cancelFor", { label })}
          >
            {t("cancel")}
          </ActionButton>
        </>
      )}
      {appointment.status === "COMPLETED" && canBill && (
        <ActionButton
          action={createInvoiceAction}
          fields={{ appointmentId: appointment.id }}
          variant="default"
          aria-label={t("createInvoiceFor", { label })}
        >
          {t("createInvoice")}
        </ActionButton>
      )}
      {appointment.status !== "BOOKED" && (
        <ActionButton action={updateStatusAction} fields={set("BOOKED")} variant="ghost" aria-label={t("resetFor", { label })}>
          {t("reset")}
        </ActionButton>
      )}
    </div>
  );
}
