import { expect, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";

/**
 * E2E helpers for cuochop.
 * Uses signup flow to create a fresh user per test run.
 */

export async function signupNewUser(
  page: Page,
  opts: { name?: string; email?: string; password?: string } = {},
): Promise<{ email: string; password: string }> {
  const suffix = randomBytes(6).toString("hex");
  const email = opts.email ?? `e2e-${Date.now()}-${suffix}@test.cuochop`;
  const password = opts.password ?? "Test1234!";

  await page.goto("/auth/signup");

  const nameInput = page.locator('input[name="name"]');
  if (await nameInput.isVisible()) {
    await nameInput.fill(opts.name ?? "E2E Tester");
  }

  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);

  // Submit the signup form. The form uses a server action, so wait for navigation.
  await page
    .getByRole("button", { name: /tạo|sign up|đăng ký|dùng ngay/i })
    .first()
    .click();

  // Wait for redirect to /app or login page (email verification may be required)
  await page.waitForURL(/\/(app|auth\/login)/, { timeout: 15_000 });

  return { email, password };
}

export async function login(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/auth/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /đăng nhập|sign in|login/i }).first().click();
  await page.waitForURL(/\/app/, { timeout: 15_000 });
}

export async function expectOnApp(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/app/);
}
