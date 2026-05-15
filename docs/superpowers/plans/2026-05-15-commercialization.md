# Commercialization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add freemium monetization to cuochop: email/password auth, feature gates (free vs Pro), meeting history, landing/pricing page, and LemonSqueezy billing — all running on VPS/Docker with SQLite.

**Architecture:** Custom auth using Server Actions + jose-signed cookie sessions stored in SQLite (cleaner than NextAuth adapter, same result). Feature gates checked server-side on every API request. LemonSqueezy handles billing with a webhook updating `user.plan` in the DB. Route groups split marketing pages (no auth) from app pages (auth required).

**Tech Stack:** Prisma + SQLite, jose (JWTs for session cookies), bcryptjs, zod, @lemonsqueezy/lemonsqueezy.js, Tailwind CSS (existing)

**Spec:** `docs/superpowers/specs/2026-05-15-commercialization-design.md`

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | DB schema: User, Session, MeetingNote |
| `src/lib/db.ts` | Prisma client singleton |
| `src/lib/session.ts` | Create/read/delete cookie sessions via jose |
| `src/lib/plans.ts` | Feature gate logic: canGenerate, canExportDocx, canViewHistory |
| `src/lib/plans.test.ts` | Unit tests for feature gates |
| `src/app/actions/auth.ts` | signup/login/logout Server Actions |
| `src/app/(marketing)/page.tsx` | Landing page (replaces src/app/page.tsx) |
| `src/app/(marketing)/pricing/page.tsx` | Pricing page |
| `src/app/(app)/layout.tsx` | Auth guard + app shell (nav + usage banner) |
| `src/app/(app)/app/page.tsx` | Meeting generator (moved from src/app/page.tsx) |
| `src/app/(app)/history/page.tsx` | Meeting history (Pro only) |
| `src/app/auth/login/page.tsx` | Login form page |
| `src/app/auth/signup/page.tsx` | Signup form page |
| `src/app/api/billing/checkout/route.ts` | Create LemonSqueezy checkout URL |
| `src/app/api/webhooks/lemonsqueezy/route.ts` | Handle LemonSqueezy events |

### Modified files
| File | Change |
|---|---|
| `src/app/page.tsx` | Delete (replaced by marketing/page.tsx) |
| `src/app/meeting-notes-generator.tsx` | No change to file location — only add upsell modal state (Task 15) |
| `src/app/api/generate-notes/route.ts` | Add auth check + usage gate + save to history |
| `src/app/api/export-notes/route.ts` | Add auth check + DOCX gate |
| `src/lib/api-errors.ts` | Add new error codes |
| `docker-compose.yml` | Add data volume + new env vars |
| `Dockerfile` | Run prisma migrate deploy on start |
| `.env.example` | Add new env vars |
| `package.json` | Add new dependencies |

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime dependencies**

```bash
pnpm add prisma @prisma/client jose bcryptjs zod @lemonsqueezy/lemonsqueezy.js
```

Expected: packages installed with no errors.

- [ ] **Step 2: Install dev dependencies**

```bash
pnpm add -D @types/bcryptjs
```

- [ ] **Step 3: Initialize Prisma**

```bash
npx prisma init --datasource-provider sqlite
```

Expected output includes: `Created prisma/schema.prisma` and `Created .env`.

Move `DATABASE_URL` from the generated `.env` to `.env.local` (it's already gitignored):
```bash
echo 'DATABASE_URL="file:./data/cuochop.db"' >> .env.local
rm .env
```

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml prisma/schema.prisma .env.example
git commit -m "chore: add prisma, jose, bcryptjs, zod, lemonsqueezy deps"
```

---

## Task 2: Database schema and migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Write the schema**

Replace the contents of `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id               String        @id @default(cuid())
  email            String        @unique
  name             String?
  passwordHash     String
  plan             String        @default("free")
  planExpiresAt    DateTime?
  usageThisMonth   Int           @default(0)
  usageResetAt     DateTime      @default(now())
  lsCustomerId     String?
  lsSubscriptionId String?
  createdAt        DateTime      @default(now())
  sessions         Session[]
  meetingNotes     MeetingNote[]
}

model Session {
  id        String   @id
  userId    String
  expiresAt DateTime
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model MeetingNote {
  id        String   @id @default(cuid())
  userId    String
  title     String
  audioName String
  notesJson String
  markdown  String
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Create the data directory and run migration**

```bash
mkdir -p data
npx prisma migrate dev --name init
```

Expected: `migrations/YYYYMMDDHHMMSS_init/migration.sql` created, `data/cuochop.db` created.

- [ ] **Step 3: Verify migration**

```bash
npx prisma studio
```

Expected: Opens browser with User, Session, MeetingNote tables visible. Close it (Ctrl+C).

- [ ] **Step 4: Add data/ to .gitignore**

Add to `.gitignore`:
```
data/
```

- [ ] **Step 5: Commit**

```bash
git add prisma/ .gitignore
git commit -m "feat: add database schema for users, sessions, and meeting notes"
```

---

## Task 3: Prisma client singleton and session library

**Files:**
- Create: `src/lib/db.ts`
- Create: `src/lib/session.ts`

- [ ] **Step 1: Create Prisma client singleton**

Create `src/lib/db.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ["warn", "error"] });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 2: Create session library**

Create `src/lib/session.ts`:

```ts
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./db";

const SESSION_COOKIE = "cuochop_session";
const SESSION_DURATION_DAYS = 30;

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  planExpiresAt: Date | null;
  usageThisMonth: number;
  usageResetAt: Date;
};

export async function createSession(userId: string): Promise<void> {
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000,
  );

  const session = await prisma.session.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      expiresAt,
    },
  });

  const token = await new SignJWT({ sessionId: session.id })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${SESSION_DURATION_DAYS}d`)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const sessionId = payload.sessionId as string;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    const user = session.user;

    // Lazy usage reset: if usageResetAt is in a previous calendar month, reset counter
    const now = new Date();
    const resetAt = new Date(user.usageResetAt);
    const needsReset =
      resetAt.getFullYear() < now.getFullYear() ||
      (resetAt.getFullYear() === now.getFullYear() &&
        resetAt.getMonth() < now.getMonth());

    if (needsReset) {
      await prisma.user.update({
        where: { id: user.id },
        data: { usageThisMonth: 0, usageResetAt: now },
      });
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        planExpiresAt: user.planExpiresAt,
        usageThisMonth: 0,
        usageResetAt: now,
      };
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      planExpiresAt: user.planExpiresAt,
      usageThisMonth: user.usageThisMonth,
      usageResetAt: user.usageResetAt,
    };
  } catch {
    return null;
  }
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, getSecret());
      const sessionId = payload.sessionId as string;
      await prisma.session.deleteMany({ where: { id: sessionId } });
    } catch {
      // token invalid, nothing to delete in DB
    }
  }

  cookieStore.delete(SESSION_COOKIE);
}
```

