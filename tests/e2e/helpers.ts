import { expect, type Page } from "@playwright/test";

export const DEMO_PASSWORD = "Demo1234!";

export async function login(page: Page, email: string, locale = "fr") {
  await page.goto(`/${locale}/login`);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(DEMO_PASSWORD);
  await page.locator("form button[type=submit]").click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/app`));
}
