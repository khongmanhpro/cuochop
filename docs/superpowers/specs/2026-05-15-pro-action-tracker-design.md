# Pro Action Tracker Design — cuochop

**Date:** 2026-05-15  
**Status:** Approved for implementation planning  
**Target buyer:** Founder / manager running frequent internal meetings

---

## 1. Goal

Turn cuochop Pro from a paid meeting-notes exporter into a management workflow product. The paid value is not prettier notes. The paid value is helping a manager leave every meeting with clear accountability: who owns what, what is overdue, what is blocked, and what decisions were already made.

The core promise:

> Biến cuộc họp thành việc có người chịu trách nhiệm.

---

## 2. Current Gap

The current commercial version has auth, free/pro gates, billing, meeting history, and DOCX export. That is enough to charge for usage, but it is not enough to solve a business pain. Current Pro mainly offers:

- Unlimited meetings
- DOCX export
- Meeting history

For a manager, those are supporting features. The deeper pain is that meetings produce weak follow-through:

- Action items get buried in notes.
- Owners and deadlines are missing or ambiguous.
- Managers must manually remind people after each meeting.
- Decisions are hard to find later.
- There is no cross-meeting view of overdue or blocked work.

Pro must convert generated notes into a persistent action system.

---

## 3. Product Positioning

### Free

Free remains a trial and lightweight utility:

- 3 meetings per month
- Basic transcript and structured meeting notes
- Markdown copy/download
- No action board
- No editable action tracking
- No decision log
- No DOCX management report

### Pro Manager

Pro is for one manager who wants meeting follow-through:

- Unlimited meetings
- Action Board
- Editable action items
- Decision Log
- Follow-up Brief
- Manager Digest
- Meeting history
- DOCX management report

Recommended public price: **$19/month**.

The existing `$9/month` price underprices the management outcome and anchors the product as a personal note-taking tool. $19/month is still self-serve friendly while supporting a sharper business promise.

### Team

Team pricing is intentionally out of scope for this implementation. The future Team plan can add shared workspaces, invitations, assigned users, email reminders, and integrations. Do not build team membership now.

---

## 4. Scope

This release adds the first Pro Manager workflow:

1. Persist AI-extracted action items as editable database records.
2. Persist AI-extracted decisions as searchable decision records.
3. Add `/actions` as a Pro-only Action Board.
4. Allow managers to edit action item owner, deadline, priority, status, and notes.
5. Add a Manager Digest summary on the Action Board.
6. Add a Follow-up Brief that can be copied after each meeting.
7. Rewrite landing/pricing copy to sell manager follow-through instead of generic notes.

Out of scope:

- Team workspaces
- Inviting other users
- Real assigned-user accounts
- Email reminders
- Calendar, Slack, Notion, Jira, or CRM integrations
- Full-text search across transcripts
- AI regeneration of individual action items

---

## 5. Data Model

### ActionItem

Add a first-class `ActionItem` model. It is derived from meeting notes at generation time, then editable by the manager.

Fields:

- `id: String`
- `meetingNoteId: String`
- `userId: String`
- `task: String`
- `owner: String`
- `deadline: String`
- `priority: String`
- `status: String`
- `notes: String`
- `createdAt: DateTime`
- `updatedAt: DateTime`

Allowed status values:

- `todo`
- `doing`
- `done`
- `blocked`

Allowed priority values remain compatible with current AI output:

- `High`
- `Medium`
- `Low`
- `Chưa xác định`

Deadline stays as text for this release because current AI output may contain relative Vietnamese deadlines such as "tuần sau" or "Chưa xác định". A later release can add normalized date extraction.

### Decision

Add a first-class `Decision` model.

Fields:

- `id: String`
- `meetingNoteId: String`
- `userId: String`
- `content: String`
- `createdAt: DateTime`

Decisions are read-only in the first release. They can be deleted or edited in a future release if needed.

### Relationships

`MeetingNote` gets:

- `actionItems: ActionItem[]`
- `decisions: Decision[]`

`User` gets:

- `actionItems: ActionItem[]`
- `decisions: Decision[]`

All records are scoped by `userId` to prevent cross-account access.

---

## 6. Data Flow

### Generate Meeting Notes

The existing flow remains:

1. Upload file.
2. Transcribe with Gemini.
3. Generate structured meeting notes.
4. Save `MeetingNote`.

New behavior after saving `MeetingNote`:

1. Convert `notes.actionItems` into `ActionItem` records.
2. Convert `notes.decisions` into `Decision` records.
3. Ignore placeholder-only items where every meaningful field is `"Chưa xác định"`.
4. Default new action status to `todo`.
5. Return the same notes/markdown response to the client.

This keeps the current UI working while adding the Pro workflow data.

### Action Board

`/actions` loads action items for the current user and shows:

- Manager Digest at the top
- Filter controls
- Action table or dense list
- Inline status changes
- Edit modal or edit row for owner/deadline/priority/notes

### Update Action Item

Add an API route for updates:

- `PATCH /api/action-items/:id`

Server-side checks:

- User must be authenticated.
- User must be Pro.
- Action item must belong to current user.
- Status and priority must be in allowed values.
- Editable text fields must be trimmed and length-limited.

