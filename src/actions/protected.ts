import "server-only";
import { getTenantContext } from "@/server/session";
import { DomainError } from "@/server/errors";
import type { TenantContext } from "@/server/context";

export async function requireContext(): Promise<TenantContext> {
  const ctx = await getTenantContext();
  if (!ctx) throw new DomainError("unauthenticated");
  return ctx;
}

export function field(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}
