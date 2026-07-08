import { expect, test } from "@playwright/test";
import path from "node:path";
import { signupNewUser } from "./helpers";

/**
 * E2E smoke test: signup → /app → upload sample.mp3 → wait for stage.
 *
 * This is a happy-path smoke test. It does NOT verify full AI generation
 * (which requires Gemini API). It verifies:
 * - Signup flow works
 * - /app renders with the upload dropzone
 * - File upload starts
 * - Page does not crash
 */
test.describe("meeting flow — smoke", () => {
  test("signup → /app → upload sample.mp3", async ({ page }) => {
    // 1. Signup (or land on login if email verification required)
    const creds = await signupNewUser(page);

    // 2. If redirected to login, login with the new creds
    if (page.url().includes("/auth/login")) {
      await page.locator('input[name="email"]').fill(creds.email);
      await page.locator('input[name="password"]').fill(creds.password);
      await page
        .getByRole("button", { name: /đăng nhập|sign in/i })
        .first()
        .click();
      await page.waitForURL(/\/app/, { timeout: 15_000 });
    }

    // 3. Verify /app rendered with upload UI
    await expect(page).toHaveURL(/\/app/);
    await expect(page.locator("main").first()).toBeVisible();

    // 4. Look for the upload dropzone (file input)
    const fileInput = page.locator('input[type="file"]').first();
    await expect(fileInput).toBeAttached();

    // 5. Upload sample.mp3
    await fileInput.setInputFiles(
      path.join(__dirname, "fixtures", "sample.mp3"),
    );

    // 6. Verify page does not crash — wait briefly for upload UI
    await page.waitForTimeout(1000);
    await expect(page.locator("main").first()).toBeVisible();
  });

  test("health endpoint returns 200", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeTruthy();
  });
});
