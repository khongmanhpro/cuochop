import { describe, expect, test } from "vitest";
import type { VietnameseMeetingNotes } from "./gemini";
import {
  applyMeetingNotesEdits,
  buildUpdatedMeetingPayload,
  linesFromTextarea,
  textareaFromLines,
} from "./meeting-notes-edit";

const baseNotes: VietnameseMeetingNotes = {
  title: "Weekly",
  executiveSummary: ["Ý cũ"],
  meetingOverview: {
    language: "vi",
    duration: "00:10:00",
    speakerCount: 2,
    mainTopic: "Chủ đề cũ",
  },
  keyDiscussionPoints: [{ title: "A", details: ["B"] }],
  decisions: ["Quyết định cũ"],
  actionItems: [
    {
      task: "Việc",
      owner: "An",
      deadline: "Mai",
      priority: "High",
      notes: "",
    },
  ],
  risksAndBlockers: ["Rủi ro cũ"],
  openQuestions: ["Hỏi cũ"],
  transcript: {
    language: "vi",
    duration: "00:10:00",
    speakers: ["Speaker 1"],
    segments: [
      { start: "00:00:00", speaker: "Speaker 1", text: "Xin chào" },
    ],
  },
};

describe("meeting-notes-edit helpers", () => {
  test("linesFromTextarea trims and drops empty lines", () => {
    expect(linesFromTextarea("  a\n\n b \n")).toEqual(["a", "b"]);
  });

  test("textareaFromLines joins with newlines", () => {
    expect(textareaFromLines(["a", "b"])).toBe("a\nb");
  });

  test("applyMeetingNotesEdits updates editable fields only", () => {
    const next = applyMeetingNotesEdits(baseNotes, {
      mainTopic: "Chủ đề mới",
      executiveSummary: ["Ý 1", "Ý 2"],
      decisions: ["QĐ 1"],
      risksAndBlockers: ["R1"],
      openQuestions: ["H1"],
    });

    expect(next.meetingOverview.mainTopic).toBe("Chủ đề mới");
    expect(next.executiveSummary).toEqual(["Ý 1", "Ý 2"]);
    expect(next.decisions).toEqual(["QĐ 1"]);
    expect(next.actionItems).toEqual(baseNotes.actionItems);
    expect(next.transcript.segments[0]?.text).toBe("Xin chào");
    expect(next.keyDiscussionPoints).toEqual(baseNotes.keyDiscussionPoints);
  });

  test("buildUpdatedMeetingPayload regenerates markdown", () => {
    const result = buildUpdatedMeetingPayload(JSON.stringify(baseNotes), {
      mainTopic: "Roadmap",
      executiveSummary: ["Ship G1"],
      decisions: ["Dùng Docker test"],
      risksAndBlockers: ["Không có"],
      openQuestions: ["Khi nào Epic B?"],
    });

    expect(result.notes.meetingOverview.mainTopic).toBe("Roadmap");
    expect(result.markdown).toContain("Ship G1");
    expect(result.markdown).toContain("Dùng Docker test");
    expect(JSON.parse(result.notesJson).executiveSummary).toEqual(["Ship G1"]);
  });

  test("buildUpdatedMeetingPayload throws on invalid JSON", () => {
    expect(() =>
      buildUpdatedMeetingPayload("not-json", {
        mainTopic: "x",
        executiveSummary: ["y"],
        decisions: ["z"],
        risksAndBlockers: [],
        openQuestions: [],
      }),
    ).toThrow("INVALID_NOTES_JSON");
  });
});
