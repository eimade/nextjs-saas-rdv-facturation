"use client";

import { useTranslations } from "next-intl";
import type { ActionResult } from "@/actions/result";

export function useErrorMessage() {
  const t = useTranslations("errors");
  return (code: string) => (t.has(code) ? t(code) : t("unexpected"));
}

/** Zone d'erreur annoncée aux technologies d'assistance. */
export function FormError({ state, id }: { state: ActionResult<unknown> | null; id?: string }) {
  const message = useErrorMessage();
  return (
    <p id={id} role="alert" aria-live="assertive" className="text-sm font-medium text-destructive empty:hidden">
      {state && !state.ok ? message(state.error) : ""}
    </p>
  );
}

export function FormSuccess({ state, message }: { state: ActionResult<unknown> | null; message: string }) {
  return (
    <p role="status" aria-live="polite" className="text-sm font-medium text-success empty:hidden">
      {state?.ok ? message : ""}
    </p>
  );
}
