import { afterAll } from "vitest";
import { TEST_DATABASE_URL } from "./env";

// Positionné avant tout import du client Prisma par les fichiers de test.
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.MAIL_TRANSPORT = "console";

afterAll(async () => {
  const { systemDb } = await import("@/server/db");
  await systemDb.$disconnect();
});
