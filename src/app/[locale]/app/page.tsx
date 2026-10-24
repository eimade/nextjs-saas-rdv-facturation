import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AppointmentActions, StatusBadge } from "@/components/appointment-actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { localDay } from "@/lib/time";
import { formatMoney, formatTime, intlLocale } from "@/lib/utils";
import { listAppointments } from "@/server/booking/agenda-service";
import { requirePageContext } from "@/server/page-context";
import { getMonthKpis } from "@/server/reporting/kpi-service";
import { can } from "@/server/tenancy/permissions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("dashboard") };
}

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const ctx = await requirePageContext(locale, "kpi:view");
  const t = await getTranslations("dashboard");
  const today = localDay(new Date(), ctx.timezone);
  const [kpis, todays] = await Promise.all([
    getMonthKpis(ctx),
    listAppointments(ctx, { fromDay: today, days: 1 }),
  ]);
  const pct = (v: number | null) =>
    v === null ? "–" : new Intl.NumberFormat(intlLocale(locale), { style: "percent", maximumFractionDigits: 0 }).format(v);
  const money = (c: number) => formatMoney(c, ctx.currency, locale);
  const monthLabel = new Intl.DateTimeFormat(intlLocale(locale), { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${kpis.month}-15T12:00:00Z`),
  );

  const cards = [
    { id: "fill", label: t("fillRate"), value: pct(kpis.fillRate), help: t("fillRateHelp") },
    { id: "noshow", label: t("noShowRate"), value: pct(kpis.noShowRate), help: t("noShowHelp", { count: kpis.noShow }) },
    { id: "revenue", label: t("revenue"), value: money(kpis.revenueCents), help: t("revenueHelp", { paid: money(kpis.collectedCents) }) },
    { id: "outstanding", label: t("outstanding"), value: money(kpis.outstandingCents), help: t("outstandingHelp") },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle", { month: monthLabel })}</p>
        </div>
        <Link
          href={`/book/${ctx.tenantSlug}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-primary underline"
        >
          {t("publicPage")}
          <ExternalLink aria-hidden className="size-4" />
        </Link>
      </div>

      <section aria-labelledby="kpi-title">
        <h2 id="kpi-title" className="sr-only">
          {t("kpiTitle")}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((c) => (
            <li key={c.id}>
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <CardDescription id={`kpi-${c.id}`}>{c.label}</CardDescription>
                  <p aria-describedby={`kpi-${c.id}`} className="text-3xl font-bold" data-testid={`kpi-${c.id}`}>
                    {c.value}
                  </p>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">{c.help}</CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{t("today")}</CardTitle>
          <CardDescription>{t("upcoming", { count: kpis.upcoming })}</CardDescription>
        </CardHeader>
        <CardContent>
          {todays.length === 0 ? (
            <p className="text-muted-foreground">{t("noAppointmentsToday")}</p>
          ) : (
            <ul className="divide-y">
              {todays.map((a) => {
                const label = `${formatTime(a.startsAt, ctx.timezone, locale)} ${a.client.name}`;
                return (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-medium">
                        <time dateTime={a.startsAt.toISOString()}>{formatTime(a.startsAt, ctx.timezone, locale)}</time> ·{" "}
                        {a.client.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {a.service.name} · {a.membership.user.name}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <StatusBadge status={a.status} />
                      <AppointmentActions appointment={a} canBill={can(ctx.role, "billing:manage")} label={label} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
