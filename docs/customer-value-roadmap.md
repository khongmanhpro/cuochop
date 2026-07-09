# Roadmap giá trị khách hàng — cuochop

| Trường | Giá trị |
|---|---|
| **Ngày tạo** | 2026-07-09 |
| **Cập nhật lần cuối** | 2026-07-09 |
| **Trạng thái roadmap** | ✅ Closed — full customer roadmap S0–D (human OK) |
| **Định hướng sản phẩm** | Single-user personal utility (không monetization-first) |
| **Nguồn** | Feedback góc khách hàng + kế hoạch triển khai A→B→C |
| **Repo** | `/Volumes/cdoe/code/cuochop` |
| **Liên quan** | `docs/fix-roadmap.md` (kỹ thuật/security), `docs/commerce-customer-utility-plan.md` |

---

## 1. Cách đọc & theo dõi tiến độ

### 1.1. Chú thích trạng thái task

| Status | Ý nghĩa |
|---|---|
| `⬜ backlog` | Chưa làm |
| `🔄 in_progress` | Đang làm |
| `👀 review` | Code xong, chờ bạn smoke / feedback |
| `✅ done` | Pass verify + bạn OK (hoặc AC đã đạt) |
| `⏸️ blocked` | Kẹt phụ thuộc / quyết định |
| `🚫 cancelled` | Cố ý bỏ, ghi lý do |

### 1.2. Quy ước “Done”

Mỗi task chỉ `✅ done` khi:

1. Acceptance criteria đạt  
2. `pnpm test` pass  
3. `pnpm build` pass  
4. Smoke manual liên quan pass  
5. Không regress luồng: upload → notes → action board  

### 1.3. Cách cập nhật tiến độ (agent / dev)

Sau mỗi task, cập nhật:

1. Bảng **Tổng quan tiến độ** (% + số task)  
2. Status task trong bảng sprint  
3. Dòng **Changelog** cuối file  
4. (Tuỳ chọn) ghi chú ngắn trong **Nhật ký sprint**

### 1.4. North-star khách hàng

> Upload/ghi âm cuộc họp → notes đáng tin → việc có owner/deadline → theo dõi đến xong → tra lại quyết định/lịch sử nhanh.

**3 must-have đã chốt**

1. **Meeting sống lại** — mở / sửa / xóa / đổi tên cuộc họp  
2. **Action đáng tin** — rà soát AI + tạo tay + deadline thật  
3. **Hàng ngày & tiếng Việt** — việc của tôi, mobile, copy brief, UI VI  

---

## 2. Tổng quan tiến độ

> Cập nhật số liệu mỗi khi task đổi status.

| Epic | Mục tiêu khách | Tasks | Done | In progress | % |
|---|---|---:|---:|---:|---:|
| **S0** Baseline | An toàn bắt đầu làm | 4 | 4 | 0 | 100% |
| **A** Meeting detail | Mở lại & quản lý họp | 8 | 8 | 0 | 100% |
| **B** Action trust | Board sạch, việc tay | 7 | 7 | 0 | 100% |
| **C** Daily / mobile / VI | Dùng mỗi ngày | 7 | 7 | 0 | 100% |
| **D** Retention | Giữ chân 3 tháng | 6 | 6 | 0 | 100% |
| **Tổng (S0+A+B+C)** | Core must-have | **26** | **26** | **0** | **100%** |
| **Tổng + D** | Full customer roadmap | **32** | **32** | **0** | **100%** |

### Progress bar (core A–C + S0)

```text
[████████████████████] 100%  ·  26/26 tasks done
```

### Gate giữa sprint (pass mới nhảy epic)

| Gate | Điều kiện pass (cảm nhận khách) | Status |
|---|---|---|
| **G0** | Dev/test/build baseline OK | ✅ |
| **G1** | Mở lại 1 meeting cũ, đổi tên, xóa bản test được | ✅ |
| **G1b** | Sửa được nội dung notes và reload vẫn còn | ✅ |
| **G2** | Bỏ action ảo AI + tạo việc tay + deadline đúng dashboard | ✅ |
| **G3** | Check việc trên mobile + copy brief + UI VI ổn | ✅ |

---

## 3. Nguyên tắc thực thi

