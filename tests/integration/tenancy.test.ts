import { describe, expect, it } from "vitest";
import { withTenant, systemDb } from "@/server/db";
import { DomainError } from "@/server/errors";
import { ForbiddenError } from "@/server/tenancy/permissions";
import {
  acceptInvitation,
  createService,
  inviteMember,
  listServices,
  signupCabinet,
  verifyCredentials,
} from "@/server/tenancy/tenancy-service";
import type { MailMessage } from "@/server/notifications/mailer";
import { contextFor, createCabinet, uid } from "./helpers";

describe("isolation multi-tenant (Row Level Security PostgreSQL)", () => {
  it("chaque cabinet ne voit que ses propres prestations", async () => {
    const a = await createCabinet("a");
    const b = await createCabinet("b");
    await createService(b.owner, { name: "Prestation B", durationMin: 15, price: 10 });

    const servicesA = await listServices(a.owner);
    expect(servicesA.every((s) => s.tenantId === a.owner.tenantId)).toBe(true);
    expect(servicesA.map((s) => s.name)).not.toContain("Prestation B");
  });

  it("la base refuse la lecture d'un autre tenant même avec un filtre explicite", async () => {
    const a = await createCabinet("a");
    const b = await createCabinet("b");
    const leaked = await withTenant(a.owner.tenantId, (tx) =>
      tx.service.findMany({ where: { tenantId: b.owner.tenantId } }),
    );
    expect(leaked).toHaveLength(0);
  });

  it("la base refuse l'écriture dans un autre tenant (WITH CHECK)", async () => {
    const a = await createCabinet("a");
    const b = await createCabinet("b");
    await expect(
      withTenant(a.owner.tenantId, (tx) =>
        tx.service.create({ data: { tenantId: b.owner.tenantId, name: "Intrus", durationMin: 30, priceCents: 0 } }),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("sans tenant positionné, aucune ligne n'est visible", async () => {
    await createCabinet("c");
    const rows = await systemDb.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL ROLE uimad_agenda_app");
      return tx.service.findMany();
    });
    expect(rows).toHaveLength(0);
  });
});

describe("inscription et équipe", () => {
  it("refuse un slug déjà pris ou réservé", async () => {
    const a = await createCabinet("dup");
    const input = { cabinetName: "Autre", ownerName: "Jean Test", email: `x-${uid()}@test.local`, password: "Password123!" };
    await expect(signupCabinet({ ...input, slug: a.owner.tenantSlug })).rejects.toThrow(DomainError);
    await expect(signupCabinet({ ...input, slug: "admin" })).rejects.toThrow("slugTaken");
  });

  it("invite une secrétaire, envoie l'email et crée son compte avec le bon rôle", async () => {
    const { owner } = await createCabinet("team");
    const outbox: MailMessage[] = [];
    const email = `secretaire-${uid()}@test.local`;
    const { url } = await inviteMember(owner, { email, role: "SECRETARY" }, async (m) => {
      outbox.push(m);
    });
    expect(outbox).toHaveLength(1);
    expect(outbox[0].text).toContain(url);

    const token = url.split("/").at(-1)!;
    await acceptInvitation({ token, name: "Sophie Test", password: "Password123!" });
    const user = await verifyCredentials(email, "Password123!");
    expect(user?.role).toBe("SECRETARY");
    expect(user?.tenantId).toBe(owner.tenantId);

    // jeton à usage unique
    await expect(acceptInvitation({ token, name: "Sophie Test", password: "Password123!" })).rejects.toThrow(
      "invitationInvalid",
    );
    // une secrétaire ne peut pas inviter
    const secretary = await contextFor(user!.id);
    await expect(inviteMember(secretary, { email: `z-${uid()}@t.local`, role: "PRACTITIONER" }, async () => {})).rejects.toThrow(
      ForbiddenError,
    );
  });
});
