import { DomainError } from "@/server/errors";

export type Role ="OWNER" | "PRACTITIONER" | "SECRETARY";

export type Action =
  | "team:manage"
  | "services:manage"
  | "agenda:viewAll"
  | "availability:manageAll"
  | "appointments:update"
  | "billing:manage"
  | "kpi:view";

const MATRIX: Record<Role, readonly Action[]> = {
  OWNER: [
    "team:manage",
    "services:manage",
    "agenda:viewAll",
    "availability:manageAll",
    "appointments:update",
    "billing:manage",
    "kpi:view",
  ],
  SECRETARY: ["agenda:viewAll", "availability:manageAll", "appointments:update", "billing:manage", "kpi:view"],
  // Le praticien ne voit et ne gère que son propre agenda et ses disponibilités.
  PRACTITIONER: ["appointments:update", "kpi:view"],
};

export function can(role: Role, action: Action): boolean {
  return MATRIX[role].includes(action);
}

/** Un membre peut-il agir sur l'agenda / les disponibilités d'un praticien donné ? */
export function canActOnPractitioner(
  actor: { role: Role; membershipId: string },
  practitionerMembershipId: string,
): boolean {
  return actor.role !== "PRACTITIONER" || actor.membershipId === practitionerMembershipId;
}

export class ForbiddenError extends DomainError {
  constructor() {
    super("forbidden");
    this.name = "ForbiddenError";
  }
}

export function assertCan(role: Role, action: Action): void {
  if (!can(role, action)) throw new ForbiddenError();
}
