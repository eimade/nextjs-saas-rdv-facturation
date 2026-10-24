"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { bookAction, getSlotsAction } from "@/actions/booking";
import type { BookingResult, DaySlots } from "@/server/booking/booking-service";
import { useErrorMessage } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { localDay } from "@/lib/time";
import { cn, formatDate, formatMoney, formatTime, intlLocale } from "@/lib/utils";

interface Props {
  slug: string;
  timezone: string;
  currency: string;
  services: { id: string; name: string; durationMin: number; priceCents: number }[];
  practitioners: { id: string; name: string }[];
}

type Step = 1 | 2 | 3 | 4;

const choiceClass =
  "flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-4 hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-accent has-[:checked]:ring-2 has-[:checked]:ring-primary has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring";

/** Parcours de réservation publique en 3 étapes, pensé mobile d'abord et utilisable au clavier. */
export function BookingWizard({ slug, timezone, currency, services, practitioners }: Props) {
  const t = useTranslations("booking");
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const [step, setStep] = useState<Step>(1);
  const [serviceId, setServiceId] = useState(services.length === 1 ? services[0].id : "");
  const [membershipId, setMembershipId] = useState(practitioners.length === 1 ? practitioners[0].id : "");
  const [days, setDays] = useState<DaySlots[] | null>(null);
  const [day, setDay] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<BookingResult | null>(null);
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const service = services.find((s) => s.id === serviceId);
  const practitioner = practitioners.find((p) => p.id === membershipId);
  const dayLabel = (d: string) =>
    new Intl.DateTimeFormat(intlLocale(locale), {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${d}T12:00:00Z`));

  // Jour de la semaine et date sur deux lignes : évite le débordement des libellés longs (arabe)
  const fmtDay = (d: string, o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(intlLocale(locale), { ...o, timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
  const weekdayLabel = (d: string) => fmtDay(d, { weekday: "short" });
  const dateLabel = (d: string) => fmtDay(d, { day: "numeric", month: "short" });

  function loadSlots(keepError = false) {
    if (!keepError) setError("");
    startTransition(async () => {
      const res = await getSlotsAction(slug, {
        serviceId,
        membershipId,
        fromDay: localDay(new Date(), timezone),
      });
      if (!res.ok) {
        setError(errorMessage(res.error));
        return;
      }
      const list = res.data ?? [];
      setDays(list);
      const firstDay = list.find((d) => d.slots.length > 0)?.day ?? "";
      setDay(firstDay);
      setStartsAt("");
      setStep(2);
    });
  }

  function confirm(fd: FormData) {
    setError("");
    startTransition(async () => {
      const res = await bookAction(slug, {
        serviceId,
        membershipId,
        startsAt,
        name: fd.get("name"),
        email: fd.get("email"),
        phone: fd.get("phone") || undefined,
        locale,
      });
      if (res.ok && res.data) {
        setResult(res.data);
        setStep(4);
      } else if (!res.ok) {
        setError(errorMessage(res.error));
        if (res.error === "slotUnavailable") loadSlots(true);
      }
    });
  }

  if (services.length === 0 || practitioners.length === 0) {
    return <p className="rounded-lg border p-4">{t("unavailable")}</p>;
  }

  const steps = [t("step1"), t("step2"), t("step3")];
  const selectedDay = days?.find((d) => d.day === day);

  return (
    <div className="flex flex-col gap-6">
      {step < 4 && (
        <ol aria-label={t("progress")} className="grid grid-cols-3 gap-2 text-sm">
          {steps.map((label, i) => {
            const n = i + 1;
            const state = n < step ? "done" : n === step ? "current" : "todo";
            return (
              <li
                key={label}
                aria-current={state === "current" ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md border-b-4 pb-2",
                  state === "todo" ? "border-border text-muted-foreground" : "border-primary font-semibold",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs",
                    state === "todo" ? "bg-muted" : "bg-primary text-primary-foreground",
                  )}
                >
                  {n}
                </span>
                <span>
                  <span className="sr-only">{t("stepOf", { n, total: 3 })} </span>
                  {label}
                  {state === "done" && <span className="sr-only"> ({t("completed")})</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <p role="alert" aria-live="assertive" className="text-sm font-medium text-destructive empty:hidden">
        {error}
      </p>

      {step === 1 && (
        <section aria-labelledby="step-title" className="flex flex-col gap-6">
          <h2 id="step-title" ref={headingRef} tabIndex={-1} className="text-xl font-semibold">
            {t("step1Title")}
          </h2>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-medium">{t("service")}</legend>
            {services.map((s) => (
              <label key={s.id} className={choiceClass}>
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="service"
                    value={s.id}
                    checked={serviceId === s.id}
                    onChange={() => setServiceId(s.id)}
                    className="size-4 accent-[var(--primary)]"
                  />
                  <span>
                    <span className="block font-medium">{s.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {t("duration", { minutes: s.durationMin })}
                    </span>
                  </span>
                </span>
                <span className="font-semibold">{formatMoney(s.priceCents, currency, locale)}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-medium">{t("practitioner")}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {practitioners.map((p) => (
                <label key={p.id} className={choiceClass}>
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="practitioner"
                      value={p.id}
                      checked={membershipId === p.id}
                      onChange={() => setMembershipId(p.id)}
                      className="size-4 accent-[var(--primary)]"
                    />
                    <span className="font-medium">{p.name}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <Button
            size="lg"
            className="self-stretch sm:self-end"
            disabled={!serviceId || !membershipId || pending}
            aria-busy={pending}
            onClick={() => loadSlots()}
          >
            {pending ? t("loading") : t("next")}
          </Button>
        </section>
      )}

      {step === 2 && days && (
        <section aria-labelledby="step-title" className="flex flex-col gap-6">
          <h2 id="step-title" ref={headingRef} tabIndex={-1} className="text-xl font-semibold">
            {t("step2Title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("timezoneNote", { timezone })}</p>
          {days.every((d) => d.slots.length === 0) ? (
            <p className="rounded-lg border p-4">{t("noSlots")}</p>
          ) : (
            <>
              <div role="group" aria-label={t("chooseDay")} className="flex gap-2 overflow-x-auto pb-2">
                {days.map((d) => (
                  <Button
                    key={d.day}
                    type="button"
                    variant={d.day === day ? "default" : "outline"}
                    className="h-auto min-w-24 shrink-0 flex-col gap-0.5 whitespace-normal py-2 text-center"
                    disabled={d.slots.length === 0}
                    aria-pressed={d.day === day}
                    onClick={() => {
                      setDay(d.day);
                      setStartsAt("");
                    }}
                  >
                    <span className="text-xs font-normal">{weekdayLabel(d.day)}</span>
                    <span>{dateLabel(d.day)}</span>
                    <span className="text-xs font-normal">
                      {d.slots.length === 0 ? t("full") : t("slotsCount", { count: d.slots.length })}
                    </span>
                  </Button>
                ))}
              </div>
              {selectedDay && (
                <div role="group" aria-label={t("chooseTime", { day: dayLabel(selectedDay.day) })}>
                  <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {selectedDay.slots.map((iso) => (
                      <li key={iso}>
                        <Button
                          type="button"
                          className="w-full"
                          variant={iso === startsAt ? "default" : "outline"}
                          aria-pressed={iso === startsAt}
                          onClick={() => setStartsAt(iso)}
                        >
                          {formatTime(new Date(iso), timezone, locale)}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" size="lg" onClick={() => setStep(1)}>
              {t("back")}
            </Button>
            <Button size="lg" disabled={!startsAt} onClick={() => setStep(3)}>
              {t("next")}
            </Button>
          </div>
        </section>
      )}

      {step === 3 && service && practitioner && (
        <section aria-labelledby="step-title" className="flex flex-col gap-6">
          <h2 id="step-title" ref={headingRef} tabIndex={-1} className="text-xl font-semibold">
            {t("step3Title")}
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border bg-muted p-4 text-sm">
            <dt className="font-medium">{t("service")}</dt>
            <dd>
              {service.name} ({formatMoney(service.priceCents, currency, locale)})
            </dd>
            <dt className="font-medium">{t("practitioner")}</dt>
            <dd>{practitioner.name}</dd>
            <dt className="font-medium">{t("when")}</dt>
            <dd>
              {formatDate(new Date(startsAt), timezone, locale, true)} – {formatTime(new Date(startsAt), timezone, locale)}
            </dd>
          </dl>
          <form action={confirm} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">{t("name")}</Label>
              <Input id="name" name="name" required autoComplete="name" minLength={2} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" aria-describedby="email-hint" />
              <p id="email-hint" className="text-xs text-muted-foreground">
                {t("emailHint")}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">{t("phone")}</Label>
              <Input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" dir="ltr" />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button type="button" variant="outline" size="lg" onClick={() => setStep(2)}>
                {t("back")}
              </Button>
              <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
                {pending ? t("loading") : t("confirm")}
              </Button>
            </div>
          </form>
        </section>
      )}

      {step === 4 && result && (
        <section aria-labelledby="step-title" role="status" className="flex flex-col items-start gap-4 rounded-lg border p-6">
          <CheckCircle2 aria-hidden className="size-10 text-success" />
          <h2 id="step-title" ref={headingRef} tabIndex={-1} className="text-xl font-semibold">
            {t("doneTitle")}
          </h2>
          <p>
            {t("doneText", {
              service: result.serviceName,
              practitioner: result.practitionerName,
              date: formatDate(new Date(result.startsAt), timezone, locale, true),
              time: formatTime(new Date(result.startsAt), timezone, locale),
            })}
          </p>
          <p className="text-sm text-muted-foreground">{t("doneReminder")}</p>
          <Button
            variant="outline"
            onClick={() => {
              setResult(null);
              setStartsAt("");
              setStep(1);
            }}
          >
            {t("again")}
          </Button>
        </section>
      )}
    </div>
  );
}
