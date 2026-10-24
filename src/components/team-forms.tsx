"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createServiceAction, inviteAction } from "@/actions/team";
import { FormError, FormSuccess } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

export function InviteForm() {
  const t = useTranslations("team");
  const tRoles = useTranslations("roles");
  const [state, action, pending] = useActionState(inviteAction, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="invite-email">{t("email")}</Label>
        <Input id="invite-email" name="email" type="email" required className="w-64" autoComplete="off" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="invite-role">{t("role")}</Label>
        <NativeSelect id="invite-role" name="role" defaultValue="PRACTITIONER" className="w-48">
          <option value="PRACTITIONER">{tRoles("PRACTITIONER")}</option>
          <option value="SECRETARY">{tRoles("SECRETARY")}</option>
        </NativeSelect>
      </div>
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {t("invite")}
      </Button>
      <div className="basis-full">
        <FormError state={state} />
        <FormSuccess state={state} message={t("invited")} />
      </div>
    </form>
  );
}

export function ServiceForm() {
  const t = useTranslations("services");
  const [state, action, pending] = useActionState(createServiceAction, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="service-name">{t("name")}</Label>
        <Input id="service-name" name="name" required className="w-64" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="service-duration">{t("duration")}</Label>
        <Input
          id="service-duration"
          name="durationMin"
          type="number"
          min={5}
          max={480}
          step={5}
          defaultValue={30}
          required
          className="w-28"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="service-price">{t("price")}</Label>
        <Input id="service-price" name="price" inputMode="decimal" required className="w-28" placeholder="35,00" />
      </div>
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {t("add")}
      </Button>
      <div className="basis-full">
        <FormError state={state} />
        <FormSuccess state={state} message={t("added")} />
      </div>
    </form>
  );
}
