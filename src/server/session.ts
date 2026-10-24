import "server-only";
import { cache } from "react";
import { auth } from "@/auth";
import { systemDb } from "@/server/db";
import type { TenantContext } from "@/server/context";
import type { Role } from "@/server/tenancy/permissions";

/**
 * Contexte de la requête courante. Le rôle et le tenant sont relus en base
 * (la membership a pu être supprimée depuis l'émission du JWT).
 */
export const getTenantContext = cache(async (): Promise<TenantContext | null> => {
  const session = await auth();
  if (!session?.user?.membershipId) return null;
  const membership = await systemDb.membership.findUnique({
    where: { id: session.user.membershipId },
    include: { tenant: true, user: { select: { name: true } } },
  });
  if (!membership || membership.userId !== session.user.id) return null;
  return {
    tenantId: membership.tenantId,
    tenantSlug: membership.tenant.slug,
    tenantName: membership.tenant.name,
    timezone: membership.tenant.timezone,
    currency: membership.tenant.currency,
    userId: membership.userId,
    userName: membership.user.name,
    membershipId: membership.id,
    role: membership.role as Role,
  };
});
