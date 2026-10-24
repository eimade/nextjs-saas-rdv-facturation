// Génère les captures d'écran de docs/ux/captures (application démarrée sur :13000, base de démo chargée).
// Usage : node scripts/captures.mjs
import { mkdirSync } from "node:fs";
import { chromium, devices } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:13000";
const OUT = "docs/ux/captures";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function bookingSteps(locale, scheme, prefix) {
  const ctx = await browser.newContext({ ...devices["Pixel 7"], colorScheme: scheme });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/${locale}/book/cabinet-demo`);
  await page.locator('input[name="service"]').first().check();
  await page.locator('input[name="practitioner"]').first().check();
  await page.screenshot({ path: `${OUT}/${prefix}-1.png`, fullPage: true });
  await page.locator("section button").last().click();
  await page.locator("ul button").first().waitFor();
  await page.locator("ul button").first().click();
  await page.waitForTimeout(400); // fin de la transition de couleur
  await page.screenshot({ path: `${OUT}/${prefix}-2.png`, fullPage: true });
  await ctx.close();
}

await bookingSteps("fr", "light", "reservation-mobile-fr");
await bookingSteps("ar", "light", "reservation-mobile-ar");

const desk = await browser.newContext({ viewport: { width: 1366, height: 860 } });
const page = await desk.newPage();
await page.goto(`${BASE}/fr/login`);
await page.locator("#email").fill("claire@demo.kalendo.test");
await page.locator("#password").fill("Demo1234!");
await page.locator("form button[type=submit]").click();
await page.waitForURL(/\/fr\/app/);
for (const [path, name] of [
  ["/fr/app", "tableau-de-bord"],
  ["/fr/app/agenda", "agenda-semaine"],
  ["/fr/app/invoices", "facturation"],
]) {
  await page.goto(`${BASE}${path}`);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}
const dark = await browser.newContext({ viewport: { width: 1366, height: 860 }, colorScheme: "dark" });
const p2 = await dark.newPage();
await p2.goto(`${BASE}/ar/login`);
await p2.locator("#email").fill("claire@demo.kalendo.test");
await p2.locator("#password").fill("Demo1234!");
await p2.locator("form button[type=submit]").click();
await p2.waitForURL(/\/ar\/app/);
await p2.screenshot({ path: `${OUT}/tableau-de-bord-ar-sombre.png`, fullPage: true });

await browser.close();
console.log(`Captures écrites dans ${OUT}`);