1. **Outcome trước code** — mỗi PR: khách làm thêm được gì?  
2. **A → B → C**, không ôm Epic D sớm  
3. **Small batch** — 1 task (hoặc 1 vertical slice) → verify → review  
4. **Không đụng billing / Pro plan** trong roadmap này  
5. **Schema cẩn thận** — tránh migration trừ khi deadline/DateTime chặn AC  
6. **Tái sử dụng** dashboard, board, search, pipeline hiện có  

**Ngoài scope (cố ý không làm trong core):**

- Zoom/Meet/Drive import, ghi âm in-app  
- Zalo/Telegram bot  
- Multi-tenant scale (S3, Postgres)  
- Bật lại paywall / LemonSqueezy UX  
- Mobile native app  

---

## 4. Sprint 0 — Baseline

**Mục tiêu:** Biết repo xanh, có backlog theo dõi, chốt bắt đầu Epic A.  
**Ước lượng:** 0.5–1 ngày  
**Gate:** G0 ✅  
**Sprint status:** ✅ done (2026-07-09)

| ID | Task | Size | Status | Owner | Verify |
|---|---|---|---|---|---|
| S0.1 | Chạy `pnpm test` + `pnpm build`, ghi kết quả baseline | S | ✅ done | agent | test + build log |
| S0.2 | Smoke (HTTP + Playwright e2e non-full-AI) | S | ✅ done | agent | e2e 9/9 + health |
| S0.3 | Xác nhận roadmap này là source-of-truth tiến độ | S | ✅ done | human | user start Sprint 0 |
| S0.4 | Chốt thứ tự: A → B → C | S | ✅ done | human | giữ A→B→C |

### Baseline results (S0.1) — 2026-07-09

| Check | Result |
|---|---|
| `pnpm test` | ✅ **325** tests, **34** files, ~3.2s |
| `pnpm build` | ✅ Next.js 16.2.6, 30 routes, postbuild standalone OK |
| Env | `.env.local` present (`GEMINI_API_KEY`, `DATABASE_URL`, `SESSION_SECRET`) |
| DB | `data/cuochop.db` present |

### Smoke results (S0.2) — 2026-07-09

**HTTP**

| Route | Result |
|---|---|
| `GET /api/health` | 200 `{"status":"ok"}` |
| `GET /` | 200 |
| `GET /auth/login` | 200 |
| `GET /auth/signup` | 200 |
| `GET /app` (unauth) | 307 redirect (auth guard OK) |
| `GET /pricing` | 200 |

**Playwright** (`E2E_BASE_URL=http://localhost:3000`, sau `playwright install chromium`)

| Spec | Result |
|---|---|
| `e2e/action-board.spec.ts` (2) | ✅ |
| `e2e/history.spec.ts` (2) | ✅ |
| `e2e/search.spec.ts` (3) | ✅ |
| `e2e/meeting-flow.spec.ts` (2) | ✅ signup → /app → upload sample.mp3 + health |
| **Tổng** | **9/9 passed** |

**Checklist map (S0.2)**

- [x] Đăng ký / đăng nhập — e2e signup + login helpers  
- [x] Vào `/app` dashboard — meeting-flow + search e2e  
- [x] Upload file ngắn (UI) — sample.mp3 attached, page không crash  
- [ ] Upload → **full** transcribe + generate notes (Gemini) — **ngoài e2e by design**; human optional  
- [ ] Export markdown / copy follow-up sau generate — **cần meeting có notes** (sau Epic A hoặc human)  
- [x] Mở `/actions` empty/board — action-board e2e  
- [ ] Sửa status / owner 1 action — cần data; covered by unit/integration tests sẵn  
- [x] Mở `/history` empty state + count — history e2e  
- [x] Search UI (Cmd+K path) — search e2e  
- [ ] `/settings/account` + Logout — **chưa e2e**; low risk (layout getSession)  

**Ghi chú:** Full AI pipeline (Gemini cost) không block G0. Integration tests đã cover generate-notes / upload / action-items routes.

### Quyết định (S0.3 / S0.4)

- Source-of-truth tiến độ: `docs/customer-value-roadmap.md`  
- Thứ tự thực thi: **Epic A → B → C** (D sau G3)

