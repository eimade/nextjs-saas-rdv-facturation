# Dossier UX — Uimad Agenda

Démarche suivie : **besoin → personas → parcours → wireframes → intégration → tests (outillés et manuels) → itérations**.

| Document | Contenu |
|---|---|
| [01-personas.md](01-personas.md) | 2 personas : Claire (titulaire du cabinet) et Amine (patient sur mobile, arabophone) |
| [02-parcours.md](02-parcours.md) | 3 parcours (réservation, facturation, création du cabinet), matrice rôles × écrans |
| [03-tests-utilisabilite.md](03-tests-utilisabilite.md) | Protocole, compte rendu des 3 sessions de test et itérations appliquées |
| [wireframes/](wireframes/) | Wireframes basse fidélité en SVG (réservation mobile + RTL, agenda, facturation/KPI) |
| [captures/](captures/) | Captures de l'interface intégrée (générées par `node scripts/captures.mjs`) |

## Pourquoi des wireframes SVG plutôt que Figma

Figma demande un compte externe ; le projet s'impose de n'en exiger aucun. Les wireframes sont donc dessinés en **SVG versionné dans le dépôt** : ils se relisent dans GitHub, se comparent dans une pull request (diff texte) et restent alignés sur le code. Ils jouent le même rôle qu'une maquette basse fidélité Figma : valider la structure des écrans, la hiérarchie de l'information et les états (sélectionné, désactivé, erreur) **avant** l'intégration.

## De la maquette à l'intégration

| Wireframe | Écran intégré | Composant |
|---|---|---|
| `01-reservation-mobile.svg` | `captures/reservation-mobile-fr-*.png`, `captures/reservation-mobile-ar-*.png` | `src/components/booking-wizard.tsx` |
| `02-agenda-desktop.svg` | `captures/agenda-semaine.png` | `src/app/[locale]/app/agenda/page.tsx` |
| `03-facturation-kpi.svg` | `captures/tableau-de-bord.png`, `captures/facturation.png`, `captures/tableau-de-bord-ar-sombre.png` | `src/app/[locale]/app/page.tsx`, `src/app/[locale]/app/invoices/page.tsx` |

Les tokens de design (couleurs, rayons, police) sont centralisés dans `src/app/globals.css` (variables CSS shadcn/ui, thème clair et sombre, contrastes ≥ 4,5:1).
