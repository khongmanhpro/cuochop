/**
 * Integration test harness for API route handlers.
 *
 * Provides:
 * - Temp SQLite DB (real Prisma queries, cleaned up after test suite)
 * - Mocked next/headers cookies (so getSession() works outside Next.js runtime)
 * - Helper to create test users + session tokens
 * - Helper to build authenticated Request objects
 *
 * Usage in a test file:
 *
 *   import { describe, expect, test, beforeAll, afterAll, beforeEach } from "vitest";
 *   import { setupTestDb, teardownTestDb, createTestUser, createAuthCookie, buildAuthRequest } from "../test/api-test-harness";
 *
 *   beforeAll(setupTestDb);
 *   afterAll(teardownTestDb);
 *
 *   test("returns 401 without auth", async () => {
 *     const { POST } = await import("../app/api/notifications/route");
 *     const response = await POST(new Request("http://localhost/api/notifications"));
 *     expect(response.status).toBe(401);
 *   });
 *
 *   test("returns notifications with auth", async () => {
 *     const user = await createTestUser();
 *     const cookie = await createAuthCookie(user.id);
 *     const { POST } = await import("../app/api/notifications/route");
 *     const response = await POST(buildAuthRequest("/api/notifications", cookie));
 *     expect(response.status).toBe(200);
 *   });
 */

import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SignJWT } from "jose";
import { vi } from "vitest";

// --- Env setup (must run before any import that touches db.ts) ---

const TEST_SESSION_SECRET = "test-session-secret-at-least-32-characters-long";

let testDbPath: string;
let testDbDir: string;

export function setupTestEnv() {
  if (!process.env.SESSION_SECRET) {
    process.env.SESSION_SECRET = TEST_SESSION_SECRET;
  }
  if (!process.env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = "test-gemini-key";
  }
  if (!process.env.NEXT_PUBLIC_BASE_URL) {
    process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3000";
  }
}

export function setupTestDb() {
  setupTestEnv();

  testDbDir = mkdtempSync(path.join(tmpdir(), "cuochop-test-"));
  testDbPath = path.join(testDbDir, "test.db");
  process.env.DATABASE_URL = `file:${testDbPath}`;

  // Reset the cached prisma client so it picks up the new DATABASE_URL
  const globalForPrisma = globalThis as unknown as { prisma?: unknown };
  delete globalForPrisma.prisma;
}

export async function teardownTestDb() {
  const globalForPrisma = globalThis as unknown as {
    prisma?: { $disconnect?: () => Promise<void> };
  };
  if (globalForPrisma.prisma?.$disconnect) {
    await globalForPrisma.prisma.$disconnect();
  }
  delete (globalForPrisma as Record<string, unknown>).prisma;

  if (testDbDir && existsSync(testDbDir)) {
    rmSync(testDbDir, { recursive: true, force: true });
  }
}

// --- Mock next/headers cookies ---

type CookieMap = Map<string, string>;

// Use the global cookie store from setup.ts so all test files share the same mock
const cookieStore: CookieMap =
  (globalThis as unknown as { __testCookieStore?: Map<string, string> }).__testCookieStore ||
  new Map<string, string>();

export function setCookie(name: string, value: string) {
  cookieStore.set(name, value);
}

export function clearCookies() {
  cookieStore.clear();
}

// --- Session token creation ---

const SESSION_COOKIE = "cuochop_session";

export async function createSessionToken(
  userId: string,
  authMethod = "password",
): Promise<string> {
  const secret = new TextEncoder().encode(
    process.env.SESSION_SECRET || TEST_SESSION_SECRET,
  );
  const token = await new SignJWT({ sessionId: `test-session-${userId}` })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secret);
  return token;
}

export async function setAuthCookie(userId: string): Promise<string> {
  const token = await createSessionToken(userId);
  setCookie(SESSION_COOKIE, token);
  return token;
}

// --- Test user creation ---

export async function createTestUser(
  overrides: {
    email?: string;
    name?: string;
    plan?: string;
    passwordHash?: string;
  } = {},
) {
  const { prisma } = await import("../lib/db");
  const bcrypt = await import("bcryptjs");

  const email = overrides.email || `test-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
  const passwordHash = overrides.passwordHash || (await bcrypt.hash("testpass123", 10));

  // Ensure a session row exists so getSession() can find it
  const user = await prisma.user.create({
    data: {
      email,
      name: overrides.name || "Test User",
      passwordHash,
      plan: overrides.plan || "free",
      sessions: {
        create: {
          id: `test-session-${email}`,
          authMethod: "password",
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
    },
    include: { sessions: true },
  });

  // Update the session id to match what createSessionToken generates
  await prisma.session.update({
    where: { id: `test-session-${email}` },
    data: { id: `test-session-${user.id}` },
  });

  return user;
}

// --- Request builder ---

export function buildAuthRequest(
  url: string,
  cookie: string,
  init?: RequestInit,
): Request {
  const request = new Request(url, init);
  // Clone headers and add cookie
  const headers = new Headers(request.headers);
  headers.set("cookie", `${SESSION_COOKIE}=${cookie}`);
  return new Request(url, {
    ...init,
    headers,
  });
}

// --- DB helpers ---

export async function getPrisma() {
  const { prisma } = await import("../lib/db");
  return prisma;
}

export async function seedMeetingNote(
  userId: string,
  overrides: {
    title?: string;
    organizationId?: string | null;
  } = {},
) {
  const prisma = await getPrisma();
  return prisma.meetingNote.create({
    data: {
      userId,
      organizationId: overrides.organizationId ?? null,
      title: overrides.title || "Test Meeting",
      audioName: "test.mp3",
      notesJson: JSON.stringify({
        title: "Test Meeting",
        executiveSummary: ["Test summary"],
      }),
      markdown: "# Test Meeting\n\nTest content",
    },
  });
}

export async function seedActionItem(
  meetingNoteId: string,
  userId: string,
  overrides: {
    task?: string;
    status?: string;
    deadline?: string;
    priority?: string;
    ownerId?: string | null;
    organizationId?: string | null;
  } = {},
) {
  const prisma = await getPrisma();
  return prisma.actionItem.create({
    data: {
      meetingNoteId,
      userId,
      organizationId: overrides.organizationId ?? null,
      ownerId: overrides.ownerId ?? null,
      task: overrides.task || "Test action item",
      deadline: overrides.deadline || "Chưa xác định",
      priority: overrides.priority || "Medium",
      status: overrides.status || "todo",
      notes: "",
    },
  });
}
