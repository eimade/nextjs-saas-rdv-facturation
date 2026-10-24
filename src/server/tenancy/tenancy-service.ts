import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { acceptInviteSchema, inviteSchema, serviceSchema, signupSchema } from "@/lib/validation";
import { enterTenant, isUniqueViolation, systemDb, withNewTenantTransaction, withTenant } from "@/server/db";
import type { TenantContext } from "@/server/context";
import { DomainError, NotFoundError } from "@/server/errors";
import type { SendMail } from "@/server/notifications/mailer";
import { assertCan, type Role } from "@/server/tenancy/permissions";

const INVITE_TTL_DAYS = 7;
const RESERVED_SLUGS = new Set(["api", "app", "admin", "login", "signup", "book", "invite", "fr", "en", "ar"]);

/** Inscription d'un cabinet : crée le tenant, le compte propriétaire et sa membership (atomique). */
export async function signupCabinet(input: unknown) {
  const data = signupSchema.parse(input);
  if (RESERVED_SLUGS.has(data.slug)) throw new DomainError("slugTaken");
  const passwordHash = await bcrypt.hash(data.password, 10);
  try {
    return await withNewTenantTransaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { name: data.cabinetName, slug: data.slug } });
      const user = await tx.user.create({ data: { email: data.email, name: data.ownerName, passwordHash } });
      await tx.$queryRaw`SELECT set_config('app.tenant_id', ${tenant.id}, true)`;
      await tx.membership.create({ data: { tenantId: tenant.id, userId: user.id, role: "OWNER" } });
      return { tenantId: tenant.id, userId: user.id };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const target = String((error as { meta?: { target?: unknown } }).meta?.target ?? "");
      throw new DomainError(target.includes("slug") ? "slugTaken" : "emailTaken");
    }
    throw error;
  }
}

/** Vérification des identifiants (contexte système : l'utilisateur n'a pas encore de tenant actif). */
export async function verifyCredentials(email: string, password: string) {
  const user = await systemDb.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: { membership: true },
  });
  if (!user || !user.membership) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    tenantId: user.membership.tenantId,
    membershipId: user.membership.id,
    role: user.membership.role as Role,
  };
}

export async function listTeam(ctx: TenantContext) {
  return withTenant(ctx.tenantId, async (tx) => {
    const [members, invitations] = await Promise.all([
      tx.membership.findMany({
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, user: { select: { name: true, email: true } } },
      }),
      tx.invitation.findMany({
        where: { acceptedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, role: true, token: true, expiresAt: true },
      }),
    ]);
    return { members, invitations };
  });
}

export function invitationUrl(token: string, locale = "fr"): string {
  const base = process.env.APP_URL ?? "http://localhost:13000";
  return `${base}/${locale}/invite/${token}`;
}

/** Invitation d'un membre : jeton à usage unique valable 7 jours, envoyé par email. */
export async function inviteMember(ctx: TenantContext, input: unknown, sendMail: SendMail) {
  assertCan(ctx.role, "team:manage");
  const data = inviteSchema.parse(input);
  const existing = await systemDb.user.findUnique({ where: { email: data.email } });
  if (existing) throw new DomainError("emailTaken");
  const token = randomBytes(24).toString("base64url");
  const invitation = await withTenant(ctx.tenantId, (tx) =>
    tx.invitation.create({
      data: {
        tenantId: ctx.tenantId,
        email: data.email,
        role: data.role,
        token,
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86400000),
      },
    }),
  );
  const url = invitationUrl(token);
  try {
    await sendMail({
      to: data.email,
      subject: `Invitation à rejoindre ${ctx.tenantName} sur Kalendo`,
      text: `Bonjour,\n\n${ctx.userName} vous invite à rejoindre ${ctx.tenantName} sur Kalendo.\nCréez votre compte : ${url}\n\nCe lien expire dans ${INVITE_TTL_DAYS} jours.`,
    });
  } catch (error) {
    // L'invitation reste valable : le lien est aussi affiché dans l'écran Équipe.
    console.error("[invite] envoi email impossible", error);
  }
  return { id: invitation.id, url };
}

/** Lecture d'une invitation par jeton (contexte système : le visiteur n'est pas authentifié). */
export async function findInvitation(token: string) {
  const inv = await systemDb.invitation.findUnique({
    where: { token },
    include: { tenant: { select: { name: true } } },
  });
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) return null;
  return { email: inv.email, role: inv.role, tenantName: inv.tenant.name, tenantId: inv.tenantId };
}

export async function acceptInvitation(input: unknown) {
  const data = acceptInviteSchema.parse(input);
  const inv = await systemDb.invitation.findUnique({ where: { token: data.token } });
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) throw new DomainError("invitationInvalid");
  const passwordHash = await bcrypt.hash(data.password, 10);
  try {
    return await systemDb.$transaction(async (tx) => {
      await enterTenant(tx, inv.tenantId);
      const claimed = await tx.invitation.updateMany({
        where: { id: inv.id, acceptedAt: null },
        data: { acceptedAt: new Date() },
      });
      if (claimed.count !== 1) throw new DomainError("invitationInvalid");
      const user = await tx.user.create({ data: { email: inv.email, name: data.name, passwordHash } });
      await tx.membership.create({ data: { tenantId: inv.tenantId, userId: user.id, role: inv.role } });
      return { email: inv.email };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError("emailTaken");
    throw error;
  }
}

// --- Prestations ---------------------------------------------------------

export async function listServices(ctx: TenantContext) {
  return withTenant(ctx.tenantId, (tx) => tx.service.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }));
}

export async function createService(ctx: TenantContext, input: unknown) {
  assertCan(ctx.role, "services:manage");
  const data = serviceSchema.parse(input);
  return withTenant(ctx.tenantId, (tx) =>
    tx.service.create({
      data: {
        tenantId: ctx.tenantId,
        name: data.name,
        durationMin: data.durationMin,
        priceCents: Math.round(data.price * 100),
      },
    }),
  );
}

export async function toggleService(ctx: TenantContext, serviceId: string) {
  assertCan(ctx.role, "services:manage");
  return withTenant(ctx.tenantId, async (tx) => {
    const service = await tx.service.findFirst({ where: { id: serviceId } });
    if (!service) throw new NotFoundError();
    return tx.service.update({ where: { id: service.id }, data: { active: !service.active } });
  });
}
