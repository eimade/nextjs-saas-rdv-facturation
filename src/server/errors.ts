/**
 * Erreurs métier : `code` est une clé de traduction (messages/*.json > errors.*),
 * affichée telle quelle à l'utilisateur ; les autres erreurs restent génériques.
 */
export class DomainError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "DomainError";
  }
}

export class NotFoundError extends DomainError {
  constructor() {
    super("notFound");
    this.name = "NotFoundError";
  }
}
