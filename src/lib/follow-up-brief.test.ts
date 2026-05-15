import { describe, expect, test } from "vitest";
import type { VietnameseMeetingNotes } from "./gemini";
import { formatFollowUpBrief } from "./follow-up-brief";

const notes: VietnameseMeetingNotes = {
  title: "Weekly Ops",
  executiveSummary: [],
  meetingOverview: {
    language: "vi",
    duration: "00:25:00",
    speakerCount: 2,
    mainTopic: "Launch",
  },
  keyDiscussionPoints: [],
  decisions: ["Chốt launch vào 20/05"],
  actionItems: [
    {
      task: "Gửi kế hoạch launch",
      owner: "An",
      deadline: "20/05/2026",
      priority: "High",
      notes: "Gửi vào nhóm vận hành",
    },
  ],
  risksAndBlockers: ["Thiếu nội dung landing page"],
  openQuestions: ["Ai duyệt ngân sách ads?"],
  transcript: {
    language: "vi",
    duration: "00:25:00",
    speakers: ["Speaker 1"],
    segments: [],
  },
};

describe("formatFollowUpBrief", () => {
  test("formats a Vietnamese follow-up brief", () => {
    const brief = formatFollowUpBrief(notes);

    expect(brief).toContain("# Follow-up sau cuộc họp: Weekly Ops");
    expect(brief).toContain("- Chốt launch vào 20/05");
    expect(brief).toContain(
      "- [High] Gửi kế hoạch launch - Owner: An - Deadline: 20/05/2026",
    );
    expect(brief).toContain("- Thiếu nội dung landing page");
    expect(brief).toContain("- Ai duyệt ngân sách ads?");
  });
});
