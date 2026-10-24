import { execSync } from "node:child_process";
import { TEST_DATABASE_URL } from "./env";

/** Applique toutes les migrations (schéma, RLS, contrainte d'exclusion) sur la base de test. */
export default function setup() {
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
