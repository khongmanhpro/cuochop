import { expect, test } from "@playwright/test";
import { signupNewUser } from "./helpers";

/**
 * E2E for /actions page: navigation, empty state, filter controls.
 * Does NOT test full AI pipeline (requires Gemini API).
 */
test.describe("/actions — action board", () => {
  test("navigate to /actions and see empty state or board", async ({ page }) => {
    const creds = await signupNewUser(page);

    if (page.url().includes("/auth/login")) {
      await page.locator('input[name="email"]').fill(creds.email);
      await page.locator('input[name="password"]').fill(creds.password);
      await page.getByRole("button", { name: /đăng nhập|sign in/i }).first().click();
      await page.waitForURL(/\/app/, { timeout: 15_000 });
    }

    // Navigate to /actions via the nav tabs
    await page.goto("/actions");
    await expect(page).toHaveURL(/\/actions/);

    // Page should render with the Action Board heading
    await expect(page.getByText("Action Board")).toBeVisible();

    // Should have filter controls or empty state — page must not crash
    await expect(page.locator("main").first()).toBeVisible();
  });

  test("action board has New Meeting CTA", async ({ page }) => {
    const creds = await signupNewUser(page);

    if (page.url().includes("/auth/login")) {
      await page.locator('input[name="email"]').fill(creds.email);
      await page.locator('input[name="password"]').fill(creds.password);
      await page.getByRole("button", { name: /đăng nhập|sign in/i }).first().click();
      await page.waitForURL(/\/app/, { timeout: 15_000 });
    }

    await page.goto("/actions");
    // The "New Meeting" CTA should be visible
    await expect(page.getByRole("link", { name: /new meeting/i }).first()).toBeVisible();
  });
});
