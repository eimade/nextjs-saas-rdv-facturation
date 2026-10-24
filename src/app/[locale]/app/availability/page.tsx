import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { deleteAbsenceAction } from "@/actions/agenda";
import { ActionButton } from "@/components/action-button";
import { AbsenceForm, AvailabilityEditor } from "@/components/availability-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { localDay, minutesToHHMM } from "@/lib/time";
import { formatDate, intlLocale } from "@/lib/utils";
import { getAvailability, listPractitioners } from "@/server/booking/agenda-service";
import { requirePageContext } from "@/server/page-context";
import { can } from "@/server/tenancy/permissions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("availability") };
}

export default async function AvailabilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ practitioner?: string }>;
}) {
  const { locale } = await params;
  const ctx = await requirePageContext(locale);
  const { practitioner } = await searchParams;
  const t = await getTranslations("availability");
  const practitioners = await listPractitioners(ctx);
  const manageAll = can(ctx.role, "availability:manageAll");

  const selected =
    practitioners.find((p) => p.id === practitioner) ??
    practitioners.find((p) => p.id === ctx.membershipId) ??
    practitioners[0];

  if (!selected) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("noPractitioner")}</p>
      </div>
    );
  }

  const data = await getAvailability(ctx, selected.id);
  const weekdayNames = Array.from({ length: 7 }, (_, d) =>
    new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long", timeZone: "UTC" }).format(
      new Date(Date.UTC(2024, 0, 7 + d)), // 7 janvier 2024 = dimanche
    ),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle", { name: data.member.name, timezone: ctx.timezone })}</p>
      </div>

      {manageAll && practitioners.length > 1 && (
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="practitioner">{t("practitioner")}</Label>
            <NativeSelect id="practitioner" name="practitioner" defaultValue={selected.id} className="w-56">
              {practitioners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button type="submit" variant="secondary">
            {t("show")}
          </Button>
        </form>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("weeklyTitle")}</CardTitle>
          <CardDescription>{t("weeklyHelp")}</CardDescription>
        </CardHeader>
        <CardContent>
          <AvailabilityEditor
            key={selected.id + data.rules.map((r) => r.id).join()}
            membershipId={selected.id}
            weekdayNames={weekdayNames}
            initialRules={data.rules.map((r) => ({
              weekday: r.weekday,
              start: minutesToHHMM(r.startMinute),
              end: minutesToHHMM(r.endMinute),
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("absencesTitle")}</CardTitle>
          <CardDescription>{t("absencesHelp")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <AbsenceForm membershipId={selected.id} today={localDay(new Date(), ctx.timezone)} />
          {data.absences.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noAbsences")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {data.absences.map((a) => {
                const label = `${formatDate(a.startsAt, ctx.timezone, locale)} → ${formatDate(
                  new Date(a.endsAt.getTime() - 1),
                  ctx.timezone,
                  locale,
                )}`;
                return (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <span>
                      {label}
                      {a.reason && <span className="text-muted-foreground"> · {a.reason}</span>}
                    </span>
                    <ActionButton
                      action={deleteAbsenceAction}
                      fields={{ absenceId: a.id }}
                      variant="ghost"
                      aria-label={t("deleteAbsenceFor", { label })}
                    >
                      {t("deleteAbsence")}
                    </ActionButton>
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
