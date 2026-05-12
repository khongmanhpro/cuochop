import type { VietnameseMeetingNotes } from "./gemini";

const fallback = "Chưa xác định";

export function formatMeetingNotesMarkdown(notes: VietnameseMeetingNotes) {
  const lines = [
    "# Meeting Notes",
    "",
    "## 1. Tóm tắt điều hành",
    ...formatBulletList(notes.executiveSummary),
    "",
    "## 2. Thông tin cuộc họp",
    `- Ngôn ngữ: ${safeText(notes.meetingOverview.language)}`,
    `- Thời lượng: ${safeText(notes.meetingOverview.duration)}`,
    `- Số người nói: ${String(notes.meetingOverview.speakerCount ?? fallback)}`,
    `- Chủ đề chính: ${safeText(notes.meetingOverview.mainTopic)}`,
    "",
    "## 3. Nội dung chính",
    ...formatDiscussionPoints(notes.keyDiscussionPoints),
    "",
    "## 4. Quyết định",
    ...formatBulletList(notes.decisions),
    "",
    "## 5. Action Items",
    "| Việc cần làm | Người phụ trách | Deadline | Ưu tiên | Ghi chú |",
    "|---|---|---|---|---|",
    ...formatActionItems(notes.actionItems),
    "",
    "## 6. Rủi ro / Blockers",
    ...formatBulletList(notes.risksAndBlockers),
    "",
    "## 7. Câu hỏi còn mở",
    ...formatBulletList(notes.openQuestions),
    "",
    "## 8. Transcript có timestamp",
    ...formatTranscript(notes),
    "",
  ];

  return lines.join("\n");
}

function formatBulletList(items: string[] | undefined) {
  const values = normalizeArray(items);
  return values.map((item) => `- ${safeText(item)}`);
}

function formatDiscussionPoints(
  points: VietnameseMeetingNotes["keyDiscussionPoints"] | undefined,
) {
  if (!points || points.length === 0) {
    return ["### 3.1 Chưa xác định", "- Chưa xác định"];
  }

  return points.flatMap((point, index) => [
    `### 3.${index + 1} ${safeText(point.title)}`,
    ...formatBulletList(point.details),
  ]);
}

function formatActionItems(
  actionItems: VietnameseMeetingNotes["actionItems"] | undefined,
) {
  if (!actionItems || actionItems.length === 0) {
    return [`| ${fallback} | ${fallback} | ${fallback} | ${fallback} | ${fallback} |`];
  }

  return actionItems.map(
    (item) =>
      `| ${tableText(item.task)} | ${tableText(item.owner)} | ${tableText(item.deadline)} | ${tableText(item.priority)} | ${tableText(item.notes)} |`,
  );
}

function formatTranscript(notes: VietnameseMeetingNotes) {
  const segments = notes.transcript?.segments || [];

  if (segments.length === 0) {
    return [fallback];
  }

  return segments.map((segment) => {
    const end = segment.end ? ` - ${segment.end}` : "";
    return `[${safeText(segment.start)}${end}] ${safeText(segment.speaker)}: ${safeText(segment.text)}`;
  });
}

function normalizeArray(items: string[] | undefined) {
  if (!items || items.length === 0) {
    return [fallback];
  }

  return items.length > 0 ? items : [fallback];
}

function safeText(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function tableText(value: unknown) {
  return safeText(value).replaceAll("|", "\\|");
}
