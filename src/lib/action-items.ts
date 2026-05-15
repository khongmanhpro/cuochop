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
  task: string;
  owner: string;
  deadline: string;
  priority: ActionItemPriority;
  status: ActionItemStatus;
  notes: string;
};

export type DecisionCreatePayload = {
  meetingNoteId: string;
  userId: string;
  content: string;
};

export type ActionItemUpdatePayload = Partial<{
  owner: string;
  deadline: string;
  priority: ActionItemPriority;
  status: ActionItemStatus;
  notes: string;
}>;

export type DigestActionItem = {
  status: string;
  owner: string;
  deadline: string;
};

const fallback = "Chưa xác định";

export function isActionItemStatus(value: unknown): value is ActionItemStatus {
  return ACTION_ITEM_STATUSES.includes(value as ActionItemStatus);
}

export function isActionItemPriority(value: unknown): value is ActionItemPriority {
  return ACTION_ITEM_PRIORITIES.includes(value as ActionItemPriority);
}

export function buildActionItemCreatePayloads({
  notes,
  meetingNoteId,
  userId,
}: {
  notes: VietnameseMeetingNotes;
  meetingNoteId: string;
  userId: string;
}): ActionItemCreatePayload[] {
  return notes.actionItems
    .filter((item) => !isPlaceholderOnlyActionItem(item))
    .map((item) => ({
      meetingNoteId,
      userId,
      task: textOrFallback(item.task),
      owner: textOrFallback(item.owner),
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
}: {
  notes: VietnameseMeetingNotes;
  meetingNoteId: string;
  userId: string;
}): DecisionCreatePayload[] {
  return notes.decisions
    .map((content) => content.trim())
    .filter((content) => content.length > 0 && content !== fallback)
    .map((content) => ({
      meetingNoteId,
      userId,
      content,
    }));
}

export function normalizeActionItemUpdate(
  value: Record<string, unknown>,
): ActionItemUpdatePayload {
  const update: ActionItemUpdatePayload = {};

  if ("owner" in value) {
    update.owner = normalizeTextField(value.owner, "owner");
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
) {
  const total = actionItems.length;
  const done = actionItems.filter((item) => item.status === "done").length;
  const blocked = actionItems.filter((item) => item.status === "blocked").length;
  const open = actionItems.filter((item) => item.status !== "done").length;
  const withoutOwner = actionItems.filter((item) => isMissing(item.owner)).length;
  const clearlyOverdue = actionItems.filter(
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
