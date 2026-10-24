"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { acceptInviteAction, loginAction, signupAction } from "@/actions/auth";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Field({
  id,
  label,
  hint,
  ...props
}: { id: string; label: string; hint?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} aria-describedby={hint ? `${id}-hint` : undefined} {...props} />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

export function LoginForm() {
  const locale = useLocale();
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(loginAction.bind(null, locale), null);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field id="email" label={t("email")} type="email" autoComplete="email" required />
      <Field id="password" label={t("password")} type="password" autoComplete="current-password" required />
      <FormError state={state} />
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {t("loginSubmit")}
      </Button>
    </form>
  );
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function SignupForm() {
  const locale = useLocale();
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(signupAction.bind(null, locale), null);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field
        id="cabinetName"
        label={t("cabinetName")}
        required
        autoComplete="organization"
        onChange={(e) => !slugTouched && setSlug(slugify(e.target.value))}
      />
      <Field
        id="slug"
        label={t("slug")}
        hint={t("slugHint", { slug: slug || "mon-cabinet" })}
        required
        value={slug}
        onChange={(e) => {
          setSlugTouched(true);
          setSlug(e.target.value);
        }}
      />
      <Field id="ownerName" label={t("ownerName")} required autoComplete="name" />
      <Field id="email" label={t("email")} type="email" required autoComplete="email" />
      <Field
        id="password"
        label={t("password")}
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        hint={t("passwordHint")}
      />
      <FormError state={state} />
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {t("signupSubmit")}
      </Button>
    </form>
  );
}

export function AcceptInviteForm({ token, email }: { token: string; email: string }) {
  const locale = useLocale();
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(acceptInviteAction.bind(null, locale), null);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <Field id="email" label={t("email")} value={email} readOnly disabled />
      <Field id="name" label={t("ownerName")} required autoComplete="name" />
      <Field
        id="password"
        label={t("password")}
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        hint={t("passwordHint")}
      />
      <FormError state={state} />
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {t("acceptSubmit")}
      </Button>
    </form>
  );
}
