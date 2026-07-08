# Kế hoạch single-user feature-first cho cuochop

**Ngày:** 2026-07-07  
**Trạng thái:** Draft định hướng mới — bỏ Pro/Business, bỏ payment-first  
**Repo:** `/Volumes/cdoe/code/cuochop`

## 1. Quyết định sản phẩm mới

Dự án hiện tại chỉ phục vụ **một người dùng chính**. Vì vậy không xây theo hướng SaaS thương mại hóa nhiều gói nữa.

### Bỏ khỏi ưu tiên

- Không cần bản **Pro**.
- Không cần bản **Business**.
- Không cần nâng cấp plan.
- Không cần thanh toán/subscription/LemonSqueezy trong core flow.
- Không cần paywall, quota miễn phí, banner “nâng cấp”.
- Không cần team sales/contact sales.

### Giữ làm trọng tâm

- Tính năng mạnh, dùng hằng ngày được.
- Tốc độ xử lý nhanh.
- Lưu trữ/tìm kiếm/lọc tốt.
- Action items rõ ràng, không bị quên việc.
- Decision log có ích khi xem lại.
- Xuất dữ liệu, backup, copy/share tiện.
- Giao diện ít bước, không có friction thương mại.

## 2. Định nghĩa lại “chức năng thương mại”

Trong hướng mới, “thương mại” không phải bán gói. Nó là **bộ công cụ giúp một người dùng xử lý công việc sau cuộc họp hiệu quả hơn**, giống một trợ lý vận hành cá nhân.

North-star:

> Upload/ghi âm cuộc họp → tự động tạo notes → tách việc cần làm → theo dõi đến khi xong → tìm lại quyết định/lịch sử nhanh.

Nếu phải chọn giữa “thanh toán” và “tính năng”, chọn **tính năng**.

## 3. Hiện trạng repo đã thấy

- Stack: Next.js 16 App Router, React 19, TypeScript, Prisma 7, SQLite, Vitest, Tailwind 4.
- Scripts:
  - Dev: `pnpm dev`
  - Test: `pnpm test`
  - Build: `pnpm build`
  - Lint: `pnpm lint`
- Sản phẩm hiện tại: app ghi chú cuộc họp tiếng Việt: upload audio/video, transcription bằng Gemini, generate meeting notes, action tracking, decision log, search, export, auth, team workspace, Slack, email reminders.
- Code đang còn nhiều lớp thương mại hóa cũ:
  - `src/lib/plans.ts`: `free | pro | business`, quota, feature gates.
  - `src/lib/billing.ts`: LemonSqueezy checkout helpers.
  - `src/app/(marketing)/pricing/page.tsx`: pricing page.
  - `src/app/api/billing/checkout/route.ts`: checkout API.
  - `src/app/api/webhooks/lemonsqueezy/route.ts`: billing webhook.
  - UI hiện có nhiều copy: “Nâng cấp Pro”, “Tính năng Pro”, “Free · còn lại”.

## 4. Product principles mới

1. **Default unlocked**  
   Tính năng cốt lõi phải mở cho người dùng chính. Không gate History, DOCX, Action Board.

2. **Single-user trước, team sau nếu thật sự cần**  
   Team/workspace không phải P0. Nếu giữ, chỉ giữ như tùy chọn nội bộ, không phải Business plan.

3. **Không billing trong happy path**  
   Không để người dùng đang làm việc gặp pricing, checkout, upgrade banner.

4. **Workflow ngắn nhất có thể**  
   Mỗi cuộc họp sau khi xử lý phải dẫn ngay đến: summary, actions, decisions, follow-up.

5. **Dữ liệu của mình phải dễ lấy ra**  
   Export, backup, search, filter quan trọng hơn pricing.

## 5. Roadmap mới

## Phase 0 — Dọn lớp monetization gây cản trở

Mục tiêu: biến app thành bản full-feature single-user, không còn cảm giác bị paywall.

### Task 0.1: Unlock plan logic

**Mô tả:** Đổi logic plan để người dùng hiện tại có toàn quyền dùng tính năng core.

