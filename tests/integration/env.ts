/** Base PostgreSQL dédiée aux tests d'intégration (créée par docker compose / CI). */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://kalendo:kalendo@localhost:15432/kalendo_test?schema=public";
