import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

/** Audit axe-core : règles WCAG 2.0/2.1 niveaux A et AA. */
async function audit(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(summary, summary.join("\n")).toEqual([]);
}

const publicPages = ["/fr", "/ar", "/en", "/fr/login", "/fr/signup", "/fr/book/cabinet-demo", "/ar/book/cabinet-demo"];

for (const path of publicPages) {
  test(`axe WCAG AA : ${path}`, async ({ page }) => {
    await page.goto(path);
    await audit(page);
  });
}

for (const scheme of ["light", "dark"] as const) {
  test(`axe WCAG AA : étapes 2 et 3 de la réservation (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/fr/book/cabinet-demo");
    await page.getByRole("radio", { name: /Drainage/ }).check();
    await page.getByRole("radio", { name: "Claire Martin" }).check();
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page.getByRole("heading", { name: "Choisissez un créneau" })).toBeVisible();
    await audit(page);
    await page.getByRole("group", { name: /Horaires disponibles/ }).getByRole("button").first().click();
    await page.getByRole("button", { name: "Continuer" }).click();
    await audit(page);
  });
}

const appPages = ["/app", "/app/agenda", "/app/availability", "/app/invoices", "/app/services", "/app/team"];

test.describe("espace cabinet", () => {
  test.setTimeout(120_000); // 6 pages auditées par test
  for (const locale of ["fr", "ar"]) {
    test(`axe WCAG AA : pages connectées (${locale})`, async ({ page }) => {
      await login(page, "claire@demo.uimad-agenda.test", locale);
      for (const p of appPages) {
        await page.goto(`/${locale}${p}`);
        await audit(page);
      }
    });
  }

  test("axe WCAG AA : tableau de bord en mode sombre", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await login(page, "claire@demo.uimad-agenda.test");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await audit(page);
  });
});

test("navigation clavier : lien d'évitement puis menu", async ({ page }) => {
  await page.goto("/fr/book/cabinet-demo");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Aller au contenu" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});
