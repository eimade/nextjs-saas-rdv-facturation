import type { Role } from "@/server/tenancy/permissions";

/** Contexte d'exécution d'une requête authentifiée, transmis à la couche service. */
export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  timezone: string;
  currency: string;
  userId: string;
  userName: string;
  membershipId: string;
  role: Role;
}
