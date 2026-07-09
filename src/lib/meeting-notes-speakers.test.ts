import { describe, expect, test } from "vitest";
import type { VietnameseMeetingNotes } from "./gemini";
import {
  applySpeakerRenames,
  buildSpeakerRenamePayload,
  listSpeakers,
} from "./meeting-notes-speakers";

const notes: VietnameseMeetingNotes = {
  title: "Weekly",
  executiveSummary: ["Tóm tắt"],
  meetingOverview: {
    language: "vi",
    duration: "00:05:00",
    speakerCount: 2,
    mainTopic: "Ops",
  },
  keyDiscussionPoints: [],
  decisions: ["Chốt A"],
  actionItems: [],
  risksAndBlockers: [],
  openQuestions: [],
  transcript: {
    language: "vi",
    duration: "00:05:00",
    speakers: ["Speaker 1", "Speaker 2"],
    segments: [
      { start: "00:00:00", speaker: "Speaker 1", text: "Xin chào" },
      { start: "00:00:05", speaker: "Speaker 2", text: "Chào bạn" },
    ],
  },
};

describe("speaker rename", () => {
  test("lists unique speakers", () => {
    expect(listSpeakers(notes)).toEqual(["Speaker 1", "Speaker 2"]);
  });

  test("renames speakers in list and segments", () => {
    const next = applySpeakerRenames(notes, {
      "Speaker 1": "An",
      "Speaker 2": "Bình",
    });
    expect(next.transcript.speakers).toEqual(["An", "Bình"]);
    expect(next.transcript.segments[0]?.speaker).toBe("An");
    expect(next.transcript.segments[1]?.speaker).toBe("Bình");
  });

  test("buildSpeakerRenamePayload regenerates markdown", () => {
    const result = buildSpeakerRenamePayload(JSON.stringify(notes), {
      "Speaker 1": "An",
    });
    expect(result.markdown).toContain("An");
    expect(JSON.parse(result.notesJson).transcript.speakers).toContain("An");
  });
});
