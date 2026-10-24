/**
 * Données de démonstration (idempotent) : deux cabinets isolés.
 *  - cabinet-demo     : cabinet de kinésithérapie à Lyon (3 membres, historique d'un mois)
 *  - clinique-lumiere : clinique esthétique à Casablanca (second tenant, sert aux tests d'isolation)
 * Mot de passe de tous les comptes de démo : Demo1234!
 */
import bcrypt from "bcryptjs";
import { PrismaClient, type AppointmentStatus } from "@prisma/client";
import { addDays, localDay, weekdayOf, zonedToUtc } from "../src/lib/time";
import { formatInvoiceNumber } from "../src/server/billing/numbering";

const prisma = new PrismaClient();
export const DEMO_PASSWORD = "Demo1234!";

// Générateur pseudo-aléatoire déterministe (données reproductibles)
let seed = 42;
function rand(): number {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}

interface Rule {
  weekday: number;
  start: number;
  end: number;
}
const h = (hh: number, mm = 0) => hh * 60 + mm;
const weekdays = (days: number[], start: number, end: number): Rule[] =>
  days.map((weekday) => ({ weekday, start, end }));

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const slugs = ["cabinet-demo", "clinique-lumiere"];
  const emails = [
    "claire@demo.uimad-agenda.test",
    "youssef@demo.uimad-agenda.test",
    "sophie@demo.uimad-agenda.test",
    "nadia@lumiere.uimad-agenda.test",
  ];
  await prisma.tenant.deleteMany({ where: { slug: { in: slugs } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });

  await seedTenant({
    slug: "cabinet-demo",
    name: "Cabinet Kiné Les Tilleuls",
    address: "12 rue des Tilleuls, 69003 Lyon",
    timezone: "Europe/Paris",
    currency: "EUR",
    passwordHash,
    members: [
      {
        email: emails[0],
        name: "Claire Martin",
        role: "OWNER",
        rules: [...weekdays([1, 2, 3, 4, 5], h(9), h(12)), ...weekdays([1, 2, 3, 4, 5], h(14), h(18))],
      },
      {
        email: emails[1],
        name: "Youssef Benali",
        role: "PRACTITIONER",
        rules: [...weekdays([1, 2, 3, 4, 5, 6], h(8, 30), h(13)), ...weekdays([2, 4], h(14), h(19))],
      },
      { email: emails[2], name: "Sophie Durand", role: "SECRETARY", rules: [] },
    ],
    services: [
      { name: "Séance de kinésithérapie", durationMin: 30, priceCents: 3500 },
      { name: "Bilan initial", durationMin: 45, priceCents: 5000 },
      { name: "Rééducation post-opératoire", durationMin: 45, priceCents: 4500 },
      { name: "Drainage lymphatique", durationMin: 60, priceCents: 6000 },
    ],
    clients: [
      ["Lucas Bernard", "lucas.bernard@example.com", "fr"],
      ["Emma Petit", "emma.petit@example.com", "fr"],
      ["Hugo Moreau", "hugo.moreau@example.com", "fr"],
      ["Léa Fournier", "lea.fournier@example.com", "fr"],
      ["Amine Haddad", "amine.haddad@example.com", "ar"],
      ["Sarah Cohen", "sarah.cohen@example.com", "fr"],
      ["James Wilson", "james.wilson@example.com", "en"],
      ["Inès Lambert", "ines.lambert@example.com", "fr"],
    ],
    pastDays: 30,
    futureDays: 10,
  });

  await seedTenant({
    slug: "clinique-lumiere",
    name: "Clinique Lumière",
    address: "45 boulevard d'Anfa, Casablanca",
    timezone: "Africa/Casablanca",
    currency: "MAD",
    passwordHash,
    members: [
      {
        email: emails[3],
        name: "Nadia El Amrani",
        role: "OWNER",
        rules: weekdays([1, 2, 3, 4, 5, 6], h(10), h(18)),
      },
    ],
    services: [
      { name: "Soin du visage", durationMin: 60, priceCents: 45000 },
      { name: "Consultation esthétique", durationMin: 30, priceCents: 30000 },
    ],
    clients: [
      ["Salma Idrissi", "salma.idrissi@example.com", "ar"],
      ["Karim Tazi", "karim.tazi@example.com", "fr"],
    ],
    pastDays: 10,
    futureDays: 5,
  });

  console.log("Seed terminé : cabinet-demo et clinique-lumiere (mot de passe de démo : Demo1234!)");
}

