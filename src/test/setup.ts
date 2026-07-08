/**
 * Global vitest setup — runs before all test files.
 *
 * Sets required env vars and mocks next/headers so that modules
 * using cookies()/headers() can be imported outside Next.js runtime.
 */

// Set env vars BEFORE any import that might read them
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET || "test-session-secret-at-least-32-characters-long";
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || "test-gemini-key";
process.env.NEXT_PUBLIC_BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

// Mock next/headers globally — individual tests can override via setCookie()
import { vi } from "vitest";

// jest-dom matchers for component tests (safe to import in node env too)
import "@testing-library/jest-dom/vitest";

const cookieStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const value = cookieStore.get(name);
      return value ? { name, value } : undefined;
    },
    set: (name: string, value: string) => {
      cookieStore.set(name, value);
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
    getAll: () =>
      Array.from(cookieStore.entries()).map(([name, value]) => ({ name, value })),
  })),
  headers: vi.fn(async () => ({
    get: (_name: string) => null,
  })),
}));

// Expose cookie store for test harness to manipulate
(globalThis as unknown as { __testCookieStore: Map<string, string> }).__testCookieStore =
  cookieStore;
