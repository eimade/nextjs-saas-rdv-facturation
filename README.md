# Uimad Agenda — SaaS multi-tenant de prise de rendez-vous et de facturation pour cabinets

[![CI](https://github.com/eimade/nextjs-saas-rdv-facturation/actions/workflows/ci.yml/badge.svg)](https://github.com/eimade/nextjs-saas-rdv-facturation/actions/workflows/ci.yml)

Projet de démonstration (MVP) : Next.js 15 (App Router, Server Actions), React 19, TypeScript, Tailwind CSS, shadcn/ui, PostgreSQL 16 + Prisma avec Row Level Security, Auth.js, next-intl (fr / en / ar avec RTL), worker Node.js, tests Vitest + Playwright + axe-core + Lighthouse CI.

## Problématique

Les cabinets indépendants (kinésithérapeutes, orthophonistes, cliniques esthétiques) gèrent rendez-vous, rappels et factures entre agenda papier, WhatsApp et Excel : rendez-vous oubliés, doubles réservations, numéros de facture tenus à la main, aucune vision du chiffre d'affaires.

**Uimad Agenda** donne à chaque cabinet (tenant isolé) :
- une **page de réservation publique** accessible, multilingue et pensée mobile ;
- un **agenda** par praticien avec disponibilités et absences ;
- une **facturation simple** (PDF numéroté, payé / impayé, export CSV) ;
- un **tableau de bord** (remplissage, no-show, CA du mois) ;
- des **rappels email automatiques** la veille.

## Fonctionnalités

| Domaine | Ce qui fonctionne de bout en bout |
|---|---|
| Multi-tenant | Inscription d'un cabinet = tenant + compte propriétaire (transaction atomique). Isolation par **Row Level Security PostgreSQL** (`tenant_id`, rôle `uimad_agenda_app` sans privilège, `FORCE ROW LEVEL SECURITY`). |
| Équipe | Invitation par email (jeton à usage unique, 7 jours) avec rôle **praticien** ou **secrétariat** ; matrice de permissions par rôle. |
| Réservation publique | `/{langue}/book/{cabinet}` : prestation + praticien → créneau (14 jours) → coordonnées → confirmation. Créneau revérifié côté serveur. |
| Agenda | Vue jour / semaine, filtre praticien, statuts honoré / absent / annulé / rétabli. Disponibilités hebdomadaires et absences. |
| Anti double réservation | **Contrainte d'exclusion GiST** PostgreSQL (`tsrange` + `btree_gist`) : deux RDV actifs d'un praticien ne peuvent pas se chevaucher, même en concurrence. |
| Facturation | Facture depuis un RDV honoré, numéro `F-AAAA-NNNN` **continu par cabinet et par année** (compteur verrouillé en base), PDF (pdf-lib), payé / impayé, filtre, export CSV (Excel fr). |
| KPI | Taux de remplissage, taux de no-show, CA facturé, encaissé, reste à encaisser (mois courant, fuseau du cabinet). |
| Rappels | Worker Node.js (`node-cron`) : email la veille, dans la langue de réservation du patient, envoi idempotent et retenté en cas d'échec. |
| i18n / a11y | Français, anglais, arabe (RTL), mode sombre, navigation clavier, lien d'évitement, focus géré, contrastes AA. |
| API | `GET /api/public/{slug}/slots`, `GET /api/invoices/{id}/pdf`, `GET /api/invoices/export`, `GET /api/health`. |
| UX | Dossier [`docs/ux`](docs/ux/README.md) : personas, parcours, wireframes SVG, tests d'utilisabilité et itérations. |

## Lancement en une commande

Prérequis : Docker Desktop.

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Application | http://localhost:13000 |
| Mailpit (emails envoyés : invitations, rappels) | http://localhost:18025 |
| PostgreSQL | `localhost:15432` (uimad_agenda / uimad_agenda) |

Le service `migrate` applique les migrations (schéma, RLS, contrainte d'exclusion) puis charge les données de démo. Arrêt : `docker compose down` (ajouter `-v` pour effacer la base).

**Comptes de démo** (mot de passe `Demo1234!`) :

| Compte | Cabinet | Rôle |
|---|---|---|
| `claire@demo.uimad-agenda.test` | Cabinet Kiné Les Tilleuls (Lyon) | Propriétaire |
| `youssef@demo.uimad-agenda.test` | Cabinet Kiné Les Tilleuls | Praticien |
| `sophie@demo.uimad-agenda.test` | Cabinet Kiné Les Tilleuls | Secrétariat |
| `nadia@lumiere.uimad-agenda.test` | Clinique Lumière (Casablanca, MAD) | Propriétaire (second tenant, sert aux tests d'isolation) |

Page publique : http://localhost:13000/fr/book/cabinet-demo (en arabe : `/ar/book/cabinet-demo`).

### Développement local (sans conteneur applicatif)

```bash
cp .env.example .env              # puis renseigner AUTH_SECRET (npx auth secret)
docker compose up -d db mailpit
npm ci
npm run db:setup                  # migrations + seed
npm run dev                       # http://localhost:13000
npm run worker                    # worker de rappels (autre terminal)
```

## Architecture

```
                 Navigateur (fr / en / ar, RTL, clair / sombre)
                                   │
        ┌──────────────────────────▼───────────────────────────┐
        │ Next.js 15 – App Router                              │
        │  middleware next-intl (préfixe de langue)            │
        │  Server Components (lecture)    Route Handlers (API) │
        │  Server Actions (mutations) ── validation Zod        │
        │  Auth.js (credentials, JWT) → TenantContext          │
        └──────────────────────────┬───────────────────────────┘
                                   │ appelle
        ┌──────────────────────────▼───────────────────────────┐
        │ Couche service par domaine (src/server)              │
        │  tenancy  : inscription, invitations, prestations    │
        │  booking  : créneaux (fonction pure), réservation,   │
        │             agenda, disponibilités, absences         │
        │  billing  : numérotation, factures, PDF, CSV         │
        │  reporting: KPI (fonction pure)                      │
        │  notifications : port SendMail (smtp | console)      │
        └──────────────────────────┬───────────────────────────┘
                                   │ withTenant(tenantId, tx)
                                   │  SET LOCAL ROLE uimad_agenda_app
                                   │  set_config('app.tenant_id')
        ┌──────────────────────────▼───────────────────────────┐
        │ PostgreSQL 16 (Prisma)                               │
        │  politiques RLS par tenant_id (lecture + écriture)   │
        │  EXCLUDE USING gist : pas de chevauchement de RDV    │
        │  invoice_counters : séquence de factures par tenant  │
        └──────────────────────────▲───────────────────────────┘
                                   │ même client Prisma, mêmes services
        ┌──────────────────────────┴───────────────────────────┐
        │ Worker Node.js (worker/index.ts, node-cron)          │
        │  rappels J-1 → SendMail → Mailpit (SMTP local)       │
        └──────────────────────────────────────────────────────┘
```

Arborescence utile :

```
src/app/[locale]/        pages (accueil, login, signup, book/[slug], invite, app/*)
src/app/api/             routes HTTP (créneaux publics, PDF, CSV, santé)
src/actions/             Server Actions (fines : contexte + appel service + revalidation)
src/server/              couche service, accès base, erreurs métier, permissions
src/lib/                 fuseaux horaires (Intl, sans dépendance), validation Zod, formatage
prisma/                  schéma, migrations SQL (RLS, contrainte d'exclusion), seed
worker/                  worker de rappels
tests/unit|integration|e2e
docs/ux/                 personas, parcours, wireframes, tests d'utilisabilité, captures
```

## Exemples d'appels API

```bash
# Créneaux libres d'un praticien (même logique que la page publique)
curl "http://localhost:13000/api/public/cabinet-demo/slots?serviceId=<id>&membershipId=<id>&from=2026-10-26"
# → {"tenant":"cabinet-demo","timezone":"Europe/Paris","days":[{"day":"2026-10-26","slots":["2026-10-26T08:00:00.000Z", …]}, …]}

# Paramètre invalide → 400 avec clé d'erreur traduisible
curl "http://localhost:13000/api/public/cabinet-demo/slots?serviceId=x&membershipId=y&from=2026-13-45"
# → {"error":"invalidDate"}

# Santé (base joignable)
curl http://localhost:13000/api/health   # → {"status":"ok"}

# Export CSV / PDF : authentifiés (cookie de session), 401 sinon, 403 pour un praticien,
# 404 pour une facture d'un autre cabinet.
```

Captures : voir [`docs/ux/captures`](docs/ux/captures) (réservation mobile fr et ar, tableau de bord, agenda, facturation, mode sombre arabe).

## Simulations (aucun compte externe requis)

| Service externe | Simulation | Où |
|---|---|---|
| Envoi d'emails (invitations, rappels) | Port `SendMail` avec deux adaptateurs choisis par `MAIL_TRANSPORT` : `smtp` → **Mailpit**, serveur SMTP de test local (conteneur, interface web sur :18025, aucun email ne sort) ; `console` → bouchon qui journalise et garde les messages en mémoire (tests, CI). | `src/server/notifications/mailer.ts` |
| Paiement | Pas de prestataire de paiement : le paiement est **enregistré manuellement** (« Marquer payée »), comme le fait un cabinet qui encaisse au comptoir. Un adaptateur Stripe ou autre se brancherait sur `setInvoiceStatus`. | `src/server/billing/billing-service.ts` |
| Maquette Figma | Wireframes **SVG versionnés** dans `docs/ux/wireframes` (Figma nécessite un compte) ; ils jouent le rôle de la maquette basse fidélité. | `docs/ux/` |
| Hébergement (Vercel / Neon) | Non déployé : exécution locale via Docker Compose ; l'image Docker est prête pour un VPS. | `Dockerfile`, `docker-compose.yml` |

## Tests

| Niveau | Outil | Ce qui est vérifié | Commande |
|---|---|---|---|
| Unitaires | Vitest | créneaux (pas, durée, prévenance, chevauchements), fuseaux et changement d'heure, numérotation des factures, CSV, PDF, KPI, permissions, validation Zod, emails de rappel fr/en/ar, bouchon email | `npm test` |
| Intégration | Vitest + PostgreSQL réel | **isolation RLS** (lecture, écriture `WITH CHECK`, absence de contexte), inscription, invitations, réservation, **réservations concurrentes**, **contrainte d'exclusion**, absences, séquence de factures par tenant, KPI, worker de rappels (idempotence, reprise après échec), routes API | `npm run test:integration` |
| E2E | Playwright (desktop + mobile Pixel 7) | réservation publique en 3 étapes, validation, RTL, facture → payée → PDF → CSV, droits du praticien, **isolation entre deux cabinets**, redirection non authentifié | `npm run test:e2e` |
| Accessibilité | axe-core dans Playwright | règles WCAG 2.0/2.1 A + AA sur toutes les pages publiques et connectées, en fr et ar, clair et sombre ; lien d'évitement au clavier | inclus dans `npm run test:e2e` |
| Performance / a11y | Lighthouse CI | seuil bloquant accessibilité ≥ 0,9 | `npm run lhci` |

La CI GitHub Actions (`.github/workflows/ci.yml`) exécute à chaque push / PR : lint, typage, tests unitaires, intégration sur PostgreSQL 16, build, E2E + axe, Lighthouse CI.

Les tests d'intégration utilisent la base `uimad_agenda_test` (`TEST_DATABASE_URL`) : `docker exec uimad-agenda-db-1 psql -U uimad_agenda -c "CREATE DATABASE uimad_agenda_test"` la première fois.

### Résultats (exécution locale du 24/10/2026)

| Suite | Résultat |
|---|---|
| Lint + typage (`npm run lint`, `npm run typecheck`) | sans erreur |
| Vitest unitaires | 5 fichiers, **27 tests passés** |
| Vitest intégration (PostgreSQL 16 réel) | 2 fichiers, **16 tests passés** |
| Playwright E2E + axe-core | **23 tests passés** (desktop + mobile Pixel 7) ; **0 violation WCAG 2.0/2.1 A/AA** sur toutes les pages testées |

**Lighthouse (build de production, preset desktop, `npm run lhci`)**

| Page | Performance | Accessibilité | Bonnes pratiques | SEO |
|---|---|---|---|---|
| `/fr` | 90 | 100 | 100 | 100 |
| `/fr/book/cabinet-demo` | 95 | 100 | 100 | 100 |
| `/ar/book/cabinet-demo` (RTL) | 97 | 100 | 100 | 100 |
| `/fr/login` | 94 | 100 | 100 | 100 |

## Choix techniques

- **RLS PostgreSQL plutôt qu'un simple filtre applicatif** : chaque transaction « tenant » endosse un rôle sans privilège (`SET LOCAL ROLE uimad_agenda_app`) et positionne `app.tenant_id` ; un oubli de `where tenantId` dans le code ne peut pas fuiter de données. Les rares accès transverses (connexion, résolution d'un slug public, itération du worker) passent par `systemDb`, explicitement nommé.
- **Contrainte d'exclusion plutôt qu'un verrou applicatif** : la base est le seul arbitre fiable entre deux réservations simultanées ; l'erreur `23P01` est traduite en message « créneau indisponible » et la liste est rafraîchie.
- **Numérotation par compteur `INSERT … ON CONFLICT DO UPDATE … RETURNING`** : séquence continue sans trou (obligation légale française), sûre en concurrence.
- **Fonctions pures pour les règles métier** (`computeSlots`, `computeKpis`, `formatInvoiceNumber`) : testées unitairement sans base.
- **Fuseaux horaires via `Intl`** : chaque cabinet a son fuseau (Paris, Casablanca…), les créneaux sont calculés en heure locale et stockés en UTC ; le changement d'heure est couvert par les tests.
- **Server Actions minces** : validation Zod dans la couche service, erreurs métier = clés de traduction (`errors.*`) affichées dans la langue de l'utilisateur.
- **Accessibilité dès la conception** : composants natifs (radios dans `fieldset`, vrais tableaux, liens pour les filtres), propriétés CSS logiques (`ps-`, `ms-`, `start-`) pour un RTL sans CSS spécifique, focus déplacé à chaque étape du parcours, statuts portés par le texte et non seulement la couleur.
- **Une image Docker unique** pour l'app, le worker et les migrations : simple pour un MVP.

## Limites connues

- Un utilisateur appartient à un seul cabinet (MVP).
- Pas de paiement en ligne ni d'envoi SMS ; emails uniquement via SMTP local (Mailpit) ou bouchon.
- Pas d'annulation par le patient depuis l'email de rappel (le patient contacte le cabinet).
- PDF généré avec les polices standard PDF : les caractères non latins (arabe) sont remplacés par « ? » dans le PDF (l'interface et les emails, eux, sont en arabe).
- Agenda en liste par jour (pas de glisser-déposer).
- Pas de déploiement public : le score Lighthouse est mesuré en local sur le build de production.
