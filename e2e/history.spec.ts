import { expect, test } from "@playwright/test";
import { signupNewUser } from "./helpers";

/**
 * E2E for /history page: navigation, empty state, detail 404.
 * Does NOT test full AI pipeline (requires Gemini API).
 */
test.describe("/history — meeting history", () => {
  test("navigate to /history and see empty state", async ({ page }) => {
    const creds = await signupNewUser(page);

    if (page.url().includes("/auth/login")) {
      await page.locator('input[name="email"]').fill(creds.email);
      await page.locator('input[name="password"]').fill(creds.password);
      await page.getByRole("button", { name: /đăng nhập|sign in/i }).first().click();
      await page.waitForURL(/\/app/, { timeout: 15_000 });
    }

    await page.goto("/history");
    await expect(page).toHaveURL(/\/history/);

    // New user should see the empty state
    await expect(page.getByText("Chưa có cuộc họp nào")).toBeVisible();

    // Empty state should have a CTA to create meeting
    await expect(
      page.getByRole("link", { name: /tạo meeting đầu tiên/i }),
    ).toBeVisible();
  });

  test("history page shows count of meetings", async ({ page }) => {
    const creds = await signupNewUser(page);

    if (page.url().includes("/auth/login")) {
      await page.locator('input[name="email"]').fill(creds.email);
      await page.locator('input[name="password"]').fill(creds.password);
      await page.getByRole("button", { name: /đăng nhập|sign in/i }).first().click();
      await page.waitForURL(/\/app/, { timeout: 15_000 });
    }

    await page.goto("/history");
    // Should show "0 cuộc họp đã lưu" for new user
    await expect(page.getByText(/0 cuộc họp đã lưu/)).toBeVisible();
  });

  test("unknown meeting detail returns not found for signed-in user", async ({
    page,
  }) => {
    const creds = await signupNewUser(page);

    if (page.url().includes("/auth/login")) {
      await page.locator('input[name="email"]').fill(creds.email);
      await page.locator('input[name="password"]').fill(creds.password);
      await page.getByRole("button", { name: /đăng nhập|sign in/i }).first().click();
      await page.waitForURL(/\/app/, { timeout: 15_000 });
    }

    await page.goto("/history/does-not-exist-meeting");
    await expect(
      page.getByText(/not found|không tìm thấy|404/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
