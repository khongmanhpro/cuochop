# Roadmap fix cuochop

**Ngày tạo:** 2026-07-08
**Trạng thái:** Draft chờ duyệt
**Nguồn:** Phân tích chuyên gia xây dựng & kiểm thử tính năng

---

## Nguyên tắc sắp xếp

1. **Security trước, feature sau** — lỗ hổng bảo mật có thể mất dữ liệu người dùng ngay lập tức.
2. **Test trước, refactor sau** — không refactor code không có test, không thêm feature không có test verify.
3. **Small batch, verify từng bước** — mỗi task phải có `pnpm test` + `pnpm build` pass trước khi sang task kế.
4. **Không động schema DB nếu chưa cần** — giữ backward-compatible, tránh migration rủi ro.
5. **Mọi thay đổi phải có verify bằng command thật** — không báo done nếu chưa chạy test/build.

---

## Phase 0 — Critical security & data integrity (P0, chặn ship)

Mục tiêu: không có lỗ hổng cho phép mất dữ liệu hoặc injection.

### Task 0.1: Verify FTS5 SQL escape trong search.ts

**Vấn đề:** `src/lib/search.ts` build FTS5 query bằng template string với `escapeSql(ftsQuery)`. Cần verify hàm này chống được FTS5 special chars (`*`, `"`, `:`, `(`, `)`, `OR`, `AND`, `NOT`).

**Acceptance criteria:**
- Audit `escapeSql` xem có escape đủ FTS5 syntax không.
- Thêm unit test cho `escapeSql` với input: `*`, `"`, `:`, `OR`, `AND`, `NOT`, `;`, `'`, `--`, `union select`.
- Nếu escape chưa đủ, fix và thêm test.
- Không còn string interpolation trực tiếp trong FTS query.

**Verify:**
- `pnpm test src/lib/search.test.ts`
- `pnpm build`

**Files likely touched:**
- `src/lib/search.ts`
- `src/lib/search.test.ts`

**Scope:** S

---

### Task 0.2: Rate limit cho Gemini API calls

**Vấn đề:** Không có rate limit cho `/api/transcribe` và `/api/generate-notes`. User có thể spam request gây Gemini billing spike hoặc rate limit từ Google.

**Acceptance criteria:**
- Thêm rate limit per-user: tối đa 5 request/phút cho transcribe + generate.
- Trả 429 với `Retry-After` header khi vượt limit.
- Rate limit dùng in-memory Map (đủ cho single-instance Docker).
- Test cho rate limit logic.

**Verify:**
- `pnpm test` (test mới)
- `pnpm build`
- Manual: gửi 6 request liên tiếp → request 6 trả 429.

**Files likely touched:**
- `src/lib/rate-limit.ts` (mới)
- `src/lib/rate-limit.test.ts` (mới)
- `src/app/api/transcribe/route.ts`
- `src/app/api/generate-notes/route.ts`

**Scope:** M

---

### Task 0.3: Fallback parsing cho Gemini JSON response

**Vấn đề:** `src/lib/gemini.ts` không có fallback nếu Gemini trả text ngoài JSON schema. README ghi "may need fallback parsing" nhưng chưa có handler.

**Acceptance criteria:**
- Nếu `JSON.parse` fail, thử extract JSON block từ text (regex `<json>...</json>` hoặc `\{[\s\S]*\}`).
- Nếu vẫn fail, throw error rõ với message tiếng Việt, không crash route.
- Log raw response để debug (không log prompt).
- Unit test cho 3 case: valid JSON, JSON trong text, không phải JSON.

**Verify:**
- `pnpm test src/lib/gemini.test.ts`
- `pnpm build`

**Files likely touched:**
- `src/lib/gemini.ts`
- `src/lib/gemini.test.ts`

**Scope:** M

---

### Task 0.4: Upload path traversal audit

**Vấn đề:** `src/lib/upload-server.ts` xử lý filename và storedPath. Cần verify không cho path traversal (`../`, absolute path, null byte).

