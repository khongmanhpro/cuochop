import type { VietnameseMeetingNotes } from "./gemini";

export const ACTION_ITEM_STATUSES = ["todo", "doing", "done", "blocked"] as const;
export const ACTION_ITEM_PRIORITIES = [
  "High",
  "Medium",
  "Low",
  "Chưa xác định",
] as const;

export type ActionItemStatus = (typeof ACTION_ITEM_STATUSES)[number];
export type ActionItemPriority = (typeof ACTION_ITEM_PRIORITIES)[number];

export type ActionItemCreatePayload = {
  meetingNoteId: string;
  userId: string;
  organizationId?: string | null;
  task: string;
  ownerId?: string | null;
  deadline: string;
  priority: ActionItemPriority;
  status: ActionItemStatus;
  notes: string;
};

export type DecisionCreatePayload = {
  meetingNoteId: string;
  userId: string;
  organizationId?: string | null;
  content: string;
};

export type ActionItemUpdatePayload = Partial<{
  ownerId: string | null;
  deadline: string;
  priority: ActionItemPriority;
  status: ActionItemStatus;
  notes: string;
}>;

export type DigestActionItem = {
  status: string;
  ownerId?: string | null;
  deadline: string;
  organizationId?: string | null;
};

const fallback = "Chưa xác định";

export type MatchableMember = {
  id: string;
  name: string | null;
  email: string;
};

export function isActionItemStatus(value: unknown): value is ActionItemStatus {
  return ACTION_ITEM_STATUSES.includes(value as ActionItemStatus);
}

export function isActionItemPriority(value: unknown): value is ActionItemPriority {
  return ACTION_ITEM_PRIORITIES.includes(value as ActionItemPriority);
}

export function resolveOwnerId(
  ownerText: string,
  members: MatchableMember[],
): string | null {
  const normalized = normalizeForMatch(ownerText);
  if (!normalized || normalized === "chưa xác định") return null;

  // 1. Exact name or email match
  for (const m of members) {
    if (m.name && normalizeForMatch(m.name) === normalized) return m.id;
    if (normalizeForMatch(m.email) === normalized) return m.id;
  }

  // 2. Substring match — owner text contained in member name
  for (const m of members) {
    if (m.name && normalizeForMatch(m.name).includes(normalized)) return m.id;
  }

  // 3. Word match — any word from owner text matches a word in member name
  //    Handles "An - Dev Lead" matching "Nguyễn Văn An" via the word "An"
  const ownerWords = normalized.split(/[\s\-_/]+/).filter((w) => w.length >= 2);
  for (const m of members) {
    if (!m.name) continue;
    const nameWords = normalizeForMatch(m.name).split(/\s+/);
    if (ownerWords.some((ow) => nameWords.includes(ow))) return m.id;
  }

  return null;
}

function normalizeForMatch(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildActionItemCreatePayloads({
  notes,
  meetingNoteId,
  userId,
  organizationId,
  orgMembers,
}: {
  notes: VietnameseMeetingNotes;
  meetingNoteId: string;
  userId: string;
  organizationId?: string | null;
  orgMembers?: MatchableMember[];
}): ActionItemCreatePayload[] {
  return notes.actionItems
    .filter((item) => !isPlaceholderOnlyActionItem(item))
    .map((item) => ({
      meetingNoteId,
      userId,
      organizationId,
      task: textOrFallback(item.task),
      ownerId: orgMembers?.length ? resolveOwnerId(item.owner, orgMembers) : null,
      deadline: textOrFallback(item.deadline),
      priority: isActionItemPriority(item.priority) ? item.priority : fallback,
      status: "todo",
      notes: textOrFallback(item.notes),
    }));
}

export function buildDecisionCreatePayloads({
  notes,
  meetingNoteId,
  userId,
  organizationId,
}: {
  notes: VietnameseMeetingNotes;
  meetingNoteId: string;
  userId: string;
  organizationId?: string | null;
}): DecisionCreatePayload[] {
  return notes.decisions
    .map((content) => content.trim())
    .filter((content) => content.length > 0 && content !== fallback)
    .map((content) => ({
      meetingNoteId,
      userId,
      organizationId,
      content,
    }));
}

export function normalizeActionItemUpdate(
  value: Record<string, unknown>,
): ActionItemUpdatePayload {
  const update: ActionItemUpdatePayload = {};

  if ("ownerId" in value) {
    update.ownerId = normalizeNullableId(value.ownerId, "ownerId");
  }

  if ("deadline" in value) {
    update.deadline = normalizeTextField(value.deadline, "deadline");
  }

  if ("notes" in value) {
    update.notes = normalizeTextField(value.notes, "notes");
  }

  if ("priority" in value) {
    if (!isActionItemPriority(value.priority)) {
      throw new Error("Invalid action item priority.");
    }
    update.priority = value.priority;
  }

  if ("status" in value) {
    if (!isActionItemStatus(value.status)) {
      throw new Error("Invalid action item status.");
    }
    update.status = value.status;
  }

  return update;
}

export function computeManagerDigest(
  actionItems: DigestActionItem[],
  now = new Date(),
  organizationId?: string | null,
) {
  const scopedActionItems = organizationId
    ? actionItems.filter((item) => item.organizationId === organizationId)
    : actionItems;
  const total = scopedActionItems.length;
  const done = scopedActionItems.filter((item) => item.status === "done").length;
  const blocked = scopedActionItems.filter((item) => item.status === "blocked").length;
  const open = scopedActionItems.filter((item) => item.status !== "done").length;
  const withoutOwner = scopedActionItems.filter((item) => !item.ownerId).length;
  const clearlyOverdue = scopedActionItems.filter(
    (item) => item.status !== "done" && isClearlyOverdue(item.deadline, now),
  ).length;

  return {
    total,
    open,
    blocked,
    withoutOwner,
    clearlyOverdue,
    done,
    doneRatio: total === 0 ? 0 : done / total,
  };
}

function isPlaceholderOnlyActionItem(
  item: VietnameseMeetingNotes["actionItems"][number],
) {
  return [item.task, item.owner, item.deadline, item.notes].every(isMissing);
}

function isMissing(value: string) {
  return value.trim().length === 0 || value.trim() === fallback;
}

function textOrFallback(value: string) {
  const text = value.trim();
  return text.length > 0 ? text : fallback;
}

function normalizeTextField(value: unknown, field: string) {
  if (typeof value !== "string") {
    throw new Error(`Invalid action item ${field}.`);
  }

  return value.trim().slice(0, 500);
}

function normalizeNullableId(value: unknown, field: string) {
  if (value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new Error(`Invalid action item ${field}.`);
  }

  return value.trim().slice(0, 100) || null;
}

function isClearlyOverdue(deadline: string, now: Date) {
  const parsed = parseClearDeadline(deadline);
  if (!parsed) return false;

  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );

  return parsed.getTime() < today;
}

function parseClearDeadline(value: string) {
  const text = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) {
    return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  }

  const vietnamese = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (vietnamese) {
    return new Date(
      Date.UTC(Number(vietnamese[3]), Number(vietnamese[2]) - 1, Number(vietnamese[1])),
    );
  }

  return null;
}
