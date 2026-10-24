import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Client Prisma partagé par l'application Next.js et le worker.
 *
 * Deux contextes d'accès :
 *  - `withTenant(tenantId, fn)` : transaction qui endosse le rôle sans privilège
 *    `kalendo_app` (SET LOCAL ROLE) et positionne `app.tenant_id`. Les politiques RLS
 *    PostgreSQL filtrent alors toutes les lectures/écritures sur ce tenant.
 *  - `systemDb` : connexion du rôle propriétaire, réservée aux opérations transverses
 *    explicitement identifiées (connexion, inscription, acceptation d'invitation,
 *    résolution d'un cabinet par son slug, itération des tenants par le worker).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type Tx = Prisma.TransactionClient;

export const systemDb = prisma;

export const APP_DB_ROLE = "kalendo_app";

/** Bascule la transaction courante dans le contexte RLS d'un tenant. */
export async function enterTenant(tx: Tx, tenantId: string): Promise<void> {
  await tx.$executeRawUnsafe(`SET LOCAL ROLE ${APP_DB_ROLE}`);
  await tx.$queryRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
}

export async function withTenant<T>(tenantId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await enterTenant(tx, tenantId);
      return fn(tx);
    },
    { timeout: 15_000, maxWait: 10_000 },
  );
}

/** Transaction RLS dont le tenant est créé à l'intérieur (inscription d'un cabinet). */
export async function withNewTenantTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE ${APP_DB_ROLE}`);
      return fn(tx);
    },
    { timeout: 15_000, maxWait: 10_000 },
  );
}

/** Violation de la contrainte d'exclusion anti-chevauchement (SQLSTATE 23P01). */
export function isOverlapViolation(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("appointments_no_overlap") || msg.includes("23P01");
}

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
