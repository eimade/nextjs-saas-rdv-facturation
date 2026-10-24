import type { Metadata } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AppointmentActions, StatusBadge } from "@/components/appointment-actions";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Label } from "@/components/ui/label";
import { addDays, isValidDay, localDay, startOfWeek } from "@/lib/time";
import { cn, formatTime, intlLocale } from "@/lib/utils";
import { listAppointments, listPractitioners } from "@/server/booking/agenda-service";
import { requirePageContext } from "@/server/page-context";
import { can } from "@/server/tenancy/permissions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("agenda") };
}

type SearchParams = Promise<{ view?: string; date?: string; practitioner?: string }>;

export default async function AgendaPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  const ctx = await requirePageContext(locale);
  const sp = await searchParams;
  const t = await getTranslations("agenda");
  const view = sp.view === "day" ? "day" : "week";
  const today = localDay(new Date(), ctx.timezone);
  const date = sp.date && isValidDay(sp.date) ? sp.date : today;
  const fromDay = view === "week" ? startOfWeek(date) : date;
  const nbDays = view === "week" ? 7 : 1;

  const practitioners = await listPractitioners(ctx);
  const viewAll = can(ctx.role, "agenda:viewAll");
  const practitionerId = viewAll
    ? practitioners.find((p) => p.id === sp.practitioner)?.id
    : ctx.membershipId;
  const appointments = await listAppointments(ctx, { fromDay, days: nbDays, membershipId: practitionerId });
  const canBill = can(ctx.role, "billing:manage");

  const days = Array.from({ length: nbDays }, (_, i) => addDays(fromDay, i));
  const fmtDay = (d: string, long = false) =>
    new Intl.DateTimeFormat(intlLocale(locale), {
      weekday: long ? "long" : "short",
      day: "numeric",
      month: long ? "long" : "short",
      timeZone: "UTC",
    }).format(new Date(`${d}T12:00:00Z`));
  const href = (overrides: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { view, date, practitioner: practitionerId, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    return `/app/agenda?${q.toString()}`;
  };
  const step = view === "week" ? 7 : 1;
  const title = view === "week" ? t("weekOf", { day: fmtDay(fromDay, true) }) : fmtDay(date, true);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground" aria-live="polite">
            {title}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="icon">
            <Link href={href({ date: addDays(date, -step) })} aria-label={t("previous")}>
              <ChevronLeft aria-hidden className="rtl:rotate-180" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={href({ date: today })}>{t("today")}</Link>
          </Button>
          <Button asChild variant="outline" size="icon">
            <Link href={href({ date: addDays(date, step) })} aria-label={t("next")}>
              <ChevronRight aria-hidden className="rtl:rotate-180" />
            </Link>
          </Button>
          <div role="group" aria-label={t("viewLabel")} className="ms-2 inline-flex rounded-md border">
            {(["day", "week"] as const).map((v) => (
              <Link
                key={v}
                href={href({ view: v })}
                aria-current={view === v ? "true" : undefined}
                className={cn(
                  "px-3 py-2 text-sm font-medium first:rounded-s-md last:rounded-e-md",
                  view === v ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                {t(v)}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {viewAll && (
        <form method="get" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="view" value={view} />
          <input type="hidden" name="date" value={date} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="practitioner">{t("practitioner")}</Label>
            <NativeSelect id="practitioner" name="practitioner" defaultValue={practitionerId ?? ""} className="w-56">
              <option value="">{t("allPractitioners")}</option>
              {practitioners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button type="submit" variant="secondary">
            {t("filter")}
          </Button>
        </form>
      )}

      <div className={cn("grid gap-4", view === "week" && "lg:grid-cols-7")}>
        {days.map((d) => {
          const items = appointments.filter((a) => localDay(a.startsAt, ctx.timezone) === d);
          return (
            <section
              key={d}
              aria-labelledby={`day-${d}`}
              className={cn("rounded-lg border bg-card", d === today && "border-primary")}
            >
              <h2 id={`day-${d}`} className="border-b px-3 py-2 text-sm font-semibold">
                {fmtDay(d, view === "day")}
                {d === today && <span className="ms-2 text-xs font-normal text-primary">({t("today")})</span>}
              </h2>
              {items.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground">{t("empty")}</p>
              ) : (
                <ul className="divide-y">
                  {items.map((a) => {
                    const time = formatTime(a.startsAt, ctx.timezone, locale);
                    const label = `${fmtDay(d)} ${time} ${a.client.name}`;
                    return (
                      <li key={a.id} className={cn("flex flex-col gap-2 p-3", a.status === "CANCELLED" && "bg-muted")}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold">
                            <time dateTime={a.startsAt.toISOString()}>{time}</time>–
                            <time dateTime={a.endsAt.toISOString()}>{formatTime(a.endsAt, ctx.timezone, locale)}</time>
                          </p>
                          <StatusBadge status={a.status} />
                        </div>
                        <p className="text-sm">{a.client.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.service.name}
                          {!practitionerId && ` · ${a.membership.user.name}`}
                        </p>
                        <AppointmentActions appointment={a} canBill={canBill} label={label} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