- [ ] **Step 3: Add SESSION_SECRET to .env.example**

Add to `.env.example`:
```
SESSION_SECRET=replace_with_at_least_32_random_characters
```

Add a real value to `.env.local`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy output and add to `.env.local`:
```
SESSION_SECRET=<output from above>
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/db.ts src/lib/session.ts .env.example
git commit -m "feat: add prisma client singleton and cookie session library"
```

---

## Task 4: Feature gate logic

**Files:**
- Create: `src/lib/plans.ts`
- Create: `src/lib/plans.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/plans.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { canGenerate, canExportDocx, canViewHistory, FREE_MONTHLY_LIMIT } from "./plans";
import type { SessionUser } from "./session";

function makeUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: "user_1",
    email: "test@example.com",
    name: null,
    plan: "free",
    planExpiresAt: null,
    usageThisMonth: 0,
    usageResetAt: new Date(),
    ...overrides,
  };
}

describe("canGenerate", () => {
  test("free user below limit can generate", () => {
    const user = makeUser({ plan: "free", usageThisMonth: 0 });
    expect(canGenerate(user)).toBe(true);
  });

  test("free user at limit cannot generate", () => {
    const user = makeUser({ plan: "free", usageThisMonth: FREE_MONTHLY_LIMIT });
    expect(canGenerate(user)).toBe(false);
  });

  test("pro user ignores usage count", () => {
    const user = makeUser({ plan: "pro", usageThisMonth: 999 });
    expect(canGenerate(user)).toBe(true);
  });

  test("pro user with expired plan (planExpiresAt in past) is treated as free", () => {
    const user = makeUser({
      plan: "pro",
      planExpiresAt: new Date(Date.now() - 1000),
      usageThisMonth: FREE_MONTHLY_LIMIT,
    });
    expect(canGenerate(user)).toBe(false);
  });

  test("pro user with planExpiresAt in future still has pro access", () => {
    const user = makeUser({
      plan: "pro",
      planExpiresAt: new Date(Date.now() + 86400_000),
      usageThisMonth: FREE_MONTHLY_LIMIT,
    });
    expect(canGenerate(user)).toBe(true);
  });
});

describe("canExportDocx", () => {
  test("free user cannot export docx", () => {
    expect(canExportDocx(makeUser({ plan: "free" }))).toBe(false);
  });

  test("pro user can export docx", () => {
    expect(canExportDocx(makeUser({ plan: "pro" }))).toBe(true);
  });

  test("pro user with expired plan cannot export docx", () => {
    const user = makeUser({ plan: "pro", planExpiresAt: new Date(Date.now() - 1000) });
    expect(canExportDocx(user)).toBe(false);
  });
});

describe("canViewHistory", () => {
  test("free user cannot view history", () => {
    expect(canViewHistory(makeUser({ plan: "free" }))).toBe(false);
  });

  test("pro user can view history", () => {
    expect(canViewHistory(makeUser({ plan: "pro" }))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test src/lib/plans.test.ts
```

Expected: FAIL — `Cannot find module './plans'`

- [ ] **Step 3: Implement plans.ts**

Create `src/lib/plans.ts`:

```ts
import type { SessionUser } from "./session";

export const FREE_MONTHLY_LIMIT = 5;

function isActivePro(user: SessionUser): boolean {
  if (user.plan !== "pro") return false;
  if (!user.planExpiresAt) return true;
  return user.planExpiresAt > new Date();
}

export function canGenerate(user: SessionUser): boolean {
  if (isActivePro(user)) return true;
  return user.usageThisMonth < FREE_MONTHLY_LIMIT;
}

export function canExportDocx(user: SessionUser): boolean {
  return isActivePro(user);
}

export function canViewHistory(user: SessionUser): boolean {
  return isActivePro(user);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test src/lib/plans.test.ts
```

