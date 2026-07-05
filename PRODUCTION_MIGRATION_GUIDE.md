# Production Migration Guide - Cuochop
## From MVP Local Storage to Enterprise-Ready System

**Document Version:** 1.0  
**Last Updated:** 2026-07-05  
**Status:** CRITICAL - Execute before 10x scale  
**Estimated Timeline:** 4-6 weeks  
**Risk Level:** HIGH without these changes

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Phase 1: Cloud Storage Migration](#phase-1-cloud-storage-migration)
3. [Phase 2: Error Handling & Observability](#phase-2-error-handling--observability)
4. [Phase 3: Database Audit Trail](#phase-3-database-audit-trail)
5. [Phase 4: Rate Limiting & Security](#phase-4-rate-limiting--security)
6. [Phase 5: Resilience Patterns](#phase-5-resilience-patterns)
7. [Deployment Checklist](#deployment-checklist)

---

## Executive Summary

### Current System Criticality Matrix

| Issue | Severity | Impact | Timeline |
|-------|----------|--------|----------|
| Local temp storage (no cloud backup) | 🔴 CRITICAL | System fails in serverless/distributed | Immediate |
| Silent fallbacks (no error tracking) | 🔴 CRITICAL | Undetected data corruption | Immediate |
| No audit trail/soft delete | 🟡 HIGH | Unrecoverable data loss | This sprint |
| No rate limiting | 🟡 HIGH | Brute force attacks possible | This sprint |
| No retry logic/circuit breaker | 🟠 MEDIUM | Cascading failures | Next sprint |

### Why This Matters

**Current State (MVP):**
```
User Upload → LocalTemp (tmp/uploads/)
              ↓
           ONE PROCESS
              ↓
         Serverless? BROKEN
       Multi-container? BROKEN
        Load balancer? BROKEN
```

**Production State (After Migration):**
```
User Upload → S3/GCS Signed URL (or VPS Volume)
              ↓
        Multiple Processes OK ✓
              ↓
        Serverless OK ✓
              ↓
     Auto-scaling OK ✓
```

---

## Phase 1: Cloud Storage Migration

### Step 1.1: Setup AWS S3 / Google Cloud Storage

#### Option A: AWS S3 (Recommended for Distributed)

**Environment Setup:**

```bash
# .env.local additions
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET=cuochop-uploads-prod
S3_UPLOAD_PREFIX=uploads/
S3_UPLOAD_TTL_HOURS=24
```

#### Option B: VPS Self-Hosted (Recommended for Single Server)

```bash
# .env.local
STORAGE_TYPE=vps
UPLOAD_ROOT=/app/data/uploads
UPLOAD_TTL_HOURS=24
```

---

## Phase 2: Error Handling & Observability

### Add Sentry Integration

**Install dependencies:**

```bash
npm install @sentry/nextjs
```

**File: `src/lib/sentry.ts`**

```typescript
import * as Sentry from "@sentry/nextjs";

export function initSentry() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  });
}

export function captureException(error: unknown, context: {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  userId?: string;
}) {
  return Sentry.captureException(error, {
    tags: { ...context.tags, timestamp: new Date().toISOString() },
    extra: context.extra,
    user: context.userId ? { id: context.userId } : undefined,
  });
}
```

---

## Phase 3: Database Audit Trail

### Update Prisma Schema

**File: `prisma/schema.prisma` (Key Updates)**

```prisma
model MeetingNote {
  id             String                 @id @default(cuid())
  userId         String
  organizationId String?
  title          String
  audioName      String
  notesJson      String
  markdown       String
  createdAt      DateTime               @default(now())
  updatedAt      DateTime               @updatedAt         // ← NEW
  deletedAt      DateTime?              // ← NEW: Soft delete
  user           User                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization   Organization?          @relation(fields: [organizationId], references: [id], onDelete: SetNull)
  actionItems    ActionItem[]
  decisions      Decision[]
  history        MeetingNoteHistory[]   // ← NEW: Audit trail

  @@index([organizationId])
  @@index([userId, deletedAt])
}

model MeetingNoteHistory {
  id             String        @id @default(cuid())
  meetingNoteId  String
  meetingNote    MeetingNote   @relation(fields: [meetingNoteId], references: [id], onDelete: Cascade)
  version        Int
  changeType     String        // "CREATE", "UPDATE", "DELETE"
  changedBy      String
  changedAt      DateTime      @default(now())
  previousState  String?       // JSON snapshot
  currentState   String        // JSON snapshot
  changedFields  String        // JSON: which fields changed

  @@unique([meetingNoteId, version])
  @@index([meetingNoteId])
  @@index([changedBy])
}
```

**Run migration:**

```bash
npx prisma migrate dev --name add_audit_trail_soft_delete
```

---

## Phase 4: Rate Limiting & Security

### Add Rate Limiting

**Install:**

```bash
npm install @upstash/ratelimit
```

**File: `src/lib/rate-limiter.ts`**

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

export const uploadRateLimiter = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(20, "1 h"),
});
```

---

## Phase 5: Resilience Patterns

### Retry Logic

**File: `src/lib/retry.ts`**

```typescript
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options = {},
): Promise<T> {
  const { maxAttempts = 3, initialDelayMs = 100, backoffMultiplier = 2 } = options;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxAttempts - 1) throw error;
      const delay = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt),
        10000,
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error("Max retries exceeded");
}
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] Database migrations tested locally
- [ ] Error tracking (Sentry) configured
- [ ] Rate limiting setup verified
- [ ] Backup strategy documented
- [ ] SSL certificate ready
- [ ] Domain DNS configured

### Post-Deployment
- [ ] Monitor error rates (Sentry)
- [ ] Check application performance
- [ ] Verify backups working
- [ ] Test recovery procedure

---

**Next Step:** Choose your hosting:
1. **VPS + Docker** → Read `PRODUCTION_DEPLOYMENT_VPS_DOCKER.md`
2. **Serverless + S3** → Read `PRODUCTION_DEPLOYMENT_CLOUD.md` (Coming Soon)
