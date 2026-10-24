"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button, type ButtonProps } from "@/components/ui/button";
import { FormError } from "@/components/form-error";
import type { ActionResult } from "@/actions/result";

type Action = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

/** Bouton déclenchant une Server Action avec champs cachés ; l'erreur éventuelle est annoncée (aria-live). */
export function ActionButton({
  action,
  fields,
  children,
  variant = "outline",
  size = "sm",
  ...rest
}: {
  action: Action;
  fields: Record<string, string>;
  children: React.ReactNode;
} & Pick<ButtonProps, "variant" | "size" | "aria-label">) {
  const [state, formAction, pending] = useActionState(action, null);
  const t = useTranslations("common");
  return (
    <form action={formAction} className="inline-flex flex-col gap-1">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Button type="submit" variant={variant} size={size} disabled={pending} aria-busy={pending} {...rest}>
        {pending ? t("pending") : children}
      </Button>
      <FormError state={state} />
    </form>
  );
}