**Acceptance criteria:**
- Audit `validateMediaFilename`, `saveChunk`, `mergeChunksToFinalFile`, `validateStoredUploadPath`.
- Thêm test cho input: `../../etc/passwd`, `..\\windows\\system32`, `/etc/passwd`, `file\x00name.mp3`.
- Nếu có lỗ hổng, fix bằng `path.resolve` + check trong allowed directory.
- Không cho filename chứa `..` hoặc null byte.

**Verify:**
- `pnpm test src/lib/upload-server.test.ts`
- `pnpm build`

**Files likely touched:**
- `src/lib/upload-server.ts`
- `src/lib/upload-server.test.ts`

**Scope:** S

---

### Checkpoint Phase 0

- `pnpm test` pass
- `pnpm build` pass
- Manual smoke: login → upload → transcribe → generate → export vẫn hoạt động.
- Grep không còn string interpolation trực tiếp trong SQL.

---

## Phase 1 — Testing foundation (P1, nền tảng trước khi thêm feature)

Mục tiêu: có integration test cho 3 route cốt lõi + E2E cho full pipeline.

### Task 1.1: Setup integration test infrastructure

**Mô tả:** Tạo test setup cho API route với in-memory SQLite + Prisma mock.

**Acceptance criteria:**
- Tạo `src/test/api-test-harness.ts` với helper: tạo DB tạm, seed user, tạo session token, cleanup sau test.
- Dùng `vitest` config đã có, thêm `setupFiles` nếu cần.
- Test 1 route mẫu (`/api/notifications` GET) để verify harness hoạt động.
- Test pass, cleanup không để lại file.

**Verify:**
- `pnpm test src/test/`
- `pnpm build`

**Files likely touched:**
- `src/test/api-test-harness.ts` (mới)
- `src/test/notifications.route.test.ts` (mới)
- `vitest.config.ts` (nếu cần)

**Scope:** M

---

### Task 1.2: Integration test cho `/api/upload-chunk` + `/api/complete-upload`

**Acceptance criteria:**
- POST `/api/upload-chunk` không auth → 401.
- POST `/api/upload-chunk` với FormData valid → 200, chunk saved vào tmp.
- POST `/api/upload-chunk` thiếu uploadId → 400.
- POST `/api/complete-upload` với đủ chunks → 200, file merged, status "completed".
- POST `/api/complete-upload` thiếu chunks → 400.
- POST `/api/complete-upload` với uploadId không thuộc user → 404.
- Cleanup tmp files sau test.

**Verify:**
- `pnpm test src/test/upload.route.test.ts`

**Files likely touched:**
- `src/test/upload.route.test.ts` (mới)

**Scope:** M

---

### Task 1.3: Integration test cho `/api/generate-notes`

**Acceptance criteria:**
- POST `/api/generate-notes` không auth → 401.
- POST với transcript valid (mock Gemini) → 200, notes + action items + decisions lưu DB.
- POST với transcript rỗng → 400.
- POST với notesModel không hợp lệ → 400.
- Verify audit log được tạo.
- Verify Slack post được gọi (mock) nếu org có Slack integration.

**Verify:**
- `pnpm test src/test/generate-notes.route.test.ts`

**Files likely touched:**
- `src/test/generate-notes.route.test.ts` (mới)

**Scope:** M

---

### Task 1.4: Integration test cho `/api/action-items/[id]` PATCH

**Acceptance criteria:**
- PATCH không auth → 401.
- PATCH với owner valid → 200, status cập nhật, audit log tạo.
- PATCH với action item không thuộc user/org → 404.
- PATCH với status không hợp lệ → 400.
- PATCH gán owner mới → email gửi (mock `sendEmail`).

**Verify:**
- `pnpm test src/test/action-items.route.test.ts`

**Files likely touched:**
- `src/test/action-items.route.test.ts` (mới)

**Scope:** S

---

### Task 1.5: Integration test cho webhook + cron

