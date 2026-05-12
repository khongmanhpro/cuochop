import { describe, expect, test } from "vitest";
import { formatMeetingNotesMarkdown } from "./formatMeetingNotesMarkdown";
import type { VietnameseMeetingNotes } from "./gemini";

describe("formatMeetingNotesMarkdown", () => {
  test("formats all required sections and transcript timestamps", () => {
    const markdown = formatMeetingNotesMarkdown({
      title: "Meeting Notes",
      executiveSummary: ["Tập trung hoàn thiện demo."],
      meetingOverview: {
        language: "vi",
        duration: "00:10:00",
        speakerCount: 2,
        mainTopic: "Demo sản phẩm",
      },
      keyDiscussionPoints: [
        {
          title: "Demo",
          details: ["Cần hoàn thiện trước thứ Sáu."],
        },
      ],
      decisions: ["Ưu tiên hoàn thiện demo."],
      actionItems: [
        {
          task: "Hoàn thiện demo | bản nội bộ",
          owner: "Chưa xác định",
          deadline: "thứ Sáu",
          priority: "High",
          notes: "Cần review",
        },
      ],
      risksAndBlockers: [],
      openQuestions: [],
      transcript: {
        language: "vi",
        duration: "00:10:00",
        speakers: ["Speaker 1", "Speaker 2"],
        segments: [
          {
            start: "00:00:00",
            end: "00:00:10",
            speaker: "Speaker 1",
            text: "Chúng ta cần hoàn thiện bản demo.",
          },
        ],
      },
    } satisfies VietnameseMeetingNotes);

    expect(markdown).toContain("# Meeting Notes");
    expect(markdown).toContain("## 1. Tóm tắt điều hành");
    expect(markdown).toContain("## 5. Action Items");
    expect(markdown).toContain(
      "| Hoàn thiện demo \\| bản nội bộ | Chưa xác định | thứ Sáu | High | Cần review |",
    );
    expect(markdown).toContain("- Chưa xác định");
    expect(markdown).toContain(
      "[00:00:00 - 00:00:10] Speaker 1: Chúng ta cần hoàn thiện bản demo.",
    );
    expect(markdown).not.toContain("undefined");
    expect(markdown).not.toContain("null");
  });
});
