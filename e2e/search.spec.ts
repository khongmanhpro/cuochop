import { expect, test } from "@playwright/test";
import { signupNewUser } from "./helpers";

/**
 * E2E for global search: open search, type query, verify results UI.
 * Does NOT test full AI pipeline (requires Gemini API + data).
 */
test.describe("global search", () => {
  test("search button is visible in app nav", async ({ page }) => {
    const creds = await signupNewUser(page);

    if (page.url().includes("/auth/login")) {
      await page.locator('input[name="email"]').fill(creds.email);
      await page.locator('input[name="password"]').fill(creds.password);
      await page.getByRole("button", { name: /đăng nhập|sign in/i }).first().click();
      await page.waitForURL(/\/app/, { timeout: 15_000 });
    }

    // The search button should be in the header
    const searchButton = page.getByRole("button", { name: /tìm|search/i }).first();
    await expect(searchButton).toBeVisible();
  });

  test("clicking search opens input with placeholder", async ({ page }) => {
    const creds = await signupNewUser(page);

    if (page.url().includes("/auth/login")) {
      await page.locator('input[name="email"]').fill(creds.email);
      await page.locator('input[name="password"]').fill(creds.password);
      await page.getByRole("button", { name: /đăng nhập|sign in/i }).first().click();
      await page.waitForURL(/\/app/, { timeout: 15_000 });
    }

    // Click the search button to open the search panel
    const searchButton = page.getByRole("button", { name: /tìm|search/i }).first();
    await searchButton.click();

    // The search input should appear with the Vietnamese placeholder
    await expect(
      page.locator('input[placeholder*="Tìm ghi chú"]'),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("typing query does not crash the page", async ({ page }) => {
    const creds = await signupNewUser(page);

    if (page.url().includes("/auth/login")) {
      await page.locator('input[name="email"]').fill(creds.email);
      await page.locator('input[name="password"]').fill(creds.password);
      await page.getByRole("button", { name: /đăng nhập|sign in/i }).first().click();
      await page.waitForURL(/\/app/, { timeout: 15_000 });
    }

    const searchButton = page.getByRole("button", { name: /tìm|search/i }).first();
    await searchButton.click();

    const searchInput = page.locator('input[placeholder*="Tìm ghi chú"]');
    await searchInput.fill("test query");
    await page.waitForTimeout(500);

    // Page should still be alive
    await expect(page.locator("main").first()).toBeVisible();
  });
});