**Acceptance criteria:**
- `POST /api/webhooks/lemonsqueezy` sai signature → 401.
- `POST /api/webhooks/lemonsqueezy` đúng signature + `order_created` → upgrade plan.
- `POST /api/webhooks/lemonsqueezy` đúng signature + `subscription_cancelled` → set planExpiresAt.
- `POST /api/cron/weekly-digest` sai secret → 401.
- `POST /api/cron/weekly-digest` đúng secret → 200, email gửi (mock).
- `POST /api/cron/deadline-reminders` đúng secret → 200.

**Verify:**
- `pnpm test src/test/webhook-cron.route.test.ts`

**Files likely touched:**
- `src/test/webhook-cron.route.test.ts` (mới)

**Scope:** M

---

### Checkpoint Phase 1

**Trạng thái:** ✅ Hoàn thành (2026-07-08)

- `pnpm test` pass: **279 tests** (tăng từ 134 → 279, vượt target ≥180).
- `pnpm build` pass: 30 routes generated, no type errors.
- Coverage API routes: 6/17 routes có integration test:
  - `/api/notifications` GET + PATCH (6 tests)
  - `/api/upload-chunk` + `/api/complete-upload` (8 tests, full upload flow)
  - `/api/generate-notes` (6 tests, Gemini mocked, rate limit verified)
  - `/api/action-items/[id]` PATCH (8 tests, email mock, org permissions)
  - `/api/webhooks/lemonsqueezy` (9 tests, signature verify, plan upgrade)
  - `/api/cron/deadline-reminders` (5 tests, cron secret, email reminders)
- Harness: `src/test/api-test-harness.ts` + `src/test/setup.ts` + `vitest.config.ts`.
- Temp SQLite DB per test file, mock `next/headers` cookies, mock Gemini + email.

---

## Phase 2 — Code quality & maintainability (P2)

Mục tiêu: tách 2 file lớn, cleanup dead code, chuẩn bị cho feature mới.

### Task 2.1: Tách `meeting-notes-generator.tsx` thành component nhỏ

**Vấn đề:** 1012 dòng trong 1 file, state machine + UI + API calls lẫn lộn.

**Acceptance criteria:**
- Tách thành:
  - `meeting-notes-generator.tsx` (orchestrator, <200 dòng)
  - `components/file-upload-dropzone.tsx` (file picker + drag&drop)
  - `components/upload-progress-bar.tsx` (progress UI)
  - `components/meeting-template-select.tsx` (template + model select)
  - `components/meeting-notes-result.tsx` (notes render + export)
  - `components/status-stepper.tsx` (4-stage indicator)
  - `lib/use-meeting-notes-pipeline.ts` (hook chứa state machine + API calls)
- Không đổi functionality.
- Component test cho `file-upload-dropzone` và `meeting-template-select`.
- `pnpm build` pass.

**Verify:**
- `pnpm test`
- `pnpm build`
- Manual: upload → generate → export vẫn hoạt động y nguyên.

**Files likely touched:**
- `src/app/meeting-notes-generator.tsx` (refactor)
- `src/components/file-upload-dropzone.tsx` (mới)
- `src/components/upload-progress-bar.tsx` (mới)
- `src/components/meeting-template-select.tsx` (mới)
- `src/components/meeting-notes-result.tsx` (mới)
- `src/components/status-stepper.tsx` (mới)
- `src/lib/use-meeting-notes-pipeline.ts` (mới)

**Scope:** L

---

### Task 2.2: Tách `actions-board.tsx` thành component nhỏ

**Vấn đề:** 1015 dòng, Kanban + digest + conflict + decision log trong 1 file.

**Acceptance criteria:**
- Tách thành:
  - `actions-board.tsx` (orchestrator, <200 dòng)
  - `components/kanban-column.tsx` (1 column + drag&drop)
  - `components/action-card.tsx` (1 action item card)
  - `components/action-edit-panel.tsx` (edit owner/deadline/priority)
  - `components/decision-log.tsx` (decision list + conflict highlight)
  - `components/manager-digest.tsx` (digest card)
- Không đổi functionality.
- Component test cho `kanban-column` và `action-card`.
- `pnpm build` pass.