interface TenantSeed {
  slug: string;
  name: string;
  address: string;
  timezone: string;
  currency: string;
  passwordHash: string;
  members: { email: string; name: string; role: "OWNER" | "PRACTITIONER" | "SECRETARY"; rules: Rule[] }[];
  services: { name: string; durationMin: number; priceCents: number }[];
  clients: [string, string, string][];
  pastDays: number;
  futureDays: number;
}

async function seedTenant(t: TenantSeed) {
  const tenant = await prisma.tenant.create({
    data: { slug: t.slug, name: t.name, address: t.address, timezone: t.timezone, currency: t.currency },
  });
  const services = await Promise.all(
    t.services.map((s) => prisma.service.create({ data: { ...s, tenantId: tenant.id } })),
  );
  const clients = await Promise.all(
    t.clients.map(([name, email, locale]) => prisma.client.create({ data: { tenantId: tenant.id, name, email, locale } })),
  );

  const now = new Date();
  const today = localDay(now, t.timezone);
  let invoiceSeq = 0;
  const year = Number(today.slice(0, 4));

  for (const m of t.members) {
    const user = await prisma.user.create({ data: { email: m.email, name: m.name, passwordHash: t.passwordHash } });
    const membership = await prisma.membership.create({ data: { tenantId: tenant.id, userId: user.id, role: m.role } });
    if (m.rules.length === 0) continue;
    await prisma.availability.createMany({
      data: m.rules.map((r) => ({
        tenantId: tenant.id,
        membershipId: membership.id,
        weekday: r.weekday,
        startMinute: r.start,
        endMinute: r.end,
      })),
    });

    // Historique et agenda : remplissage partiel des plages pour laisser des créneaux libres
    for (let offset = -t.pastDays; offset <= t.futureDays; offset++) {
      const day = addDays(today, offset);
      const wd = weekdayOf(day);
      for (const rule of m.rules.filter((r) => r.weekday === wd)) {
        let minute = rule.start;
        while (minute < rule.end) {
          const service = services[Math.floor(rand() * services.length)];
          if (minute + service.durationMin > rule.end) break;
          const fill = offset < 0 ? 0.7 : 0.35;
          if (rand() < fill) {
            const startsAt = zonedToUtc(day, minute, t.timezone);
            const endsAt = new Date(startsAt.getTime() + service.durationMin * 60000);
            const past = endsAt < now;
            let status: AppointmentStatus = "BOOKED";
            if (past) {
              const r = rand();
              status = r < 0.82 ? "COMPLETED" : r < 0.92 ? "NO_SHOW" : "CANCELLED";
            } else if (startsAt < now) {
              minute += service.durationMin;
              continue;
            }
            const appt = await prisma.appointment.create({
              data: {
                tenantId: tenant.id,
                membershipId: membership.id,
                serviceId: service.id,
                clientId: clients[Math.floor(rand() * clients.length)].id,
                startsAt,
                endsAt,
                status,
              },
            });
            // La plupart des séances honorées sont facturées, certaines restent à facturer
            if (status === "COMPLETED" && offset < -1 && rand() < 0.85) {
              invoiceSeq++;
              const paid = offset < -7 ? rand() < 0.85 : rand() < 0.4;
              await prisma.invoice.create({
                data: {
                  tenantId: tenant.id,
                  appointmentId: appt.id,
                  number: formatInvoiceNumber(year, invoiceSeq),
                  amountCents: service.priceCents,
                  status: paid ? "PAID" : "UNPAID",
                  issuedAt: endsAt,
                  paidAt: paid ? new Date(endsAt.getTime() + 86400000) : null,
                },
              });
            }
          }
          minute += service.durationMin;
        }
      }
    }
  }
  if (invoiceSeq > 0) {
    await prisma.invoiceCounter.create({ data: { tenantId: tenant.id, year, last: invoiceSeq } });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