---

## 5. Epic A — Meeting sống lại

**Mục tiêu khách:** “Tôi mở lại cuộc họp, đọc notes, đổi tên, xóa bản rác.”  
**Ước lượng:** 2–3 ngày (A1–A5) + 2 ngày (A6 edit)  
**Gate:** G1 (sau A1–A5+A7), G1b (sau A6)  

| ID | Task | Size | Status | Files gợi ý | AC tóm tắt |
|---|---|---|---|---|---|
| A1 | Route `/history/[id]` + ownership | M | ✅ done | `history/[id]/page.tsx`, `lib/meeting-access.ts` | User chỉ xem meeting của mình/org; 404 nếu không |
| A2 | UI chi tiết: summary, decisions, actions, transcript | M | ✅ done | `history/[id]/page.tsx` | Đọc full notes trong app, không chỉ card |
| A3 | Deep link từ History + Dashboard + search note | S | ✅ done | `history/page.tsx`, `app/page.tsx`, `global-search.tsx` | Click meeting → detail |
| A4 | Đổi tên meeting (`title`) | S | ✅ done | `history/actions.ts`, `meeting-detail-actions.tsx` | Rename persist sau reload |
| A5 | Xóa meeting + confirm | M | ✅ done | same | Xóa cascade action/decision; redirect history |
| A6 | Sửa notes tối thiểu + Save | L | ✅ done | `meeting-notes-edit.ts`, edit form, actions | Summary/decisions/risks/Q + sync Decision |
| A7 | Tests ownership / rename / delete / edit | M | ✅ done | `meeting-access*`, `meeting-notes-edit*` | access + rename + delete + edit |
| A8 | Gate G1+G1b sign-off với human | S | ✅ done | — | Human OK (2026-07-09) |

### AC chi tiết Epic A

**A1–A2**

- URL `/history/[id]` render title, ngày, audio name  
- Hiển thị executive summary, decisions, action items, transcript (có thể collapse)  
- User khác / id giả → 404  

**A3**

- Card ở `/history` link tới detail  
- “Cuộc họp gần đây” trên `/app` link tới detail  

**A4–A5**

- Form/input đổi title → save  
- Nút xóa + confirm; sau xóa không còn list history  

**A6**

- Ít nhất edit được `executiveSummary` (và text action/decision nếu làm được trong cùng slice)  
- Validate JSON; không làm vỡ export/search  

**A7**

- Integration/unit tests cho authz + delete cascade  

---

## 6. Epic B — Action đáng tin

**Mục tiêu khách:** “AI không đổ rác vào board; tôi tạo việc tay; deadline đúng.”  
**Ước lượng:** 3–4 ngày  
**Gate:** G2  
**Phụ thuộc:** Nên xong G1 (A1–A5) trước; A6 có thể song song một phần  

| ID | Task | Size | Status | Files gợi ý | AC tóm tắt |
|---|---|---|---|---|---|
| B1 | Hiểu điểm persist action trong `generate-notes` | S | ✅ done | generate-notes returns IDs | Persist ngay sau save meeting |
| B2 | UI rà soát action sau generate (Discard) | L | ✅ done | `action-triage-panel.tsx` | Bỏ việc ảo trước khi tin board |
| B3 | API DELETE discard | M | ✅ done | `api/action-items/[id]` DELETE | Discard → xóa DB |
| B4 | Tạo action thủ công (+ Việc mới) | M | ✅ done | POST `/api/action-items`, create form | Manual meeting "Việc thủ công" |
| B5 | Deadline date picker + chuẩn `YYYY-MM-DD` | M | ✅ done | `normalizeDeadlineInput` | Date input + VN parse |
| B6 | Edit được nội dung `task` | S | ✅ done | edit panel + PATCH task | Sửa text việc, save OK |
| B7 | Tests + Gate G2 | M | ✅ done | docker 349 pass | Human G2 OK |

### AC chi tiết Epic B

- Sau generate: thấy list action AI, discard ≥1 → board không còn  
- Nút “+ Việc mới”: task + deadline + priority  
- Deadline chọn lịch (không chỉ free text) với data mới  
- Data cũ dạng “15/6” vẫn parse được trên dashboard (backward compatible)  
- Có thể sửa task text trên board  

