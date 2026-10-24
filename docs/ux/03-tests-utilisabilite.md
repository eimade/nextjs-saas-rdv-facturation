# Tests d'utilisabilité : protocole, compte rendu et itérations

## Cadre et honnêteté méthodologique

Le projet est un MVP de démonstration, réalisé sans panel d'utilisateurs recrutés. Les trois sessions ci-dessous sont donc des **tests de parcours menés par l'auteur** dans la peau des personas, selon un protocole fixe, et **outillés** (Playwright, axe-core, Lighthouse, captures mobile). Elles n'ont pas valeur de tests avec de vrais utilisateurs. Elles ont tout de même fait remonter des défauts réels, corrigés dans le code (section « Itérations »). Avant une mise en production, il faudrait les rejouer avec 5 vrais utilisateurs par persona.

## Protocole commun

- **Scénarios** : ceux de [02-parcours.md](02-parcours.md).
- **Mesures** : réussite de la tâche, nombre d'étapes, blocages, violations axe-core (WCAG 2.1 A/AA), score Lighthouse accessibilité.
- **Conditions** : build de production (`npm run build && npm start`), base de démo, Chromium.

| # | Persona | Conditions | Tâche |
|---|---|---|---|
| S1 | Amine (patient) | Mobile émulé Pixel 7 (412 px), **arabe (RTL)** puis français | Réserver une séance avec un praticien précis |
| S2 | Le père d'Amine (malvoyant) | Desktop, **clavier seul**, arbre d'accessibilité (noms accessibles annoncés par un lecteur d'écran) | Réserver puis naviguer dans le site |
| S3 | Claire (titulaire) | Desktop 1366 px, fr puis ar, **clair puis sombre** | Passer une séance en « honoré », la facturer, la marquer payée, exporter le CSV |

## Compte rendu

### S1 — Réservation mobile en arabe

- Réussite : **oui**, en 3 étapes + confirmation, sans compte.
- Constats :
  1. **Libellés des jours qui débordent** : en arabe, « الاثنين، 26 أكتوبر » ne tient pas dans le bouton (largeur fixe, `white-space: nowrap`) ; les textes de deux jours voisins se chevauchent. En français, « mer. 28 oct. » est aussi tronqué en bord d'écran.
  2. **Adresse latine mal ordonnée en RTL** : « 12 rue des Tilleuls, 69003 Lyon » s'affichait « rue des Tilleuls, 69003 Lyon 12 » (le numéro, neutre pour l'algorithme bidirectionnel, part en fin de ligne).
  3. Positif : stepper, boutons et grille d'horaires correctement inversés sans CSS spécifique (propriétés logiques), téléphone saisi en LTR.

### S2 — Clavier seul et lecteur d'écran

- Réussite : **oui**. Le premier `Tab` atteint le lien « Aller au contenu » ; les radios se parcourent aux flèches ; à chaque étape le focus est placé sur le titre de l'étape (annonce du changement de contexte).
- Constat :
  4. **Nom accessible différent du texte visible** (critère WCAG 2.5.3 *Label in Name*, signalé par axe-core) : le sélecteur de langue affichait « FR » mais annonçait « Français » ; les boutons « Honoré », « Absent », « Marquer payée », « PDF »… annonçaient « Marquer honoré : … », « Télécharger la facture … en PDF ». Un utilisateur de commande vocale qui dit « cliquer Honoré » ne peut pas activer le bouton.

### S3 — Facturation (clair / sombre, fr / ar)

- Réussite : **oui** ; séance honorée → « Facturer » → facture `F-AAAA-NNNN` → « Marquer payée » → PDF → CSV.
- Constat :
  5. **Contraste insuffisant des rendez-vous annulés** dans l'agenda : rendus avec `opacity: 0.7`, le badge « Annulé » et le texte secondaire passaient sous 4,5:1 (axe-core `color-contrast`, en clair comme en sombre).
  6. Remarque (non corrigée, voir limites) : en vue semaine sur 1366 px, les 7 colonnes sont étroites quand la journée est chargée ; la vue « Jour » reste plus confortable.

## Itérations appliquées

| # | Problème | Correctif | Fichier | Vérification |
|---|---|---|---|---|
| 1 | Jours qui débordent (ar, fr) | Jour de la semaine et date sur deux lignes, largeur minimale plus grande, retour à la ligne autorisé | `src/components/booking-wizard.tsx` | capture `reservation-mobile-ar-2.png` |
| 2 | Adresse mal ordonnée en RTL | Adresse isolée dans `<bdi>` | `src/app/[locale]/book/[slug]/page.tsx` | capture `reservation-mobile-ar-1.png` |
| 4 | Nom accessible ≠ texte visible | Sélecteur de langue : texte visible + nom complet en `sr-only` ; noms accessibles réécrits « texte visible : contexte » (ex. « Honoré : 14:00 Amine Haddad », « Marquer payée : F-2026-0012 ») dans les 3 langues | `src/components/locale-switcher.tsx`, `messages/*.json` | axe-core : 0 violation |
| 5 | Contraste des RDV annulés | Suppression de l'opacité, fond `bg-muted` + badge textuel « Annulé » | `src/app/[locale]/app/agenda/page.tsx` | axe-core : 0 violation (clair et sombre) |

Ces audits sont automatisés (`tests/e2e/a11y.spec.ts`) et s'exécutent en CI : une régression d'accessibilité fait échouer la pull request.