Expected: PASS — 8 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/plans.ts src/lib/plans.test.ts
git commit -m "feat: add feature gate logic for free vs pro plans"
```

---

## Task 5: Add new API error codes

**Files:**
- Modify: `src/lib/api-errors.ts`

- [ ] **Step 1: Add codes to the apiErrorCodes array**

In `src/lib/api-errors.ts`, add `"UNAUTHENTICATED"`, `"PLAN_LIMIT_EXCEEDED"`, and `"PLAN_FEATURE_UNAVAILABLE"` to the `apiErrorCodes` array:

```ts
export const apiErrorCodes = [
  "INVALID_FILE_TYPE",
  "FILE_TOO_LARGE",
  "MISSING_UPLOAD_ID",
  "INVALID_UPLOAD_PATH",
  "FILE_NOT_FOUND",
  "MISSING_GEMINI_API_KEY",
  "INVALID_MODEL",
  "TRANSCRIPTION_FAILED",
  "NOTES_GENERATION_FAILED",
  "INVALID_TRANSCRIPT",
  "JSON_PARSE_FAILED",
  "INVALID_EXPORT_FORMAT",
  "INVALID_NOTES_DATA",
  "DOCX_EXPORT_FAILED",
  "DOCX_EXPORT_NOT_IMPLEMENTED",
  "CHUNK_UPLOAD_FAILED",
  "COMPLETE_UPLOAD_FAILED",
  "UNAUTHENTICATED",
  "PLAN_LIMIT_EXCEEDED",
  "PLAN_FEATURE_UNAVAILABLE",
  "INTERNAL_ERROR",
] as const;
```

- [ ] **Step 2: Run existing tests to verify nothing broke**

```bash
pnpm test src/lib/api-errors.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api-errors.ts
git commit -m "feat: add UNAUTHENTICATED, PLAN_LIMIT_EXCEEDED, PLAN_FEATURE_UNAVAILABLE error codes"
```

---

## Task 6: Auth Server Actions (signup, login, logout)

**Files:**
- Create: `src/app/actions/auth.ts`

- [ ] **Step 1: Create the auth actions file**

Create `src/app/actions/auth.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/session";

const SignupSchema = z.object({
  name: z.string().min(2, { message: "Tên phải có ít nhất 2 ký tự." }).trim(),
  email: z.string().email({ message: "Email không hợp lệ." }).trim().toLowerCase(),
  password: z
    .string()
    .min(8, { message: "Mật khẩu phải có ít nhất 8 ký tự." })
    .trim(),
});

const LoginSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().trim(),
});

export type AuthFormState = {
  errors?: Record<string, string[]>;
  message?: string;
} | undefined;

export async function signup(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const result = SignupSchema.safeParse(raw);

  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors };
  }

  const { name, email, password } = result.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { errors: { email: ["Email này đã được sử dụng."] } };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, passwordHash },
  });

  await createSession(user.id);
  redirect("/app");
}

export async function login(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const result = LoginSchema.safeParse(raw);
  if (!result.success) {
    return { message: "Email hoặc mật khẩu không đúng." };
  }

  const { email, password } = result.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { message: "Email hoặc mật khẩu không đúng." };
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    return { message: "Email hoặc mật khẩu không đúng." };
  }

  await createSession(user.id);
  redirect("/app");
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/");
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/actions/auth.ts
git commit -m "feat: add signup, login, logout Server Actions"
```

---

## Task 7: Auth pages (login and signup)

**Files:**
- Create: `src/app/auth/login/page.tsx`
- Create: `src/app/auth/signup/page.tsx`

- [ ] **Step 1: Create login page**

Create `src/app/auth/login/page.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, type AuthFormState } from "@/app/actions/auth";