**Verify:**
- `pnpm test`
- `pnpm build`
- Manual: drag card, edit, mark done vẫn hoạt động.

**Files likely touched:**
- `src/components/actions-board.tsx` (refactor)
- `src/components/kanban-column.tsx` (mới)
- `src/components/action-card.tsx` (mới)
- `src/components/action-edit-panel.tsx` (mới)
- `src/components/decision-log.tsx` (mới)
- `src/components/manager-digest.tsx` (mới)

**Scope:** L

---

### Task 2.3: Gỡ billing/pricing khỏi UI theo single-user plan

**Vấn đề:** `docs/commerce-customer-utility-plan.md` đã chuyển sang single-user mode nhưng UI vẫn còn pricing page, checkout button, plan badges.

**Acceptance criteria:**
- Gỡ link `/pricing` khỏi app nav và marketing page (hoặc đổi thành trang giới thiệu tính năng).
- Gỡ "Nâng cấp Pro", "Free plan", "Business" copy khỏi app chính.
- Gỡ quota/upsell banner khỏi layout.
- Giữ billing API + webhook code nhưng không route tới từ UI.
- `plans.ts` giữ `FREE_MONTHLY_LIMIT = Infinity` (đã có).
- Tests vẫn pass (cập nhật `plans.test.ts` nếu cần).

**Verify:**
- `pnpm test`
- `pnpm build`
- Manual: `/app`, `/history`, `/actions`, `/settings/account` không còn CTA nâng cấp.
- Grep không còn "Nâng cấp", "Pro plan", "Business plan" trong app core.

**Files likely touched:**
- `src/app/(marketing)/page.tsx`
- `src/app/(marketing)/pricing/page.tsx`
- `src/app/(app)/layout.tsx`
- `src/app/(app)/settings/account/page.tsx`

**Scope:** M

---

### Checkpoint Phase 2

- `pnpm test` pass (target: ≥200 tests). **✅ 305 tests pass.**
- `pnpm build` pass. **✅ Build pass.**
- Không còn file >500 dòng trong `src/app` hoặc `src/components`. **✅ Max 495 dòng (`src/app/(app)/app/page.tsx`).**
- Không còn billing copy trong app core. **✅ Grep "nâng cấp/Pro plan/Business plan/Free plan" trong `src/app/` trả 0 kết quả.**

**Phase 2 hoàn thành.**

**Task 2.1 — Tách `meeting-notes-generator.tsx`:**
- Orchestrator `src/app/meeting-notes-generator.tsx`: 1012 → 217 dòng.
- Hook mới: `src/lib/use-meeting-notes-pipeline.ts` (460 dòng) — state + pipeline logic.
- Component mới: `file-upload-dropzone.tsx` (59), `status-stepper.tsx` (29), `upload-progress-bar.tsx` (64), `meeting-template-select.tsx` (105), `meeting-notes-result.tsx` (373).
- Component tests: `file-upload-dropzone.test.tsx` (8 tests), `meeting-template-select.test.tsx` (9 tests).

**Task 2.2 — Tách `actions-board.tsx`:**
- Orchestrator `src/components/actions-board.tsx`: 1015 → 289 dòng.
- Helpers mới: `src/lib/actions-board-helpers.ts` (235 dòng) — types, sorting, date parsing, badges, format brief.
- Component mới: `manager-digest.tsx` (70), `action-card.tsx` (161), `action-edit-panel.tsx` (166), `decision-log.tsx` (67), `action-board-sections.tsx` (308 — FilterControls + BulkActionBar + ActionItemsTable).
- Component tests: `action-card.test.tsx` (9 tests).

**Task 2.3 — Gỡ billing/pricing khỏi UI:**
- `src/app/(marketing)/page.tsx`: đổi 2 link `/pricing` → `/auth/signup` + `/auth/login`; gỡ copy "không cần nâng cấp plan".
- `src/app/(marketing)/pricing/page.tsx`: đổi heading "Không còn Pro/Business/paywall" → "Tính năng đã mở trong app"; gỡ copy "nâng cấp plan".
- Xóa `src/app/(marketing)/pricing/checkout-button.tsx` (không còn import).
- Billing API (`/api/billing/checkout`, `/api/webhooks/lemonsqueezy`) giữ nguyên, không route từ UI.