**Acceptance criteria:**
- `canGenerate` không chặn bởi quota free.
- `canExportDocx` trả true cho user đăng nhập.
- `canViewHistory` trả true cho user đăng nhập.
- `canManageTeam` hoặc bỏ khỏi nav P0, hoặc chỉ dùng role nội bộ, không phụ thuộc Business.
- Tests plan được cập nhật theo single-user mode.

**Verify:**
- `pnpm test src/lib/plans.test.ts`
- Manual: user đăng nhập vào được History, Actions, export DOCX không bị nâng cấp.

**Files likely touched:**
- `src/lib/plans.ts`
- `src/lib/plans.test.ts`
- Các nơi import `FREE_MONTHLY_LIMIT` nếu còn hiển thị quota.

**Scope:** S

### Task 0.2: Gỡ upgrade/paywall khỏi app UI

**Mô tả:** Xóa hoặc thay copy nâng cấp bằng copy tính năng.

**Acceptance criteria:**
- Không còn “Nâng cấp Pro”, “Tính năng Pro”, “Free plan”, “Business” trong app chính.
- Layout không hiển thị quota/upsell banner.
- History không bị gate.
- Navigation tập trung: New Meeting, Dashboard/Actions, History, Account.

**Verify:**
- `pnpm lint`
- Manual: `/app`, `/history`, `/actions`, `/settings/account` không còn CTA nâng cấp.
- Search code không còn copy upgrade trong app core.

**Files likely touched:**
- `src/app/(app)/layout.tsx`
- `src/app/(app)/history/page.tsx`
- `src/app/(app)/actions/page.tsx`
- `src/app/(app)/settings/account/page.tsx`

**Scope:** M

### Task 0.3: Tắt hoặc cô lập billing routes

**Mô tả:** Vì không thanh toán, billing không nên nằm trong flow chính. Có thể giữ code cũ nhưng không route tới, hoặc remove hẳn nếu muốn sạch.

**Acceptance criteria:**
- Pricing/checkout không được link từ app chính.
- Billing API không bị gọi từ UI.
- Nếu truy cập trực tiếp `/pricing`, hoặc redirect về app, hoặc đổi thành trang giới thiệu tính năng nội bộ.
- Không crash nếu env LemonSqueezy thiếu.

**Verify:**
- `pnpm build`
- Manual: không có đường đi tự nhiên tới checkout.

**Files likely touched:**
- `src/app/(marketing)/pricing/page.tsx`
- `src/app/(marketing)/page.tsx`
- `src/app/api/billing/checkout/route.ts` nếu quyết định disable server-side.
- `src/lib/billing.ts` nếu quyết định giữ nhưng không dùng.

**Scope:** S/M

### Checkpoint Phase 0

- `pnpm test`
- `pnpm build`
- Manual smoke: login → app → generate → history → actions → export.
- Không còn popup/banner/CTA nâng cấp trong happy path.

## Phase 1 — Dashboard việc cần làm mạnh hơn

Mục tiêu: sau mỗi meeting, người dùng biết ngay việc gì quan trọng và không bỏ sót.

### Task 1.1: Personal command dashboard

**Mô tả:** Tạo hoặc nâng cấp dashboard để hiển thị tình trạng công việc từ meetings.

**Acceptance criteria:**
- Card “Việc quá hạn”.
- Card “Việc hôm nay/tuần này”.
- Card “Việc chưa có deadline”.
- Card “Quyết định mới nhất”.
- Click vào card đi đến danh sách đã lọc.

**Verify:**
- `pnpm lint`
- Manual: dashboard có empty state và data state.

**Files likely touched:**
- `src/app/(app)/dashboard/page.tsx`
- `src/components/personal-command-dashboard.tsx`
- `src/lib/customer-value.ts` hoặc `src/lib/dashboard.ts`
- `src/app/(app)/layout.tsx`

**Scope:** M

### Task 1.2: Action list lọc/sắp xếp tốt hơn

**Mô tả:** Biến Actions thành nơi làm việc chính sau meeting.