export default function LoginPage() {
  const [state, action, isPending] = useActionState<AuthFormState, FormData>(
    login,
    undefined,
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eef3f8] px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase text-blue-700">cuochop</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Đăng nhập</h1>
        </div>

        <form action={action} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-slate-900">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-slate-900">
              Mật khẩu
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {state?.message ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {state.message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="h-10 w-full rounded-md bg-blue-700 text-sm font-semibold text-white transition enabled:hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isPending ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Chưa có tài khoản?{" "}
          <Link href="/auth/signup" className="font-semibold text-blue-700 hover:underline">
            Đăng ký miễn phí
          </Link>
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create signup page**

Create `src/app/auth/signup/page.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup, type AuthFormState } from "@/app/actions/auth";

export default function SignupPage() {
  const [state, action, isPending] = useActionState<AuthFormState, FormData>(
    signup,
    undefined,
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eef3f8] px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase text-blue-700">cuochop</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Tạo tài khoản</h1>
          <p className="mt-1 text-sm text-slate-500">Miễn phí, không cần thẻ tín dụng.</p>
        </div>

        <form action={action} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-slate-900">
              Họ tên
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoComplete="name"
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            {state?.errors?.name ? (
              <p className="mt-1 text-xs text-red-600">{state.errors.name[0]}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-slate-900">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            {state?.errors?.email ? (
              <p className="mt-1 text-xs text-red-600">{state.errors.email[0]}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-slate-900">
              Mật khẩu
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            {state?.errors?.password ? (
              <p className="mt-1 text-xs text-red-600">{state.errors.password[0]}</p>
            ) : null}
          </div>

          {state?.message ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {state.message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="h-10 w-full rounded-md bg-blue-700 text-sm font-semibold text-white transition enabled:hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isPending ? "Đang tạo tài khoản..." : "Tạo tài khoản miễn phí"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Đã có tài khoản?{" "}
          <Link href="/auth/login" className="font-semibold text-blue-700 hover:underline">
            Đăng nhập
          </Link>
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/auth/
git commit -m "feat: add login and signup pages"
```

---

## Task 8: Middleware (route protection)

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Create middleware**

Create `src/middleware.ts`:

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "cuochop_session";

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

const PROTECTED_PATHS = ["/app", "/history"];
const AUTH_PATHS = ["/auth/login", "/auth/signup"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  const isAuthPage = AUTH_PATHS.some((p) => pathname.startsWith(p));

  if (!isProtected && !isAuthPage) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  let isAuthenticated = false;

  if (token) {
    const secret = getSecret();
    if (secret) {
      try {
        await jwtVerify(token, secret);
        isAuthenticated = true;
      } catch {
        isAuthenticated = false;
      }
    }
  }

  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && isAuthenticated) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/history/:path*", "/auth/:path*"],
};
```

- [ ] **Step 2: Verify middleware does not break dev server**

```bash
pnpm dev
```

Open `http://localhost:3000/app` — should redirect to `/auth/login`. Open `http://localhost:3000` — should show current page (landing will replace this later). Stop dev server (Ctrl+C).

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add middleware to protect /app and /history routes"
```

---

## Task 9: Route restructure — move generator into (app) group

**Files:**
- Create: `src/app/(app)/app/page.tsx`
- Create: `src/app/(app)/layout.tsx`
- Delete: `src/app/page.tsx` (after creating marketing page)

- [ ] **Step 1: Create (app) layout (auth guard + app shell)**

Create `src/app/(app)/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { logout } from "@/app/actions/auth";
import { FREE_MONTHLY_LIMIT, canViewHistory } from "@/lib/plans";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/auth/login");

  const isPro = canViewHistory(user);
  const usageRemaining = Math.max(0, FREE_MONTHLY_LIMIT - user.usageThisMonth);
  const showUpsellBanner = !isPro && usageRemaining <= 2;

  return (
    <div className="min-h-screen bg-[#eef3f8]">
      {/* Top nav */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="text-sm font-bold text-blue-700">
            cuochop
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">{user.name || user.email}</span>
            <form action={logout}>
              <button
                type="submit"
                className="text-sm text-slate-500 hover:text-slate-800 transition"
              >
                Đăng xuất
              </button>
            </form>
          </div>
        </div>
        {/* Sub nav */}
        <div className="border-t border-slate-100 bg-slate-50">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2 sm:px-6">
            <nav className="flex gap-5">
              <Link
                href="/app"
                className="text-sm font-semibold text-blue-700 hover:text-blue-800"
              >
                New Meeting
              </Link>
              <Link
                href="/history"
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                History
              </Link>
            </nav>
            {!isPro ? (
              <div className="flex items-center gap-2">
                {showUpsellBanner ? (
                  <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                    {usageRemaining === 0
                      ? "Đã hết lượt miễn phí"
                      : `Còn ${usageRemaining} lượt`}{" "}
                    ·{" "}
                    <Link href="/pricing" className="underline">
                      Nâng cấp Pro
                    </Link>
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">
                    Free · {usageRemaining}/{FREE_MONTHLY_LIMIT} còn lại
                  </span>
                )}
              </div>
            ) : (
              <span className="rounded border border-blue-100 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                Pro
              </span>
            )}
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
```

- [ ] **Step 2: Move the generator page**

Create `src/app/(app)/app/page.tsx`:

```tsx
import { MeetingNotesGenerator } from "@/app/meeting-notes-generator";

export default function AppPage() {
  return <MeetingNotesGenerator />;
}
```

- [ ] **Step 3: Verify build still works**

```bash
pnpm build
```

Expected: Build succeeds. (The old `src/app/page.tsx` still exists but will be replaced in Task 12.)

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/
git commit -m "feat: add app shell layout with nav and usage banner"
```

---

## Task 10: Wire feature gates into API routes

**Files:**
- Modify: `src/app/api/generate-notes/route.ts`
- Modify: `src/app/api/export-notes/route.ts`

- [ ] **Step 1: Add auth + generate gate to generate-notes route**

In `src/app/api/generate-notes/route.ts`, add the auth and gate check at the top of the `POST` handler. Replace the existing `POST` export with:

```ts
import {
  generateVietnameseMeetingNotes,
  type VietnameseMeetingTranscript,
} from "@/lib/gemini";
import { formatMeetingNotesMarkdown } from "@/lib/formatMeetingNotesMarkdown";
import { getGeminiModelId } from "@/lib/models";
import { appApiError, createApiErrorResponse } from "@/lib/api-errors";
import { cleanupOldUploadsSafely } from "@/lib/upload-server";
import { getSession } from "@/lib/session";
import { canGenerate } from "@/lib/plans";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getSession();
    if (!user) {
      throw appApiError("UNAUTHENTICATED", "Bạn cần đăng nhập để sử dụng tính năng này.", 401);
    }

    if (!canGenerate(user)) {
      throw appApiError(
        "PLAN_LIMIT_EXCEEDED",
        `Bạn đã dùng hết ${user.usageThisMonth} lần miễn phí tháng này. Nâng cấp Pro để tiếp tục.`,
        423,
      );
    }

    const body: unknown = await request.json();
    const payload = isRecord(body) ? body : {};
    const transcript = payload.transcript;
    const notesModel = normalizeString(payload.notesModel);
    const originalName = normalizeString(payload.originalName) || undefined;

    if (!notesModel) {
      throw appApiError(
        "INVALID_MODEL",
        "Model tạo notes bị thiếu hoặc không hợp lệ.",
        400,
        "Missing notesModel.",
      );
    }

    getGeminiModelId(notesModel);

    if (!isTranscript(transcript)) {
      throw appApiError(
        "INVALID_TRANSCRIPT",
        "Transcript không hợp lệ hoặc đang rỗng.",
        400,
        "Transcript is required.",
      );
    }

    if (transcript.segments.length === 0) {
      throw appApiError(
        "INVALID_TRANSCRIPT",
        "Transcript không hợp lệ hoặc đang rỗng.",
        400,
        "Transcript is empty.",
      );
    }

    const notes = await generateVietnameseMeetingNotes({
      transcript,
      modelLabel: notesModel,
      originalName,
    });

    const markdown = formatMeetingNotesMarkdown(notes);

    // Increment usage counter
    await prisma.user.update({
      where: { id: user.id },
      data: { usageThisMonth: { increment: 1 } },
    });

    // Save to history
    await prisma.meetingNote.create({
      data: {
        userId: user.id,
        title: notes.title || originalName || "Meeting Notes",
        audioName: originalName || "unknown",
        notesJson: JSON.stringify(notes),
        markdown,
      },
    });

    await cleanupOldUploadsSafely({ route: "/api/generate-notes" });

    return Response.json({
      ok: true,
      notes,
      markdown,
    });
  } catch (error) {
    return createApiErrorResponse(error, {
      route: "/api/generate-notes",
      fallbackCode: "NOTES_GENERATION_FAILED",
      fallbackMessage: "Tạo meeting notes thất bại. Vui lòng thử lại.",
    });
  }
}

function isTranscript(value: unknown): value is VietnameseMeetingTranscript {
  return (
    isRecord(value) &&
    value.language === "vi" &&
    typeof value.duration === "string" &&
    Array.isArray(value.speakers) &&
    Array.isArray(value.segments)
  );
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
```

- [ ] **Step 2: Add auth + DOCX gate to export-notes route**

In `src/app/api/export-notes/route.ts`, add auth and gate check. Replace the full file:

```ts
import {
  exportMeetingNotes,
  type ExportFormat,
} from "@/lib/exporters/meeting-notes-exporter";
import type { VietnameseMeetingNotes } from "@/lib/gemini";
import { appApiError, createApiErrorResponse } from "@/lib/api-errors";
import { getSession } from "@/lib/session";
import { canExportDocx } from "@/lib/plans";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let format: string | undefined;

  try {
    const user = await getSession();
    if (!user) {
      throw appApiError("UNAUTHENTICATED", "Bạn cần đăng nhập để sử dụng tính năng này.", 401);
    }

    const body: unknown = await request.json();
    const payload = isRecord(body) ? body : {};
    format = normalizeString(payload.format) || undefined;
    const notes = payload.notes;

    if (format !== "markdown" && format !== "docx") {
      throw appApiError(
        "INVALID_EXPORT_FORMAT",
        "Định dạng export không hợp lệ.",
        400,
        `Invalid export format: ${String(format)}`,
      );
    }

    if (format === "docx" && !canExportDocx(user)) {
      throw appApiError(
        "PLAN_FEATURE_UNAVAILABLE",
        "Download DOCX chỉ có trên plan Pro. Nâng cấp để sử dụng tính năng này.",
        403,
      );
    }

    if (!isNotesData(notes)) {
      throw appApiError(
        "INVALID_NOTES_DATA",
        "Dữ liệu meeting notes không hợp lệ.",
        400,
      );
    }

    const result = await exportMeetingNotes(
      notes as VietnameseMeetingNotes,
      format as ExportFormat,
    );

    if (result.format === "docx") {
      const buffer = Buffer.isBuffer(result.content)
        ? result.content
        : Buffer.from(String(result.content));

      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": result.mimeType,
          "Content-Disposition": `attachment; filename="${result.filename}"`,
        },
      });
    }

    return Response.json({
      ok: true,
      filename: result.filename,
      mimeType: result.mimeType,
      content: String(result.content),
      format: result.format,
    });
  } catch (error) {
    return createApiErrorResponse(error, {
      route: "/api/export-notes",
      fallbackCode: format === "docx" ? "DOCX_EXPORT_FAILED" : "INTERNAL_ERROR",
      fallbackMessage:
        format === "docx"
          ? "Không thể xuất DOCX. Vui lòng thử lại."
          : "Không thể export meeting notes. Vui lòng thử lại.",
    });
  }
}

function isNotesData(value: unknown) {
  return isRecord(value) && isRecord(value.meetingOverview);
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/generate-notes/route.ts src/app/api/export-notes/route.ts
git commit -m "feat: add auth and plan gates to generate-notes and export-notes API routes"
```

---

## Task 11: Meeting history page

**Files:**
- Create: `src/app/(app)/history/page.tsx`

- [ ] **Step 1: Create history page**

Create `src/app/(app)/history/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canViewHistory } from "@/lib/plans";
import { prisma } from "@/lib/db";
import type { VietnameseMeetingNotes } from "@/lib/gemini";

export default async function HistoryPage() {
  const user = await getSession();
  if (!user) redirect("/auth/login");

  if (!canViewHistory(user)) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-8 text-center">
          <p className="text-sm font-semibold uppercase text-amber-700">Tính năng Pro</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Lịch sử cuộc họp</h1>
          <p className="mt-3 text-slate-600">
            Nâng cấp lên Pro để lưu và xem lại toàn bộ lịch sử meeting notes.
          </p>
          <Link
            href="/pricing"
            className="mt-6 inline-flex h-10 items-center rounded-md bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Xem plans và nâng cấp
          </Link>
        </div>
      </main>
    );
  }

  const notes = await prisma.meetingNote.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-950">Lịch sử cuộc họp</h1>
        <p className="mt-1 text-sm text-slate-600">
          {notes.length} cuộc họp đã lưu
        </p>
      </div>

      {notes.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-600">Chưa có cuộc họp nào. Generate meeting notes đầu tiên!</p>
          <Link
            href="/app"
            className="mt-4 inline-flex h-10 items-center rounded-md bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800"
          >
            New Meeting
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {notes.map((note) => {
            const parsed = tryParseNotes(note.notesJson);
            return (
              <div
                key={note.id}
                className="rounded-lg border border-slate-200 bg-white p-5"
              >
                <div className="mb-3">
                  <h2 className="font-semibold text-slate-950 line-clamp-2">{note.title}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(note.createdAt)} · {note.audioName}
                  </p>
                </div>

                {parsed ? (
                  <>
                    <p className="mb-3 text-sm text-slate-600 line-clamp-3">
                      {parsed.executiveSummary[0] ?? ""}
                    </p>
                    <div className="flex gap-2">
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                        {parsed.decisions.length} decisions
                      </span>
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        {parsed.actionItems.length} actions
                      </span>
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

function tryParseNotes(json: string): VietnameseMeetingNotes | null {
  try {
    return JSON.parse(json) as VietnameseMeetingNotes;
  } catch {
    return null;
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/history/
git commit -m "feat: add meeting history page (Pro only)"
```

---

## Task 12: Landing page and replace root page

**Files:**
- Create: `src/app/(marketing)/page.tsx`
- Delete: `src/app/page.tsx`

- [ ] **Step 1: Create the (marketing) landing page**

Create `src/app/(marketing)/page.tsx`:

```tsx
import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-slate-100 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="text-sm font-bold text-blue-700">cuochop</span>
          <div className="flex items-center gap-4">
            <Link href="/auth/login" className="text-sm text-slate-600 hover:text-slate-900">
              Đăng nhập
            </Link>
            <Link
              href="/auth/signup"
              className="inline-flex h-8 items-center rounded-md bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Dùng miễn phí
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-4 py-16 text-center sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Vietnamese AI Workspace
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Biến mọi cuộc họp thành
            <br />
            hành động rõ ràng
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            Upload file audio hoặc video — AI tạo meeting notes tiếng Việt có speaker labels,
            timestamps, decisions và action items trong vài phút.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="/auth/signup"
              className="inline-flex h-12 items-center rounded-md bg-blue-700 px-6 text-base font-semibold text-white shadow-sm hover:bg-blue-800"
            >
              Dùng miễn phí
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-12 items-center rounded-md border border-slate-300 px-6 text-base font-semibold text-slate-700 hover:border-blue-400 hover:text-blue-700"
            >
              Xem tính năng Pro →
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-slate-100 bg-slate-50 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold text-slate-950">
            3 bước đơn giản
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Upload",
                desc: "Kéo thả file MP3, MP4, WAV hoặc M4A lên tối đa 1GB. Upload theo chunk an toàn.",
              },
              {
                step: "2",
                title: "Transcribe",
                desc: "Gemini AI tạo transcript tiếng Việt với speaker labels và timestamps chính xác.",
              },
              {
                step: "3",
                title: "Export",
                desc: "Copy Markdown, tải file .md hoặc .docx (Pro). Lưu vào lịch sử để xem lại.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-lg border border-slate-200 bg-white p-6"
              >
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-blue-700 text-sm font-bold text-white">
                  {item.step}
                </div>
                <h3 className="font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold text-slate-950">
            Mọi thứ bạn cần từ một cuộc họp
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: "Speaker labels", desc: "Phân biệt từng người nói tự động." },
              { title: "Action items", desc: "Việc cần làm, người phụ trách, deadline." },
              { title: "Decisions", desc: "Các quyết định đã chốt trong cuộc họp." },
              { title: "Risks & blockers", desc: "Rủi ro và vấn đề cần giải quyết." },
            ].map((f) => (
              <div key={f.title} className="rounded-lg border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-950">{f.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing preview */}
      <section className="border-t border-slate-100 bg-slate-50 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-semibold text-slate-950">Đơn giản và minh bạch</h2>
          <p className="mt-3 text-slate-600">
            Bắt đầu miễn phí, nâng cấp khi cần.
          </p>
          <Link
            href="/pricing"
            className="mt-6 inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:border-blue-400 hover:text-blue-700"
          >
            Xem chi tiết pricing →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 px-4 py-8 text-center text-sm text-slate-500 sm:px-6">
        <p>© 2026 cuochop. Vietnamese AI Workspace.</p>
      </footer>
    </main>
  );
}
```

- [ ] **Step 2: Delete the old root page**

```bash
rm src/app/page.tsx
```

- [ ] **Step 3: Verify build**

```bash
pnpm build
```

Expected: Build succeeds. Root route `/` now resolves to the landing page via `(marketing)/page.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(marketing\)/ src/app/page.tsx
git commit -m "feat: add landing page, remove old root page"
```

---

## Task 13: Pricing page

**Files:**
- Create: `src/app/(marketing)/pricing/page.tsx`

- [ ] **Step 1: Create pricing page**

Create `src/app/(marketing)/pricing/page.tsx`:

```tsx
import Link from "next/link";

const FREE_FEATURES = [
  "5 cuộc họp/tháng",
  "Copy Markdown",
  "Download .md",
  "Gemini transcription",
];

const PRO_FEATURES = [
  "Unlimited cuộc họp",
  "Copy Markdown",
  "Download .md",
  "Download .docx",
  "Lịch sử meeting notes",
  "Gemini transcription",
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-slate-100 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="text-sm font-bold text-blue-700">cuochop</Link>
          <div className="flex items-center gap-4">
            <Link href="/auth/login" className="text-sm text-slate-600 hover:text-slate-900">
              Đăng nhập
            </Link>
            <Link
              href="/auth/signup"
              className="inline-flex h-8 items-center rounded-md bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Dùng miễn phí
            </Link>
          </div>
        </div>
      </header>

      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-semibold text-slate-950">Pricing đơn giản</h1>
          <p className="mt-3 text-lg text-slate-600">
            Bắt đầu miễn phí. Nâng cấp khi bạn cần thêm.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-3xl gap-6 sm:grid-cols-2">
          {/* Free */}
          <div className="rounded-xl border border-slate-200 p-8">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Free</p>
            <div className="mt-3 flex items-end gap-1">
              <span className="text-4xl font-bold text-slate-950">$0</span>
              <span className="mb-1 text-sm text-slate-500">mãi mãi</span>
            </div>
            <ul className="mt-6 space-y-3">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                  <span className="text-emerald-500">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/auth/signup"
              className="mt-8 flex h-10 items-center justify-center rounded-md border border-slate-300 text-sm font-semibold text-slate-700 hover:border-blue-400 hover:text-blue-700"
            >
              Bắt đầu miễn phí
            </Link>
          </div>

          {/* Pro */}
          <div className="rounded-xl border-2 border-blue-700 bg-blue-700 p-8 text-white">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-200">Pro</p>
            <div className="mt-3 flex items-end gap-1">
              <span className="text-4xl font-bold">$9</span>
              <span className="mb-1 text-sm text-blue-200">/tháng</span>
            </div>
            <ul className="mt-6 space-y-3">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-blue-100">
                  <span className="text-white">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/auth/signup"
              className="mt-8 flex h-10 items-center justify-center rounded-md bg-white text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              Nâng cấp Pro
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(marketing\)/pricing/
git commit -m "feat: add pricing page"
```

---

## Task 14: LemonSqueezy billing

**Files:**
- Create: `src/app/api/billing/checkout/route.ts`
- Create: `src/app/api/webhooks/lemonsqueezy/route.ts`

- [ ] **Step 1: Add LemonSqueezy env vars to .env.example**

Add to `.env.example`:
```
LEMONSQUEEZY_API_KEY=
LEMONSQUEEZY_STORE_ID=
LEMONSQUEEZY_VARIANT_ID=
LEMONSQUEEZY_WEBHOOK_SECRET=
```

Add test values to `.env.local` (fill in real values from LemonSqueezy dashboard):
```
LEMONSQUEEZY_API_KEY=test_...
LEMONSQUEEZY_STORE_ID=12345
LEMONSQUEEZY_VARIANT_ID=67890
LEMONSQUEEZY_WEBHOOK_SECRET=test_webhook_secret
```

- [ ] **Step 2: Create checkout route**

Create `src/app/api/billing/checkout/route.ts`:

```ts
import { lemonSqueezySetup, createCheckout } from "@lemonsqueezy/lemonsqueezy.js";
import { getSession } from "@/lib/session";
import { appApiError, createApiErrorResponse } from "@/lib/api-errors";

export const runtime = "nodejs";

export async function POST() {
  try {
    const user = await getSession();
    if (!user) {
      throw appApiError("UNAUTHENTICATED", "Bạn cần đăng nhập.", 401);
    }

    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    const storeId = process.env.LEMONSQUEEZY_STORE_ID;
    const variantId = process.env.LEMONSQUEEZY_VARIANT_ID;

    if (!apiKey || !storeId || !variantId) {
      throw appApiError("INTERNAL_ERROR", "Billing chưa được cấu hình.", 500);
    }

    lemonSqueezySetup({ apiKey });

    const checkout = await createCheckout(storeId, variantId, {
      checkoutData: {
        email: user.email,
        name: user.name ?? undefined,
        custom: { userId: user.id },
      },
      checkoutOptions: {
        embed: false,
        media: false,
      },
      productOptions: {
        redirectUrl: `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/app?upgrade=success`,
        receiptButtonText: "Quay lại app",
      },
    });

    const checkoutUrl = checkout.data?.data.attributes.url;
    if (!checkoutUrl) {
      throw appApiError("INTERNAL_ERROR", "Không thể tạo checkout URL.", 500);
    }

    return Response.json({ ok: true, url: checkoutUrl });
  } catch (error) {
    return createApiErrorResponse(error, {
      route: "/api/billing/checkout",
      fallbackCode: "INTERNAL_ERROR",
      fallbackMessage: "Không thể tạo checkout. Vui lòng thử lại.",
      fallbackStatus: 500,
    });
  }
}
```

- [ ] **Step 3: Create webhook handler**

Create `src/app/api/webhooks/lemonsqueezy/route.ts`:

```ts
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("X-Signature");

  if (!signature || !verifySignature(rawBody, signature, secret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const eventName = event.meta && typeof event.meta === "object"
    ? (event.meta as Record<string, unknown>).event_name as string
    : null;

  const customData = event.meta && typeof event.meta === "object"
    ? (event.meta as Record<string, unknown>).custom_data as Record<string, unknown> | undefined
    : undefined;

  const userId = customData?.userId as string | undefined;

  if (!userId) {
    // No userId in custom_data, ignore
    return new Response("OK", { status: 200 });
  }

  try {
    if (eventName === "order_created") {
      const attrs = getAttributes(event);
      const lsCustomerId = String(attrs?.customer_id ?? "");
      const lsSubscriptionId = String(attrs?.subscription_id ?? attrs?.id ?? "");

      await prisma.user.update({
        where: { id: userId },
        data: {
          plan: "pro",
          planExpiresAt: null,
          lsCustomerId: lsCustomerId || undefined,
          lsSubscriptionId: lsSubscriptionId || undefined,
        },
      });
    } else if (eventName === "subscription_cancelled") {
      const attrs = getAttributes(event);
      const endsAt = attrs?.ends_at ? new Date(String(attrs.ends_at)) : null;

      await prisma.user.update({
        where: { id: userId },
        data: { planExpiresAt: endsAt },
      });
    } else if (eventName === "subscription_expired") {
      await prisma.user.update({
        where: { id: userId },
        data: { plan: "free", planExpiresAt: null },
      });
    }
  } catch (error) {
    console.error("[webhook] Failed to process event", eventName, error);
    return new Response("Internal error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}

function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

function getAttributes(event: Record<string, unknown>) {
  const data = event.data;
  if (!data || typeof data !== "object") return null;
  const attrs = (data as Record<string, unknown>).attributes;
  return attrs && typeof attrs === "object"
    ? (attrs as Record<string, unknown>)
    : null;
}
```

- [ ] **Step 4: Add NEXT_PUBLIC_BASE_URL to .env.example**

Add to `.env.example`:
```
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/billing/ src/app/api/webhooks/ .env.example
git commit -m "feat: add LemonSqueezy checkout and webhook handler"
```

---

## Task 15: Upsell modal for DOCX on free plan

**Files:**
- Modify: `src/app/meeting-notes-generator.tsx`

- [ ] **Step 1: Add upsell modal state and handler**

In `src/app/meeting-notes-generator.tsx`, add `showDocxUpsell` state and update the DOCX button behavior for free users.

The component doesn't know the user's plan, so it needs to handle the `403` error code returned by the API. In the `handleDownloadDocx` catch block, check for `PLAN_FEATURE_UNAVAILABLE` and show the upsell modal instead of the generic error.

Add to the state declarations in `MeetingNotesGenerator`:
```tsx
const [showDocxUpsell, setShowDocxUpsell] = useState(false);
```

Update the catch block in `handleDownloadDocx`:
```tsx
} catch (error) {
  const code = getErrorCode(error);
  if (code === "PLAN_FEATURE_UNAVAILABLE") {
    setShowDocxUpsell(true);
    return;
  }
  setExportError({
    message: getErrorMessage(
      error,
      "Không thể xuất DOCX. Vui lòng thử lại.",
    ),
    code,
  });
}
```

Add the upsell modal just before the closing `</main>` tag:
```tsx
{showDocxUpsell ? (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
    <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-xl">
      <h2 className="text-xl font-semibold text-slate-950">Download DOCX</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Tính năng này chỉ có trên plan <strong>Pro</strong>. Nâng cấp để tải .docx và
        lưu lịch sử cuộc họp không giới hạn.
      </p>
      <div className="mt-6 flex gap-3">
        <a
          href="/pricing"
          className="flex-1 inline-flex h-10 items-center justify-center rounded-md bg-blue-700 text-sm font-semibold text-white hover:bg-blue-800"
        >
          Xem plans Pro
        </a>
        <button
          type="button"
          onClick={() => setShowDocxUpsell(false)}
          className="flex-1 h-10 rounded-md border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Đóng
        </button>
      </div>
    </div>
  </div>
) : null}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/meeting-notes-generator.tsx
git commit -m "feat: add DOCX upsell modal for free plan users"
```

---

## Task 16: Docker and deployment updates

**Files:**
- Modify: `docker-compose.yml`
- Modify: `Dockerfile`
- Modify: `.env.example`

- [ ] **Step 1: Read the existing docker-compose.yml and Dockerfile**

```bash
cat docker-compose.yml
cat Dockerfile
```

- [ ] **Step 2: Update docker-compose.yml**

The updated `docker-compose.yml` should add the `data` volume and new env vars. Keep the existing structure but add/update these fields:

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env.local
    volumes:
      - ./tmp/uploads:/app/tmp/uploads
      - ./data:/app/data
    restart: unless-stopped
```

- [ ] **Step 3: Update Dockerfile to run prisma migrate on start**

Read the existing Dockerfile, then add `npx prisma migrate deploy` before starting the app.

Find the `CMD` or `ENTRYPOINT` line. Replace it with an entrypoint script or inline command. If the existing CMD is `["node", "server.js"]` or `pnpm start`, change it to:

```dockerfile
CMD sh -c "npx prisma migrate deploy && node server.js"
```

If the app uses `pnpm start`:
```dockerfile
CMD sh -c "npx prisma migrate deploy && pnpm start"
```

Also ensure `prisma` is available in the production image by adding it to the COPY step or keeping it in `devDependencies` → `dependencies`. Since `prisma` CLI is needed at runtime for migrations, add it:

```bash
pnpm add prisma
```

Then in Dockerfile, after copying node_modules, the CLI will be available.

- [ ] **Step 4: Verify Docker build**

```bash
docker compose build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml Dockerfile package.json pnpm-lock.yaml .env.example
git commit -m "feat: update Docker setup for SQLite volume and prisma migrate on startup"
```

---

## Task 17: Smoke test end-to-end

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```

Expected: All existing tests pass. New plan tests pass (8 tests in plans.test.ts).

- [ ] **Step 2: Start dev server and test manually**

```bash
pnpm dev
```

Test the following flows:

1. Open `http://localhost:3000` — landing page shows (blue navy, hero, 3-step section).
2. Open `http://localhost:3000/pricing` — pricing page with Free vs Pro cards.
3. Open `http://localhost:3000/app` — redirects to `/auth/login`.
4. Sign up at `/auth/signup` with a test email — redirects to `/app`.
5. Generate meeting notes with a small test audio file — progress shows, notes appear.
6. Check usage banner — shows "4/5 còn lại".
7. Click "Download .docx" — upsell modal appears.
8. Open `/history` — shows the note just created.
9. Logout — redirects to `/`.
10. Login again — session restored, history preserved.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: finalize commercialization feature — auth, history, landing, billing"
```
