import { ZodError } from "zod";
import { firstIssue } from "@/lib/validation";
import { DomainError } from "@/server/errors";

/** Résultat sérialisable d'une Server Action ; `error` est une clé de traduction (errors.*). */
export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof ZodError) return { ok: false, error: firstIssue(error) };
    if (error instanceof DomainError) return { ok: false, error: error.code };
    console.error("[action] erreur inattendue", error);
    return { ok: false, error: "unexpected" };
  }
}