**Acceptance criteria:**
- Filter theo status: open, done, overdue, no deadline.
- Sort theo deadline/created date/meeting.
- Search theo title/owner/meeting.
- Quick mark done.

**Verify:**
- Unit test helper filter/sort nếu có.
- Manual: tạo action từ meeting rồi lọc được.

**Files likely touched:**
- `src/app/(app)/actions/page.tsx`
- `src/components/action-*`
- `src/lib/action-items.ts`

**Scope:** M

### Task 1.3: Follow-up brief một nút copy

**Mô tả:** Từ meeting/action board tạo bản follow-up ngắn để gửi Zalo/email/chat.

**Acceptance criteria:**
- Có nút “Copy follow-up”.
- Nội dung gồm: summary, decisions, actions, deadlines.
- Format tiếng Việt gọn, paste được vào chat/email.

**Verify:**
- `pnpm test src/lib/follow-up-brief.test.ts`
- Manual: copy từ meeting có actions/decisions.

**Files likely touched:**
- `src/lib/follow-up-brief.ts`
- `src/lib/follow-up-brief.test.ts`
- Meeting detail/history component.

**Scope:** S/M

### Checkpoint Phase 1

- `pnpm test`
- `pnpm build`
- Manual: upload/generate → actions xuất hiện → dashboard phản ánh đúng → copy follow-up được.

## Phase 2 — Lưu trữ, tìm kiếm, export, backup

Mục tiêu: dữ liệu họp trở thành kho tri thức cá nhân, tìm lại nhanh và không sợ mất.

### Task 2.1: Global search nâng cấp

**Mô tả:** Search không chỉ tìm title, mà tìm summary/actions/decisions/audio name.

**Acceptance criteria:**
- Search trả kết quả theo meeting, action, decision.
- Result có highlight/preview.
- Click deep-link đúng section.

**Verify:**
- `pnpm test src/lib/search.test.ts`
- Manual: tìm keyword trong decision/action.

**Files likely touched:**
- `src/lib/search.ts`
- `src/components/global-search.tsx`
- `src/app/api/search/route.ts`

**Scope:** M

### Task 2.2: Export all data

**Mô tả:** Xuất toàn bộ dữ liệu cá nhân để backup hoặc dùng ngoài app.

**Acceptance criteria:**
- Export JSON đầy đủ meetings/actions/decisions/uploads metadata.
- Export Markdown tổng hợp theo từng meeting.
- Có nút trong Account/Settings.

**Verify:**
- `pnpm test src/lib/export-org-data.test.ts` hoặc test mới cho personal export.
- Manual: tải file và mở được.

**Files likely touched:**
- `src/lib/export-personal-data.ts`
- `src/app/api/export/personal/route.ts`
- `src/app/(app)/settings/account/page.tsx`

**Scope:** M

### Task 2.3: Local backup/import strategy

**Mô tả:** Vì dùng cá nhân, backup quan trọng hơn billing. Ưu tiên export trước, import sau.

**Acceptance criteria:**
- Có hướng dẫn backup SQLite/db file hoặc export JSON.
- Nếu build import: validate JSON trước khi ghi DB.
- Không overwrite dữ liệu hiện có khi chưa confirm.

**Verify:**
- Manual backup/restore trên local copy.

**Files likely touched:**
- `docs/backup-restore.md`
- optional API import route sau khi có nhu cầu thật.

**Scope:** S trước, M nếu có import.

## Phase 3 — Chất lượng notes và tự động hóa cá nhân

Mục tiêu: output từ AI hữu ích hơn, ít phải sửa tay.

### Task 3.1: Template notes theo loại cuộc họp

**Mô tả:** Cho chọn template: meeting thường, sales call, internal planning, client feedback.

**Acceptance criteria:**
- Chọn template trước khi generate.
- Prompt/format output đổi theo template.
- Template mặc định vẫn hoạt động như hiện tại.

**Verify:**
- `pnpm test src/lib/gemini.test.ts`
- Manual: cùng audio/text, template khác cho output khác cấu trúc.

**Scope:** M

