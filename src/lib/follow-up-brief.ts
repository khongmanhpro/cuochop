import type { VietnameseMeetingNotes } from "./gemini";

const fallback = "Chưa xác định";

export function formatFollowUpBrief(notes: VietnameseMeetingNotes) {
  return [
    `# Follow-up sau cuộc họp: ${safeText(notes.title, "Meeting Notes")}`,
    "",
    "## Decisions đã chốt",
    ...formatBulletList(notes.decisions),
    "",
    "## Action items",
    ...formatActionItems(notes.actionItems),
    "",
    "## Blockers cần xử lý",
    ...formatBulletList(notes.risksAndBlockers),
    "",
    "## Câu hỏi còn mở",
    ...formatBulletList(notes.openQuestions),
    "",
  ].join("\n");
}

function formatActionItems(items: VietnameseMeetingNotes["actionItems"]) {
  if (!items.length) {
    return [`- ${fallback}`];
  }

  return items.map((item) => {
    const task = safeText(item.task);
    const owner = safeText(item.owner);
    const deadline = safeText(item.deadline);
    const priority = safeText(item.priority);
    const notes = safeText(item.notes);
    const suffix = notes === fallback ? "" : ` - Ghi chú: ${notes}`;

    return `- [${priority}] ${task} - Owner: ${owner} - Deadline: ${deadline}${suffix}`;
  });
}

function formatBulletList(items: string[]) {
  const values = items
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (values.length === 0) {
    return [`- ${fallback}`];
  }

  return values.map((item) => `- ${item}`);
}

function safeText(value: unknown, defaultValue = fallback) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : defaultValue;
}
