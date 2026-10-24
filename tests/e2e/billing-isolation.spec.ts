import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.describe("Facturation", () => {
  test("la secrétaire génère une facture, la marque payée, télécharge PDF et CSV", async ({ page }) => {
    await login(page, "sophie@demo.kalendo.test");
    await page.getByRole("link", { name: "Facturation" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Facturation" })).toBeVisible();

    const create = page.getByRole("button", { name: /^Créer la facture :/ }).first();
    await expect(create).toBeVisible();
    await create.click();

    // La nouvelle facture (numéro le plus élevé) apparaît en tête de liste, impayée
    const firstRow = page.locator("table tbody tr").first();
    await expect(firstRow).toContainText(/F-\d{4}-\d{4}/);
    const number = (await firstRow.locator("td, th").first().innerText()).trim();

    await page.getByRole("button", { name: `Marquer payée : ${number}` }).click();
    await expect(page.getByRole("button", { name: `Marquer impayée : ${number}` })).toBeVisible();

    const pdf = await page.request.get(await page.getByRole("link", { name: `PDF : facture ${number}` }).getAttribute("href") as string);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");

    const csv = await page.request.get("/api/invoices/export");
    expect(csv.status()).toBe(200);
    expect(await csv.text()).toContain(number);
  });

  test("un praticien n'a pas accès à la facturation", async ({ page }) => {
    await login(page, "youssef@demo.kalendo.test");
    await expect(page.getByRole("link", { name: "Facturation" })).toHaveCount(0);
    const res = await page.request.get("/api/invoices/export");
    expect(res.status()).toBe(403);
  });
});

test.describe("Isolation entre deux cabinets", () => {
  test("le cabinet B ne voit ni ne télécharge les factures du cabinet A", async ({ browser }) => {
    const a = await browser.newPage();
    await login(a, "claire@demo.kalendo.test");
    await a.goto("/fr/app/invoices");
    const href = await a.locator('a[href^="/api/invoices/"][href$="/pdf"]').first().getAttribute("href");
    expect(href).toBeTruthy();
    const csvA = await (await a.request.get("/api/invoices/export")).text();

    const b = await browser.newPage();
    await login(b, "nadia@lumiere.kalendo.test");
    const stolen = await b.request.get(href!);
    expect(stolen.status()).toBe(404);
    const csvB = await (await b.request.get("/api/invoices/export")).text();
    expect(csvB).not.toContain("@example.com;Séance");
    expect(csvA).not.toContain("salma.idrissi");
    await b.goto("/fr/app/agenda");
    await expect(b.getByText("Cabinet Kiné Les Tilleuls")).toHaveCount(0);
  });

  test("les pages de l'espace cabinet exigent une connexion", async ({ page }) => {
    await page.goto("/fr/app/invoices");
    await expect(page).toHaveURL(/\/fr\/login/);
    expect((await page.request.get("/api/invoices/export")).status()).toBe(401);
  });
});