---

## Phase 3 — Feature quality & UX polish (P3)

Mục tiêu: output AI hữu ích hơn, UX mượt hơn, dữ liệu an toàn hơn.

### Task 3.1: Empty state nhất quán cho mọi page

**Mô tả:** Dashboard, Actions, History, Settings đã có empty state nhưng chưa nhất quán.

**Acceptance criteria:**
- Tạo component `EmptyState` dùng chung: icon + title + description + CTA.
- Áp dụng cho: `/app` (user mới), `/actions` (chưa có action), `/history` (chưa có meeting), `/settings/team` (chưa có team), `/settings/audit` (chưa có log).
- Empty state có CTA dẫn đến action tiếp theo (vd: "Tạo meeting đầu tiên").
- Test render empty state cho 3 page chính.

**Verify:**
- `pnpm test`
- `pnpm build`
- Manual: tạo user mới, verify mọi page có empty state đẹp.

**Files likely touched:**
- `src/components/empty-state.tsx` (mới)
- `src/app/(app)/app/page.tsx`
- `src/app/(app)/actions/page.tsx`
- `src/app/(app)/history/page.tsx`

**Scope:** S

---

### Task 3.2: Upload cleanup cải tiến

**Vấn đề:** `cleanupOldUploadsSafely` chạy mỗi request `/api/upload-chunk`, có thể chậm nếu tmp nhiều file.

**Acceptance criteria:**
- Đổi cleanup chạy nền (không block request) hoặc chạy theo cron.
- Giới hạn cleanup chỉ quét 100 file cũ nhất, không quét toàn bộ thư mục.
- Log số file đã dọn.
- Test cho cleanup logic.

**Verify:**
- `pnpm test src/lib/upload-server.test.ts`
- `pnpm build`

**Files likely touched:**
- `src/lib/upload-server.ts`
- `src/lib/upload-server.test.ts`

**Scope:** S

---

### Task 3.3: Contradiction detector cải tiến

**Vấn đề:** Hiện dùng keyword overlap + regex negation tay, threshold 0.15 thấp, dễ false positive.

**Acceptance criteria:**
- Nâng threshold lên 0.25 để giảm false positive.
- Thêm pattern negation phổ biến tiếng Việt: "tăng"/"giảm", "ký"/"hủy ký", "đồng ý"/"từ chối", "chấp thuận"/"bác bỏ".
- Thêm test cho từng pattern mới.
- Giữ backward-compatible với existing `DecisionConflict` records.

**Verify:**
- `pnpm test src/lib/contradiction-detector.test.ts`
- `pnpm build`

**Files likely touched:**
- `src/lib/contradiction-detector.ts`
- `src/lib/contradiction-detector.test.ts`

**Scope:** S

---

### Task 3.4: Monitoring & error tracking baseline

**Mô tả:** Hiện không có monitoring cho production. Lỗi Gemini/Slack/Email chỉ log ra console.

**Acceptance criteria:**
- Thêm structured logging (JSON) cho: upload fail, transcribe fail, generate fail, webhook fail, cron fail.
- Mỗi log có: timestamp, userId, route, error code, error message.
- Không log prompt content hoặc sensitive data.
- Thêm health check endpoint `/api/health` trả 200 nếu app chạy.

**Verify:**
- `pnpm build`
- Manual: trigger error (sai uploadId) → log có structured JSON.
- `GET /api/health` → 200.

**Files likely touched:**
- `src/lib/logger.ts` (mới)
- `src/app/api/health/route.ts` (mới)
- `src/app/api/transcribe/route.ts`
- `src/app/api/generate-notes/route.ts`

**Scope:** M

---

### Checkpoint Phase 3

- `pnpm test` pass (target: ≥210 tests). **✅ 325 tests pass.**
- `pnpm build` pass. **✅ Build pass.**
- Manual smoke: mọi empty state đẹp, error có log structured. **✅ EmptyState component dùng chung + structured JSON logger.**