---

## 7. Epic C — Hàng ngày / mobile / Việt hóa

**Mục tiêu khách:** “Mở app là việc của tôi; phone dùng được; app nói tiếng Việt.”  
**Ước lượng:** 2–3 ngày  
**Gate:** G3  
**Phụ thuộc:** G2 khuyến nghị; C1/C4 có thể làm sớm  

| ID | Task | Size | Status | Files gợi ý | AC tóm tắt |
|---|---|---|---|---|---|
| C1 | Nút Copy follow-up brief trên dashboard | S | ✅ done | `app/page.tsx` | Copy brief 1 chạm |
| C2 | Filter mặc định “Việc của tôi” | S | ✅ done | actions-board toggle | Toggle Tất cả / Của tôi |
| C3 | Mobile list view (không kẹt table) | M | ✅ done | action-board-sections | Card list + Done/Sửa |
| C4 | Việt hóa generator + labels board | M | ✅ done | generator, labels, dropzone | Happy path VI |
| C5 | Empty states có CTA | S | ✅ done | EmptyState board | CTA về dashboard |
| C6 | Tests cập nhật cho VI labels | M | ✅ done | unit tests | 349 pass |
| C7 | Gate G3 sign-off | S | ✅ done | — | Human G3 OK |

### AC chi tiết Epic C

- Dashboard brief có nút Copy (toast/“Đã copy”)  
- Board mặc định hợp lý cho cá nhân; filter rõ  
- Viewport ~390px: xem + đổi status việc được  
- Generator, stepper, button chính: tiếng Việt  
- Empty history/actions: CTA về tạo meeting / thêm việc  

---

## 8. Epic D — Retention (backlog sau core)

**Chỉ mở khi G3 = ✅.** Không tính vào % core trừ khi human promote.

| ID | Task | Size | Status | Ưu tiên | Ghi chú |
|---|---|---|---|---|---|
| D1 | Re-generate notes từ transcript có sẵn | M | ✅ done | P1 | `POST /api/meetings/[id]/regenerate` |
| D2 | Đặt tên lại speaker | M | ✅ done | P1 | Speaker rename form on detail |
| D3 | Onboarding + file demo | M | ✅ done | P2 | Banner + `/demo/sample.mp3` |
| D4 | Account: đổi tên / đổi mật khẩu | M | ✅ done | P2 | profile-forms + actions |
| D5 | Privacy + backup rõ | S | ✅ done | P1 | Account privacy + export CTAs |
| D6 | Tag meeting + filter history | M | ✅ done | P2 | tags in notesJson + history filter |

---

## 9. Timeline gợi ý (1 dev)

```text
Tuần 0 (0.5d)   ████           Sprint 0 — Baseline          → G0
Tuần 1          ████████████   Epic A slice A1–A5+A7        → G1
Tuần 1–2        ████████       Epic A A6 edit               → G1b
Tuần 2          ████████████   Epic B                       → G2
Tuần 3          ██████████     Epic C                       → G3
Tuần 4+         ░░░░░░░░░░     Epic D (tuỳ chọn)
```

**Mốc demo với bạn**

| Mốc | Ngày mục tiêu (điền khi start) | Demo |
|---|---|---|
| M1 | _TBD_ | Mở/xóa/đổi tên meeting |
| M2 | _TBD_ | Rà soát action + việc tay |
| M3 | _TBD_ | Mobile + VI + copy brief |

---

## 10. Bảng theo dõi nhanh (in ra / pin)

Copy bảng này mỗi buổi sync:

