/**
 * Worker Node.js de rappels : process séparé de l'application Next.js,
 * partageant la couche service et le client Prisma.
 *
 *   npm run worker        -> planifié (REMINDER_CRON, défaut toutes les 5 minutes)
 *   npm run worker:once   -> un seul passage (utile en CI ou via un cron système)
 */
import cron from "node-cron";
import { systemDb } from "../src/server/db";
import { sendMail } from "../src/server/notifications/mailer";
import { sendDueReminders } from "../src/server/notifications/reminders";

const schedule = process.env.REMINDER_CRON ?? "*/5 * * * *";
const hoursAhead = Number(process.env.REMINDER_HOURS_AHEAD ?? 24);

async function runOnce(): Promise<void> {
  const started = Date.now();
  try {
    const { sent, failed } = await sendDueReminders(sendMail, new Date(), hoursAhead);
    console.info(`[worker] rappels envoyés=${sent} échecs=${failed} (${Date.now() - started} ms)`);
  } catch (error) {
    console.error("[worker] passage en échec", error);
  }
}

async function main() {
  if (!cron.validate(schedule)) throw new Error(`REMINDER_CRON invalide : ${schedule}`);
  if (process.argv.includes("--once")) {
    await runOnce();
    await systemDb.$disconnect();
    return;
  }
  console.info(`[worker] démarré, planification "${schedule}", fenêtre ${hoursAhead} h`);
  await runOnce();
  let running = false;
  const task = cron.schedule(schedule, async () => {
    if (running) return; // pas de chevauchement entre deux passages
    running = true;
    await runOnce();
    running = false;
  });
  const stop = async () => {
    await task.stop();
    await systemDb.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
