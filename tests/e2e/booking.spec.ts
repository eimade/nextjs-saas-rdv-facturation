import { expect, test } from "@playwright/test";

test.describe("Réservation publique en 3 étapes", () => {
  test("un patient réserve un créneau au clavier et à la souris", async ({ page }, info) => {
    await page.goto("/fr/book/cabinet-demo");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cabinet Kiné Les Tilleuls");

    // Étape 1 : prestation + praticien
    await page.getByRole("radio", { name: /Bilan initial/ }).check();
    await page.getByRole("radio", { name: "Youssef Benali" }).check();
    await page.getByRole("button", { name: "Continuer" }).click();

    // Étape 2 : créneau (le focus est déplacé sur le titre de l'étape)
    const title = page.getByRole("heading", { name: "Choisissez un créneau" });
    await expect(title).toBeFocused();
    const times = page.getByRole("group", { name: /Horaires disponibles/ }).getByRole("button");
    // créneau différent selon le projet pour ne pas entrer en conflit entre les deux exécutions
    await times.nth(info.project.name === "mobile" ? 1 : 0).click();
    await page.getByRole("button", { name: "Continuer" }).click();

    // Étape 3 : coordonnées
    await page.getByLabel("Nom et prénom").fill("Patient E2E");
    await page.getByLabel("Adresse e-mail").fill(`e2e-${Date.now()}@example.com`);
    await page.getByRole("button", { name: "Confirmer le rendez-vous" }).click();

    await expect(page.getByRole("heading", { name: "Rendez-vous confirmé" })).toBeVisible();
    await expect(page.getByText(/Bilan initial avec Youssef Benali/)).toBeVisible();
  });

  test("validation : email invalide refusé côté navigateur", async ({ page }) => {
    await page.goto("/fr/book/cabinet-demo");
    await page.getByRole("radio", { name: /Séance de kinésithérapie/ }).check();
    await page.getByRole("radio", { name: "Claire Martin" }).check();
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByRole("group", { name: /Horaires disponibles/ }).getByRole("button").last().click();
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByLabel("Nom et prénom").fill("Patient");
    await page.getByLabel("Adresse e-mail").fill("pas-un-email");
    await page.getByRole("button", { name: "Confirmer le rendez-vous" }).click();
    await expect(page.getByRole("heading", { name: "Rendez-vous confirmé" })).toHaveCount(0);
    expect(await page.getByLabel("Adresse e-mail").evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
  });

  test("la page arabe est en RTL", async ({ page }) => {
    await page.goto("/ar/book/cabinet-demo");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  });
});