### Task 3.2: Auto-detect deadlines và priority

**Mô tả:** Action items tự có deadline/priority khi transcript có tín hiệu.

**Acceptance criteria:**
- Parse “ngày mai”, “tuần sau”, “thứ 6”, deadline rõ.
- Gắn priority high/medium/low khi có tín hiệu khẩn cấp.
- UI hiển thị priority/deadline nổi bật.

**Verify:**
- Unit tests cho parser.
- Manual: transcript mẫu có deadline tiếng Việt.

**Scope:** M

### Task 3.3: Reminder cá nhân

**Mô tả:** Nhắc các action quá hạn/sắp đến hạn trong app hoặc email nếu đã có email integration.

**Acceptance criteria:**
- Reminder list trong notification bell.
- Có digest daily/weekly tùy chọn.
- Không cần Business/team manager digest.

**Verify:**
- `pnpm test src/lib/deadline-reminders.test.ts`
- Manual: seed overdue action, thấy notification/digest.

**Scope:** M

## 6. Thứ tự implement đề xuất

P0 bắt buộc làm trước để app không còn lệch hướng:

1. **Task 0.1** Unlock plan logic.
2. **Task 0.2** Gỡ upgrade/paywall khỏi app UI.
3. **Task 0.3** Tắt/cô lập billing/pricing.
4. **Checkpoint:** test + build + smoke.
5. **Task 1.1** Personal command dashboard.
6. **Task 1.2** Actions lọc/sort/quick done.
7. **Task 1.3** Follow-up brief copy.
8. **Checkpoint:** end-to-end meeting → action → follow-up.
9. **Task 2.1/2.2** Search/export.
10. **Task 3.x** AI quality/reminders.

## 7. Những thứ nên xóa hoặc giảm ưu tiên

### Nên xóa khỏi UI ngay

- Link `/pricing` trong app.
- Banner quota/free/pro.
- Copy “Nâng cấp Pro”.
- Gate History/Actions/DOCX.
- Badge Pro/Business trong nav.

### Có thể giữ tạm trong code nhưng không dùng

- LemonSqueezy webhook/API.
- DB fields `plan`, `lsCustomerId`, `lsSubscriptionId`.
- Organization/team logic nếu chưa gây rối.

### Nên xóa sau khi P0 ổn

- Tests chỉ phục vụ billing/plan tiers nếu không còn giá trị.
- Pricing page nếu không muốn giữ landing marketing.
- Billing env docs.

## 8. Rủi ro & giảm thiểu

| Rủi ro | Mức | Giảm thiểu |
|---|---:|---|
| Xóa billing làm fail test/build | Trung bình | Phase 0 unlock/cô lập trước, xóa sâu sau. |
| Plan fields còn trong DB gây rối | Thấp | Giữ backward-compatible, không cần migration ngay. |
| Team/workspace logic phụ thuộc Business | Trung bình | Chỉ gỡ gate trước, chưa xóa organization model. |
| App mất định hướng nếu chỉ “thêm tính năng” | Cao | Mỗi tính năng phải phục vụ meeting → action → follow-up. |
| Dashboard quá nhiều thông tin | Trung bình | Tập trung 4 card: overdue, today/week, no deadline, decisions. |

## 9. Definition of done cho P0

- Không còn paywall trong app chính.
- Không còn bắt nâng cấp để dùng History/Actions/DOCX.
- Không còn banner quota/free/pro/business trong nav.
- Người dùng đăng nhập dùng được toàn bộ tính năng core.
- `pnpm test` pass.
- `pnpm build` pass.
- Manual smoke pass: login → generate meeting notes → history → actions → export/copy.

## 10. Ghi chú cho agent implement

- Không refactor lớn ngay.
- Ưu tiên thay đổi nhỏ, dễ verify.
- Không động vào schema DB nếu chưa cần.
- Nếu xóa route billing gây nhiều lỗi, hãy disable đường dẫn UI trước rồi cleanup sau.
- Mọi thay đổi phải có verify bằng command thật, không báo done nếu chưa chạy test/build.