| ID | Status | Note 1 dòng |
|---|---|---|
| S0.1 | ✅ | 325 tests + build pass |
| S0.2 | ✅ | e2e 9/9 + health; full Gemini optional |
| S0.3 | ✅ | roadmap = SoT |
| S0.4 | ✅ | A→B→C |
| A1 | ✅ | `/history/[id]` ownership |
| A2 | ✅ | full notes UI |
| A3 | ✅ | deep links + search |
| A4 | ✅ | rename server action |
| A5 | ✅ | delete + confirm + cascade |
| A6 | ✅ | edit notes + Decision sync |
| A7 | ✅ | docker **341**/341 |
| A8 | 👀 | chờ human G1+G1b smoke |
| B1 | ✅ | post-save model |
| B2 | ✅ | triage panel |
| B3 | ✅ | DELETE API |
| B4 | ✅ | + Việc mới |
| B5 | ✅ | date picker |
| B6 | ✅ | edit task |
| B7 | ✅ | G2 pass |
| C1 | ✅ | copy brief dashboard |
| C2 | ✅ | Việc của tôi |
| C3 | ✅ | mobile cards |
| C4 | ✅ | VI labels |
| C5 | ✅ | empty CTA |
| C6 | ✅ | tests 349 |
| C7 | ✅ | G3 pass |

---

## 11. Nhật ký sprint

### Sprint 0

- **Start:** 2026-07-09  
- **End:** 2026-07-09  
- **Notes:** Baseline xanh. Cài Playwright Chromium lần đầu. E2E non-AI 9/9. G0 pass. Next = A1 meeting detail route.  


### Sprint 1 (Epic A)

- **Start:** 2026-07-09  
- **End:** _code complete — human G1+G1b review_  
- **Notes:** A1–A7 done. A6: edit mainTopic/summary/decisions/risks/questions + markdown regen + Decision Log sync. Docker test 341 pass + rebuild. A8 chờ human.  



### Sprint 2 (Epic B)

- **Start:** 2026-07-09  
- **End:** 2026-07-09 (G2 human OK)  
- **Notes:** Triage, create/delete, deadline date, edit task. Docker 349/349.  

### Sprint 3 (Epic C)

- **Start:** 2026-07-09  
- **End:** 2026-07-09 (G3 human OK)  
- **Notes:** Copy brief, Việc của tôi, mobile cards, VI happy path, empty CTA. Core must-have closed.  



---

## 12. Changelog roadmap

| Ngày | Thay đổi |
|---|---|
| 2026-07-09 | Tạo roadmap customer-value: S0 + Epic A/B/C/D, gates, % tracker, AC |
| 2026-07-09 | **Sprint 0 done:** S0.1–S0.4 ✅, G0 ✅, core 4/26 (15%). Baseline 325 tests + build. E2E 9/9. Next: Epic A / A1. |
| 2026-07-09 | **Epic A G1 slice:** A1–A5+A7 ✅. `/history/[id]` view/rename/delete. Docker test 334/334 + rebuild. A6 backlog. G1 👀 human. Core 10/26 (38%). |
| 2026-07-09 | **Epic A A6/G1b:** edit notes form + Decision sync. Docker **341**/341 + rebuild. A8 👀. Core 11/26 (42%). |
| 2026-07-09 | **G1 pass (human OK).** Epic B: triage, create/delete actions, deadline date, edit task. Docker **349**/349. Core **19/26 (73%)**. G2 👀. |
| 2026-07-09 | **G2 pass (human OK).** Epic C: copy brief, Việc của tôi, mobile cards, VI UI. Core **26/26 (100%)**. G3 👀. |
| 2026-07-09 | **G3 pass (human OK).** Core roadmap S0+A+B+C closed. Epic D optional (retention). |
| 2026-07-09 | **Epic D done:** regenerate, speakers, onboarding, account profile/password, privacy/backup, tags. Docker **356** tests + rebuild. Full **32/32**. |
| 2026-07-09 | **Epic D human OK.** Roadmap customer-value **closed** (S0–D). |
| | |

---

## 13. Lệnh verify chuẩn (mỗi task)

```bash
cd /Volumes/cdoe/code/cuochop
pnpm test
pnpm build
# khi có e2e liên quan:
# pnpm test:e2e
```

Smoke tối thiểu sau task UI:

```text
login → /app → liên quan task vừa làm → /actions hoặc /history → không lỗi console nghiêm trọng
```

---

## 14. Next action

1. ~~S0–D~~ ✅ **đóng** (code + human OK)  
2. Dùng app hằng ngày trên Docker  
3. Pain mới → mô tả để mở backlog tiếp  

### Docker (vận hành)

```bash
pnpm test:docker
pnpm docker:rebuild   # sau mỗi đợt code
docker compose logs -f app
```
