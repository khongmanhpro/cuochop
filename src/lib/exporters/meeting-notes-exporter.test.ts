import { describe, expect, test } from "vitest";
import type { VietnameseMeetingNotes } from "../gemini";
import {
  exportMeetingNotes,
  exportMeetingNotesDocx,
  exportMeetingNotesMarkdown,
} from "./meeting-notes-exporter";

const notes = {
  title: "Meeting Notes",
  executiveSummary: ["Hoàn thiện demo."],
  meetingOverview: {
    language: "vi",
    duration: "00:10:00",
    speakerCount: 1,
    mainTopic: "Demo sản phẩm",
  },
  keyDiscussionPoints: [
    {
      title: "Demo",
      details: ["Cần review bản nội bộ."],
    },
  ],
  decisions: ["Chưa xác định"],
  actionItems: [
    {
      task: "Review demo",
      owner: "Chưa xác định",
      deadline: "Chưa xác định",
      priority: "Medium",
      notes: "Theo transcript",
    },
  ],
  risksAndBlockers: ["Chưa xác định"],
  openQuestions: ["Chưa xác định"],
  transcript: {
    language: "vi",
    duration: "00:10:00",
    speakers: ["Speaker 1"],
    segments: [
      {
        start: "00:00:00",
        end: "00:00:10",
        speaker: "Speaker 1",
        text: "Chúng ta review demo.",
      },
    ],
  },
} satisfies VietnameseMeetingNotes;

describe("meeting notes exporters", () => {
  test("exports markdown with a clean timestamped filename", () => {
    const result = exportMeetingNotesMarkdown(notes, {
      now: new Date("2026-05-12T09:30:00+07:00"),
    });

    expect(result.format).toBe("markdown");
    expect(result.filename).toBe("meeting-notes-20260512-0930.md");
    expect(result.mimeType).toBe("text/markdown; charset=utf-8");
    expect(result.content).toContain("# Meeting Notes");
  });

  test("dispatcher exports markdown", () => {
    const result = exportMeetingNotes(notes, "markdown", {
      now: new Date("2026-05-12T09:30:00+07:00"),
    });

    expect(result.filename.endsWith(".md")).toBe(true);
  });

  test("dispatcher rejects invalid formats", () => {
    expect(() =>
      exportMeetingNotes(notes, "pdf" as never),
    ).toThrow("Invalid export format.");

    try {
      exportMeetingNotes(notes, "pdf" as never);
    } catch (error) {
      expect(error).toMatchObject({
        code: "INVALID_EXPORT_FORMAT",
      });
    }
  });

  test("docx exporter returns a Word document buffer", async () => {
    const result = await exportMeetingNotesDocx(notes, {
      now: new Date("2026-05-12T09:30:00+07:00"),
    });

    expect(result.format).toBe("docx");
    expect(result.filename).toBe("meeting-notes-20260512-0930.docx");
    expect(result.mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(Buffer.isBuffer(result.content)).toBe(true);
    expect(result.content.length).toBeGreaterThan(1000);
  });

  test("docx exporter does not crash when optional arrays are missing", async () => {
    const result = await exportMeetingNotesDocx(
      {
        ...notes,
        actionItems: undefined,
        keyDiscussionPoints: undefined,
        transcript: {
          ...notes.transcript,
          segments: undefined,
        },
      } as never,
      { now: new Date("2026-05-12T09:30:00+07:00") },
    );

    expect(Buffer.isBuffer(result.content)).toBe(true);
  });

  test("dispatcher exports docx", async () => {
    const result = await exportMeetingNotes(notes, "docx", {
      now: new Date("2026-05-12T09:30:00+07:00"),
    });

    expect(result.filename.endsWith(".docx")).toBe(true);
  });
});