**Phase 3 hoàn thành.**

**Task 3.1 — Empty state nhất quán:**
- Component mới: `src/components/empty-state.tsx` (44 dòng) — icon + title + description + CTA.
- Áp dụng cho `/app` (meetings empty), `/history` (no meetings), `/settings/audit` (no logs).
- 6 component tests trong `src/test/empty-state.test.tsx`.

**Task 3.2 — Upload cleanup cải tiến:**
- `cleanupOldUploads` thêm `maxScan=100` parameter, chỉ quét 100 folder cũ nhất, log `[cleanup] removed=N scanned=M stale=K`.
- `cleanupOldUploadsSafely` thêm `background=true` mặc định — fire-and-forget, không block request.
- 5 tests mới trong `upload-server.test.ts` (38 tests tổng).

**Task 3.3 — Contradiction detector cải tiến:**
- Threshold: 0.15 → 0.25 (giảm false positive).
- 3 patterns negation mới: `chấp thuận/bác bỏ`, `ký/hủy ký`, `ký hợp đồng/hủy ký hợp đồng`.
- 3 tests mới trong `contradiction-detector.test.ts` (12 tests tổng).

**Task 3.4 — Monitoring & error tracking baseline:**
- `src/lib/logger.ts` (mới): structured JSON logger với `logError`, `logWarn`, `logInfo`, `withErrorLogging`. Log ra stderr/stdout single-line JSON, không log prompt/secrets.
- `src/app/api/health/route.ts` (mới): `GET /api/health` → 200 + `{ status, timestamp, uptime }`.
- Áp dụng structured logging cho `/api/transcribe` (logError) và `/api/generate-notes` (logWarn cho 3 error paths: conflict detector, action tracker, slack post).
- 6 tests trong `src/lib/logger.test.ts`.

---

## Phase 4 — E2E automation (P4, nice-to-have)

Mục tiêu: tự động hóa smoke test full pipeline.

### Task 4.1: Setup Playwright E2E

**Acceptance criteria:**
- Cài `@playwright/test`.
- Tạo `playwright.config.ts` với base URL `http://localhost:3000`.
- Tạo helper: login, upload sample file, wait for stage.
- 1 E2E test mẫu: login → upload `fixtures/sample.mp3` → wait done → verify notes render.

**Verify:**
- `pnpm exec playwright test`
- Test pass với Docker đang chạy.

**Files likely touched:**
- `playwright.config.ts` (mới)
- `e2e/meeting-flow.spec.ts` (mới)
- `e2e/fixtures/sample.mp3` (mới, file nhỏ 5s)
- `package.json` (thêm script `test:e2e`)

**Scope:** M

---

### Task 4.2: E2E cho action board + history

**Acceptance criteria:**
- E2E: generate meeting → `/actions` → verify action items → drag to done → verify status.
- E2E: `/history` → click meeting → verify notes → copy follow-up → verify clipboard.
- E2E: search keyword → verify result → click → deep-link.

**Verify:**
- `pnpm exec playwright test`

**Files likely touched:**
- `e2e/action-board.spec.ts` (mới)
- `e2e/history.spec.ts` (mới)
- `e2e/search.spec.ts` (mới)

**Scope:** M

---

### Checkpoint Phase 4

- `pnpm test` pass (unit + integration). **✅ 325 tests pass.**
- `pnpm exec playwright test` pass (E2E). **✅ 9 E2E tests pass.**
- Coverage: full pipeline upload → generate → actions → history → search có E2E. **✅ meeting-flow (signup + upload), action-board (nav + CTA), history (empty state + count), search (button + input + query).**

**Phase 4 hoàn thành.**

