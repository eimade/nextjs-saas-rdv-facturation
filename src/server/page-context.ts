import "server-only";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getTenantContext } from "@/server/session";
import type { TenantContext } from "@/server/context";
import { can, type Action } from "@/server/tenancy/permissions";

/**
 * Garde des pages de l'espace cabinet : layout et page étant rendus en parallèle,
 * chaque page vérifie elle-même la session (et éventuellement une permission).
 */
export async function requirePageContext(locale: string, action?: Action): Promise<TenantContext> {
  setRequestLocale(locale);
  const ctx = await getTenantContext();
  if (!ctx) return redirect({ href: "/login", locale });
  if (action && !can(ctx.role, action)) notFound();
  return ctx;
}