Response returns the updated action item.

---

## 7. Pro Gates

The Action Board is Pro-only.

Free users visiting `/actions` see a focused upgrade screen:

- Headline: "Đừng để action items chết trong biên bản"
- Show the value: overdue work, blockers, owner/deadline tracking
- CTA: "Nâng cấp Pro"

API update routes return `403 PLAN_FEATURE_UNAVAILABLE` for free users.

Generated notes can still contain action items for free users, but free users cannot manage them in the Action Board.

---

## 8. Manager Digest

The digest appears at the top of `/actions`.

Metrics:

- Total open actions: `todo + doing + blocked`
- Overdue actions: text-deadline heuristic for this release is limited; count only items with explicit ISO-like or `dd/mm/yyyy` dates that are before today
- Blocked actions
- Actions without owner: owner is empty or `"Chưa xác định"`
- Done ratio: `done / total`

Because deadline normalization is not guaranteed, the UI should label overdue detection conservatively:

> Quá hạn rõ ràng

This avoids overclaiming when deadlines are vague.

---

## 9. Follow-up Brief

Add a generated follow-up brief after meeting notes are created. This is deterministic formatting from saved notes, not another AI call.

Sections:

- Decisions đã chốt
- Action items theo owner/deadline
- Blockers cần xử lý
- Câu hỏi còn mở

The UI shows:

- A "Copy Follow-up" button beside existing export buttons.
- A preview block in Vietnamese.

The brief should be available to Free and Pro users after generation, but Pro positioning should make clear that persistent tracking lives in Pro.

---

## 10. UI Changes

### Navigation

In the app shell, add:

- `Actions`
- `History`
- `New Meeting`

Put `Actions` before `History` because it becomes the primary Pro workflow.

### Action Board Layout

The page should be utilitarian and manager-focused:

- No marketing hero.
- Dense but readable controls.
- Digest cards at top.
- Filter bar below digest.
- Action list/table below filters.

Filters:

- Status
- Priority
- Owner text filter
- "No owner"
- "Blocked"
- "Clearly overdue"

### Action Row

Each action row displays:

- Task
- Owner
- Deadline
- Priority
- Status
- Source meeting
- Created date

Interactions:

- Status can be changed quickly from the row.
- Edit opens a compact modal or inline edit panel.

### Meeting Result Page

After generation:

- Keep current notes preview.
- Add Follow-up Brief preview.
- Add "Copy Follow-up".
- If user is Pro, show link: "Xem trong Action Board".
- If user is Free, show small upgrade prompt: "Pro lưu và theo dõi action items qua nhiều cuộc họp."

### Landing and Pricing

Rewrite around manager pain:

- Landing headline: "Biến cuộc họp thành việc có người chịu trách nhiệm"
- Supporting copy: "cuochop tự động trích xuất quyết định, action items, owner, deadline và biến chúng thành bảng theo dõi cho manager."
- Pricing Pro card emphasizes Action Board, Follow-up Brief, Decision Log, Manager Digest.

---

## 11. Error Handling

Action update errors:

- `UNAUTHENTICATED` — redirect/login prompt
- `PLAN_FEATURE_UNAVAILABLE` — show upgrade callout
- `ACTION_ITEM_NOT_FOUND` — show "Không tìm thấy action item"
- `INVALID_ACTION_ITEM_UPDATE` — show field-level or top-level validation message

Generation persistence errors:

- If notes generation succeeds but action/decision persistence fails, do not fail the whole response.
- Log the persistence error server-side.
- Return notes normally with a warning field if practical.

Reasoning: a manager should not lose the generated meeting notes because the derived action records failed to save. The app can still show the notes and allow retry later in a future release.

---

## 12. Testing

Unit tests:

- Convert notes action items into `ActionItem` create payloads.
- Ignore placeholder-only action items.
- Convert decisions into `Decision` create payloads.
- Validate allowed status and priority values.
- Format Follow-up Brief.
- Compute Manager Digest metrics.

API tests where practical:

- Free user cannot patch action item.
- Pro user can patch own action item.
- Pro user cannot patch another user's action item.
- Invalid status is rejected.

UI smoke checks:

- `/actions` renders upgrade screen for Free.
- `/actions` renders digest/list for Pro.
- Generated meeting result shows Follow-up Brief.

---

## 13. Rollout

Implementation order:

1. Schema and migrations.
2. Pure helper functions and tests.
3. Generation persistence for action items and decisions.
4. Action item update API.
5. `/actions` page.
6. Follow-up Brief UI.
7. Landing/pricing copy rewrite.
8. Docker/build verification.

This order keeps database and business logic stable before adding UI.

---

## 14. Success Criteria

The release is complete when:

- A generated meeting creates persistent action items and decisions.
- A Pro user can view all action items across meetings on `/actions`.
- A Pro user can update owner, deadline, priority, status, and notes.
- Free users are blocked from Action Board management with a clear upgrade prompt.
- A manager can copy a follow-up brief immediately after generation.
- Pricing and landing pages sell the Action Tracker value.
- Build and focused tests pass.