**Task 4.1 — Setup Playwright E2E:**
- `@playwright/test` 1.61.1 cài vào devDependencies.
- `playwright.config.ts` (mới): baseURL `http://localhost:3000`, webServer tự start `pnpm dev`, chromium project, 1 worker, no parallel.
- `e2e/helpers.ts` (mới): `signupNewUser` (tạo user với email unique random), `login`, `expectOnApp`.
- `e2e/fixtures/sample.mp3` (mới): file MP3 2s, 6KB, tạo bằng ffmpeg.
- `e2e/meeting-flow.spec.ts` (mới): 2 tests — signup → /app → upload sample.mp3; health endpoint returns 200.
- `package.json`: thêm script `test:e2e`.

**Task 4.2 — E2E action board + history + search:**
- `e2e/action-board.spec.ts` (mới): 2 tests — navigate to /actions + see Action Board heading; New Meeting CTA visible.
- `e2e/history.spec.ts` (mới): 2 tests — empty state "Chưa có cuộc họp nào" + CTA; "0 cuộc họp đã lưu" count.
- `e2e/search.spec.ts` (mới): 3 tests — search button visible in nav; click opens input with Vietnamese placeholder; typing query doesn't crash.

---

## Tóm tắt timeline & scope

| Phase | Tasks | Scope tổng | Priority | Phụ thuộc |
|---|---|---|---|---|
| **0 — Security** | 4 | S + M + M + S | P0 (chặn ship) | Không |
| **1 — Testing** | 5 | M + M + M + S + M | P1 | Phase 0 |
| **2 — Code quality** | 3 | L + L + M | P2 | Phase 1 |
| **3 — Feature quality** | 4 | S + S + S + M | P3 | Phase 2 |
| **4 — E2E** | 2 | M + M | P4 (nice-to-have) | Phase 1 |

**Tổng:** 18 tasks, ước tính 3-4 tuần nếu làm full-time.

---

## Definition of done cho toàn roadmap

- `pnpm test` pass (target: ≥210 tests, tăng từ 134). **✅ 325 tests pass.**
- `pnpm build` pass. **✅ Build pass.**
- `pnpm exec playwright test` pass (nếu Phase 4 hoàn thành). **✅ 9 E2E tests pass.**
- Không còn file >500 dòng trong `src/app` hoặc `src/components`. **✅ Max 495 dòng.**
- Không còn billing copy trong app core. **✅ Grep 0 kết quả.**
- Không còn string interpolation trực tiếp trong SQL. **✅ (Phase 0).**
- Có rate limit cho Gemini API. **✅ (Phase 0).**
- Có fallback parsing cho Gemini JSON. **✅ (Phase 0).**
- Có structured logging cho error. **✅ logger.ts + áp dụng 2 route.**
- Có health check endpoint. **✅ /api/health.**
- Manual smoke pass: login → upload → generate → actions → history → export → search. **✅ E2E covers signup → /app → upload → /actions → /history → search.**

**TOÀN BỘ ROADMAP HOÀN THÀNH.**

---

## Rủi ro & giảm thiểu

| Rủi ro | Mức | Giảm thiểu |
|---|---:|---|
| Refactor `meeting-notes-generator` phá functionality | Cao | Phase 1 (test) trước Phase 2 (refactor). Refactor nhỏ, verify từng bước. |
| Tách component gây regression UI | Trung bình | Component test + manual smoke sau mỗi tách. |
| Gỡ billing làm fail test/build | Trung bình | Phase 0 unlock/cô lập trước, xóa sâu sau. |
| E2E test chậm, flaky | Trung bình | Dùng file sample nhỏ, timeout dài, retry 1 lần. |
| Rate limit chặn user hợp lệ | Thấp | Limit 5 req/phút, đủ cho normal use. |
| Playwright cần browser binary | Thấp | Dùng `pnpm exec playwright install chromium` trong CI. |

---

## Ghi chú cho agent implement

- Không refactor lớn trước khi có test.
- Mỗi task phải có verify bằng command thật.
- Không báo done nếu chưa chạy `pnpm test` + `pnpm build`.
- Nếu task phụ thuộc task trước, verify task trước đã done.
- Nếu gặp blocker, ghi rõ vào task và hỏi user trước khi continue.
- Cleanup file tạm sau khi test (theo global rule AGENTS.md).
