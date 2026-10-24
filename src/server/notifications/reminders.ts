import { systemDb, withTenant } from "@/server/db";
import type { MailMessage, SendMail } from "@/server/notifications/mailer";
import { formatDate, formatTime } from "@/lib/utils";

export interface ReminderData {
  locale: string;
  clientName: string;
  cabinetName: string;
  practitionerName: string;
  serviceName: string;
  startsAt: Date;
  timezone: string;
  bookingUrl: string;
}

/** Contenu de l'email de rappel dans la langue choisie par le patient lors de la réservation. */
export function reminderEmail(to: string, d: ReminderData): MailMessage {
  const date = formatDate(d.startsAt, d.timezone, d.locale, true);
  const time = formatTime(d.startsAt, d.timezone, d.locale);
  switch (d.locale) {
    case "en":
      return {
        to,
        subject: `Reminder: your appointment on ${date} at ${time}`,
        text: `Hello ${d.clientName},\n\nThis is a reminder of your appointment "${d.serviceName}" with ${d.practitionerName} at ${d.cabinetName} on ${date} at ${time}.\nIf you cannot attend, please contact the practice.\n\n${d.bookingUrl}`,
      };
    case "ar":
      return {
        to,
        subject: `تذكير: موعدك يوم ${date} على الساعة ${time}`,
        text: `مرحبًا ${d.clientName}،\n\nنذكّرك بموعدك "${d.serviceName}" مع ${d.practitionerName} في ${d.cabinetName} يوم ${date} على الساعة ${time}.\nفي حال تعذّر حضورك، يُرجى الاتصال بالعيادة.\n\n${d.bookingUrl}`,
      };
    default:
      return {
        to,
        subject: `Rappel : votre rendez-vous le ${date} à ${time}`,
        text: `Bonjour ${d.clientName},\n\nNous vous rappelons votre rendez-vous « ${d.serviceName} » avec ${d.practitionerName} au cabinet ${d.cabinetName} le ${date} à ${time}.\nEn cas d'empêchement, merci de prévenir le cabinet.\n\n${d.bookingUrl}`,
      };
  }
}

export interface ReminderRunResult {
  sent: number;
  failed: number;
}

/**
 * Envoie les rappels des rendez-vous à venir dans la fenêtre donnée.
 * Chaque rendez-vous est d'abord « réservé » (reminder_sent_at) par un UPDATE conditionnel,
 * ce qui évite les doublons si plusieurs workers tournent ; en cas d'échec SMTP, la réservation
 * est annulée pour être retentée au passage suivant.
 */
export async function sendDueReminders(
  sendMail: SendMail,
  now = new Date(),
  hoursAhead = 24,
): Promise<ReminderRunResult> {
  const until = new Date(now.getTime() + hoursAhead * 3600000);
  const appUrl = process.env.APP_URL ?? "http://localhost:13000";
  const tenants = await systemDb.tenant.findMany({ select: { id: true, slug: true, name: true, timezone: true } });
  const result: ReminderRunResult = { sent: 0, failed: 0 };

  for (const tenant of tenants) {
    const due = await withTenant(tenant.id, (tx) =>
      tx.appointment.findMany({
        where: { status: "BOOKED", reminderSentAt: null, startsAt: { gt: now, lte: until } },
        select: {
          id: true,
          startsAt: true,
          service: { select: { name: true } },
          client: { select: { name: true, email: true, locale: true } },
          membership: { select: { user: { select: { name: true } } } },
        },
      }),
    );

    for (const appt of due) {
      const claimed = await withTenant(tenant.id, (tx) =>
        tx.appointment.updateMany({ where: { id: appt.id, reminderSentAt: null }, data: { reminderSentAt: now } }),
      );
      if (claimed.count !== 1) continue;
      try {
        await sendMail(
          reminderEmail(appt.client.email, {
            locale: appt.client.locale,
            clientName: appt.client.name,
            cabinetName: tenant.name,
            practitionerName: appt.membership.user.name,
            serviceName: appt.service.name,
            startsAt: appt.startsAt,
            timezone: tenant.timezone,
            bookingUrl: `${appUrl}/${appt.client.locale}/book/${tenant.slug}`,
          }),
        );
        result.sent++;
      } catch (error) {
        result.failed++;
        console.error(`[reminders] échec d'envoi pour le RDV ${appt.id}`, error);
        await withTenant(tenant.id, (tx) =>
          tx.appointment.update({ where: { id: appt.id }, data: { reminderSentAt: null } }),
        );
      }
    }
  }
  return result;
}
