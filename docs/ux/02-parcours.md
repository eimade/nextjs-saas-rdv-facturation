# Parcours utilisateurs

Chaque parcours décrit les étapes, l'écran correspondant (wireframe) et la règle métier ou d'accessibilité qui s'applique. Les parcours 1 à 3 sont couverts par des tests Playwright (`tests/e2e/`).

## Parcours 1 — Amine réserve un rendez-vous (public, mobile)

Wireframe : [`wireframes/01-reservation-mobile.svg`](wireframes/01-reservation-mobile.svg)

| Étape | Action | Réponse du système | Point d'attention |
|---|---|---|---|
| 0 | Ouvre le lien du cabinet `/{langue}/book/{cabinet}` | Nom, adresse du cabinet, stepper « 1 Prestation · 2 Créneau · 3 Coordonnées » | `lang`/`dir` posés sur `<html>` (RTL en arabe) |
| 1 | Choisit une prestation (prix, durée affichés) et un praticien | Bouton « Continuer » activé quand les deux sont choisis | Boutons radio natifs dans des `fieldset/legend` : utilisables au clavier et lisibles par lecteur d'écran |
| 2 | Choisit un jour puis une heure | Seuls les créneaux réellement libres sur 14 jours sont proposés ; jours complets désactivés | Le focus est déplacé sur le titre de l'étape ; fuseau du cabinet rappelé |
| 3 | Saisit nom, email, téléphone facultatif | Récapitulatif (prestation, praticien, date) au-dessus du formulaire | Champs avec `label`, `autocomplete`, validation navigateur + Zod côté serveur |
| 4 | Confirme | Écran « Rendez-vous confirmé » | Si le créneau vient d'être pris : message `role="alert"` et liste de créneaux rafraîchie (contrainte d'exclusion PostgreSQL) |
| J-1 | — | Le worker envoie un rappel email dans la langue de la réservation | Envoi idempotent (un seul rappel par rendez-vous) |

## Parcours 2 — Claire termine sa journée et facture

Wireframes : [`wireframes/02-agenda-desktop.svg`](wireframes/02-agenda-desktop.svg), [`wireframes/03-facturation-kpi.svg`](wireframes/03-facturation-kpi.svg)

1. Connexion → tableau de bord : taux de remplissage, taux de no-show, CA facturé / encaissé du mois, rendez-vous du jour.
2. Agenda (vue jour ou semaine, filtre par praticien) → pour chaque séance passée : « Honoré » ou « Absent ».
3. Sur une séance honorée : « Facturer » → facture `F-AAAA-NNNN` créée (séquence continue par cabinet et par année).
4. Facturation → PDF de la facture, « Marquer payée », filtre Impayées, export CSV pour le comptable.
5. Un rendez-vous facturé ne peut plus changer de statut (intégrité comptable).

## Parcours 3 — Claire crée son cabinet et invite son équipe

1. `/signup` : nom du cabinet, adresse de la page publique (slug), nom, email, mot de passe → création atomique du tenant, du compte et de la membership « propriétaire ».
2. Prestations : ajout (nom, durée, prix), activation/désactivation.
3. Disponibilités : plages hebdomadaires par praticien + absences (congés).
4. Équipe : invitation par email d'un praticien ou d'une secrétaire (lien à usage unique, 7 jours) ; le lien est aussi affiché à l'écran si l'email n'arrive pas.
5. Le membre invité choisit son nom et son mot de passe ; il n'accède qu'aux écrans de son rôle (un praticien ne voit que son agenda et n'a pas la facturation).

## Matrice rôles × écrans

| Écran | Propriétaire | Secrétaire | Praticien |
|---|---|---|---|
| Tableau de bord | cabinet | cabinet | ses RDV |
| Agenda | tous | tous | le sien |
| Disponibilités | tous | tous | les siennes |
| Facturation | oui | oui | non |
| Prestations | gestion | lecture | lecture |
| Équipe | invitations | lecture | lecture |
