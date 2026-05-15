# Commercialization Design — cuochop

**Date:** 2026-05-15  
**Status:** Approved

---

## 1. Goal

Transform the cuochop MVP (Vietnamese meeting notes generator) into a commercial product with freemium monetization, user authentication, meeting history, and a landing/pricing page. Target: individuals (free) and teams (Pro paid plan).

---

## 2. Scope

This spec covers the first commercial release:

- Auth (signup / login / logout)
- Feature gates (free vs Pro)
- Meeting notes history (Pro only)
- Landing page + pricing page
- Billing via LemonSqueezy
- DOCX export completion (behind Pro gate)

**Out of scope for this release:** team workspaces, invitations, shared notes, search, admin dashboard.

---

## 3. Business Model

**Freemium — feature-gated:**

| Feature | Free | Pro ($9/month) |
|---|---|---|
| Generate meeting notes | 5/month | Unlimited |
| Copy Markdown | ✓ | ✓ |
| Download .md | ✓ | ✓ |
| Download .docx | ✗ | ✓ |
| Meeting history | ✗ | ✓ |

---

## 4. Architecture

**Stack additions to existing Next.js app:**

- **Prisma + SQLite** — ORM and database, single file, easy backup on VPS
- **NextAuth.js v5** — email/password auth, database sessions
- **LemonSqueezy** — billing, merchant of record (handles VAT/tax for Vietnamese sellers)

**Deployment:** VPS/Docker (existing Docker setup). SQLite file persisted via Docker volume.

**New file structure:**

```
prisma/
  schema.prisma

src/
  app/
    (marketing)/          # No auth required
      page.tsx            # Landing page (replaces current src/app/page.tsx)
      pricing/
        page.tsx
    (app)/                # Auth-protected route group
      layout.tsx          # Auth guard + app shell (minimal nav + usage banner)
      app/
        page.tsx          # Meeting generator (existing, adapted)
      history/
        page.tsx          # Meeting history (Pro only)
    api/
      auth/[...nextauth]/
        route.ts
      billing/
        checkout/route.ts
      webhooks/
        lemonsqueezy/route.ts
    auth/
      login/page.tsx
      signup/page.tsx
  lib/
    auth.ts               # NextAuth config
    db.ts                 # Prisma client singleton
    plans.ts              # Feature gate logic
  middleware.ts           # Route protection
```

---

## 5. Database Schema

```prisma
model User {
  id               String        @id @default(cuid())
  email            String        @unique
  name             String?
  passwordHash     String
  plan             String        @default("free")  // "free" | "pro"
  planExpiresAt    DateTime?     // Set when subscription is cancelled, cleared on renewal
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
  user      User     @relation(fields: [userId], references: [id])
}

model MeetingNote {
  id        String   @id @default(cuid())
  userId    String
  title     String
  audioName String
  notesJson String   // Serialized VietnameseMeetingNotes
  markdown  String
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
}
```

---

## 6. Auth Flow

**Provider:** Credentials (email + password)  
**Session strategy:** Database sessions (stored in SQLite)

- `POST /auth/signup` — validate email uniqueness, hash password with bcrypt, create user (`plan = "free"`, `usageThisMonth = 0`), auto-login
- `POST /auth/login` — validate credentials, create session
- `POST /auth/logout` — destroy session
- `src/middleware.ts` — redirect unauthenticated requests to `/auth/login` for all `/app/*` and `/history` routes

---

## 7. Feature Gate Logic (`src/lib/plans.ts`)

```ts
const FREE_MONTHLY_LIMIT = 5

canGenerate(user): boolean
  → user.plan === "pro" || user.usageThisMonth < FREE_MONTHLY_LIMIT

canExportDocx(user): boolean
  → user.plan === "pro"

canViewHistory(user): boolean
  → user.plan === "pro"
```

**Usage tracking:**
- After each successful generate: `user.usageThisMonth += 1`
- Reset: lazy reset — on each request, if `usageResetAt` is in a previous calendar month, reset `usageThisMonth = 0` and update `usageResetAt`

**API enforcement:** Every API route (`/api/generate-notes`, `/api/export-notes`) checks the gate server-side before processing.

---

## 8. Billing Flow (LemonSqueezy)

**Checkout:**
1. User clicks "Nâng cấp Pro"
2. `POST /api/billing/checkout` — server creates LemonSqueezy checkout URL with `userId` in `custom_data`
3. User redirected to LemonSqueezy hosted checkout
4. On success → redirect to `/app?upgrade=success`

**Webhook (`POST /api/webhooks/lemonsqueezy`):**
- Verify `X-Signature` header before processing
- `order_created` → `user.plan = "pro"`, store `lsCustomerId` + `lsSubscriptionId`, clear `planExpiresAt`
- `subscription_cancelled` → set `planExpiresAt` to end of current billing period (user still has Pro access until then)
- `subscription_expired` → `user.plan = "free"`, clear `planExpiresAt` (access actually revoked here)

**Upsell triggers (where "Nâng cấp Pro" appears):**
- Usage banner in app shell when `usageThisMonth >= 3`
- Modal when free user clicks "Download .docx"
- Banner on `/history` for free users (shows preview, not full block)

---

## 9. UI Design Decisions

| Section | Decision |
|---|---|
| Landing page | Professional SaaS — blue navy, strong headline, 3-step feature cards |
| Pricing page | Side-by-side Free vs Pro cards, Pro highlighted in navy |
| App shell | Minimal top nav + sub-bar with usage counter + upsell banner |
| History page | 2-column card grid with title, metadata, summary preview, decisions/actions badges |

**Landing page sections:**
1. Hero — headline, subheadline, "Dùng miễn phí" CTA + "Xem tính năng Pro" secondary CTA
2. How it works — 3 steps: Upload → Transcribe → Export
3. Features — highlight speaker labels, timestamps, structured notes, DOCX
4. Pricing — Free vs Pro cards
5. Footer — links, copyright

---

## 10. Error Handling

- Auth errors: clear Vietnamese messages ("Email đã tồn tại", "Sai mật khẩu")
- Usage limit hit: `423 Locked` from API + UI shows "Bạn đã dùng hết 5 lần miễn phí tháng này. Nâng cấp Pro để tiếp tục."
- DOCX gate: `403 Forbidden` from API + upsell modal in UI
- LemonSqueezy webhook failure: log error, return 500 (LemonSqueezy will retry)
- Billing checkout failure: show error toast, do not redirect

---

## 11. Docker / Deployment Changes

- Add `DATABASE_URL` env var pointing to SQLite file path
- Add `NEXTAUTH_SECRET` env var
- Add `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_WEBHOOK_SECRET`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_VARIANT_ID` env vars
- Mount SQLite file as Docker volume for persistence: `./data:/app/data`
- Run `prisma migrate deploy` on container start (add to Dockerfile CMD or entrypoint)
