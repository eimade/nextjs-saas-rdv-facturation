"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { addAbsenceAction, saveAvailabilityAction } from "@/actions/agenda";
import { FormError, FormSuccess } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

export interface RuleRow {
  weekday: number;
  start: string;
  end: string;
}

// Lundi → dimanche
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Éditeur des plages hebdomadaires : lignes (jour, début, fin) envoyées en JSON et validées par Zod côté serveur. */
export function AvailabilityEditor({
  membershipId,
  initialRules,
  weekdayNames,
}: {
  membershipId: string;
  initialRules: RuleRow[];
  weekdayNames: string[];
}) {
  const t = useTranslations("availability");
  const [rules, setRules] = useState<RuleRow[]>(initialRules);
  const [state, action, pending] = useActionState(saveAvailabilityAction, null);
  const update = (i: number, patch: Partial<RuleRow>) =>
    setRules((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="membershipId" value={membershipId} />
      <input type="hidden" name="rules" value={JSON.stringify(rules)} />
      {rules.length === 0 && <p className="text-sm text-muted-foreground">{t("noRules")}</p>}
      <ul className="flex flex-col gap-3">
        {rules.map((r, i) => (
          <li key={i} className="flex flex-wrap items-end gap-2 rounded-md border p-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`wd-${i}`}>{t("weekday")}</Label>
              <NativeSelect
                id={`wd-${i}`}
                value={r.weekday}
                onChange={(e) => update(i, { weekday: Number(e.target.value) })}
                className="w-40"
              >
                {WEEK_ORDER.map((d) => (
                  <option key={d} value={d}>
                    {weekdayNames[d]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`start-${i}`}>{t("start")}</Label>
              <Input
                id={`start-${i}`}
                type="time"
                step={900}
                value={r.start}
                onChange={(e) => update(i, { start: e.target.value })}
                className="w-32"
                dir="ltr"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`end-${i}`}>{t("end")}</Label>
              <Input
                id={`end-${i}`}
                type="time"
                step={900}
                value={r.end}
                onChange={(e) => update(i, { end: e.target.value })}
                className="w-32"
                dir="ltr"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("removeRule", { day: weekdayNames[r.weekday], start: r.start, end: r.end })}
              onClick={() => setRules((rs) => rs.filter((_, j) => j !== i))}
            >
              <Trash2 aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setRules((rs) => [...rs, { weekday: 1, start: "09:00", end: "12:00" }])}
        >
          <Plus aria-hidden />
          {t("addRule")}
        </Button>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {t("save")}
        </Button>
      </div>
      <FormError state={state} />
      <FormSuccess state={state} message={t("saved")} />
    </form>
  );
}

export function AbsenceForm({ membershipId, today }: { membershipId: string; today: string }) {
  const t = useTranslations("availability");
  const [state, action, pending] = useActionState(addAbsenceAction, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="membershipId" value={membershipId} />
      <div className="flex flex-col gap-1">
        <Label htmlFor="startDay">{t("absenceStart")}</Label>
        <Input id="startDay" name="startDay" type="date" min={today} required className="w-44" dir="ltr" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="endDay">{t("absenceEnd")}</Label>
        <Input id="endDay" name="endDay" type="date" min={today} required className="w-44" dir="ltr" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="reason">{t("absenceReason")}</Label>
        <Input id="reason" name="reason" maxLength={120} className="w-56" />
      </div>
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {t("addAbsence")}
      </Button>
      <div className="basis-full">
        <FormError state={state} />
        <FormSuccess state={state} message={t("absenceAdded")} />
      </div>
    </form>
  );
}
