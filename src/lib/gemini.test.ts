import { describe, expect, test, vi } from "vitest";
import {
  buildFallbackMeetingNotes,
  buildFallbackTranscript,
  getGeminiApiKey,
  parseJsonFromModelResponse,
  parseNotesJsonFromModelResponse,
  waitForGeminiFileActive,
} from "./gemini";

describe("Gemini transcription helpers", () => {
  test("waits for uploaded Gemini files to become active", async () => {
    const files = {
      get: vi
        .fn()
        .mockResolvedValueOnce({ name: "files/test", state: "PROCESSING" })
        .mockResolvedValueOnce({ name: "files/test", state: "ACTIVE", uri: "uri" }),
    };

    await expect(
      waitForGeminiFileActive({
        file: { name: "files/test", state: "PROCESSING" },
        files,
        pollIntervalMs: 0,
        timeoutMs: 100,
      }),
    ).resolves.toMatchObject({ state: "ACTIVE" });
    expect(files.get).toHaveBeenCalledWith({ name: "files/test" });
  });

  test("throws a helpful message when GEMINI_API_KEY is missing", () => {
    const previous = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      expect(() => getGeminiApiKey()).toThrow(
        "Thiếu GEMINI_API_KEY. Hãy thêm key vào .env.local rồi restart dev server.",
      );
    } finally {
      if (previous) {
        process.env.GEMINI_API_KEY = previous;
      }
    }
  });

  test("parses JSON even when model wraps it in markdown text", () => {
    const parsed = parseJsonFromModelResponse(`
Here is the transcript:

\`\`\`json
{
  "language": "vi",
  "duration": "00:00:12",
  "speakers": ["Speaker 1"],
  "segments": [
    {
      "start": "00:00:00",
      "end": "00:00:12",
      "speaker": "Speaker 1",
      "text": "Xin chào mọi người."
    }
  ]
}
\`\`\`
`);

    expect(parsed).toEqual({
      language: "vi",
      duration: "00:00:12",
      speakers: ["Speaker 1"],
      segments: [
        {
          start: "00:00:00",
          end: "00:00:12",
          speaker: "Speaker 1",
          text: "Xin chào mọi người.",
        },
      ],
    });
  });

  test("returns a fallback transcript when JSON parsing fails", () => {
    expect(buildFallbackTranscript("raw model text")).toEqual({
      language: "vi",
      duration: "Chưa xác định",
      speakers: ["Speaker 1"],
      segments: [
        {
          start: "00:00:00",
          speaker: "Speaker 1",
          text: "raw model text",
        },
      ],
      rawText: "raw model text",
    });
  });
});

describe("Gemini notes helpers", () => {
  const transcript = {
    language: "vi" as const,
    duration: "00:10:00",
    speakers: ["Speaker 1", "Speaker 2"],
    segments: [
      {
        start: "00:00:00",
        end: "00:00:10",
        speaker: "Speaker 1",
        text: "Chúng ta cần hoàn thiện bản demo trước thứ Sáu.",
      },
    ],
  };

  test("parses notes JSON even when model wraps it in text", () => {
    const notes = parseNotesJsonFromModelResponse(
      `\`\`\`json
{
  "title": "Biên bản họp demo",
  "executiveSummary": ["Cần hoàn thiện bản demo."],
  "meetingOverview": {
    "language": "vi",
    "duration": "00:10:00",
    "speakerCount": 2,
    "mainTopic": "Chuẩn bị demo"
  },
  "keyDiscussionPoints": [
    {
      "title": "Demo",
      "details": ["Hoàn thiện trước thứ Sáu."]
    }
  ],
  "decisions": ["Ưu tiên hoàn thiện demo."],
  "actionItems": [
    {
      "task": "Hoàn thiện bản demo",
      "owner": "Chưa xác định",
      "deadline": "thứ Sáu",
      "priority": "High",
      "notes": "Theo transcript"
    }
  ],
  "risksAndBlockers": [],
  "openQuestions": []
}
\`\`\``,
      transcript,
    );

    expect(notes.title).toBe("Biên bản họp demo");
    expect(notes.actionItems[0]?.priority).toBe("High");
    expect(notes.risksAndBlockers).toEqual(["Chưa xác định"]);
    expect(notes.openQuestions).toEqual(["Chưa xác định"]);
    expect(notes.transcript).toEqual(transcript);
  });

  test("returns fallback notes when JSON parsing fails", () => {
    expect(buildFallbackMeetingNotes("raw notes text", transcript)).toEqual({
      title: "Meeting Notes",
      executiveSummary: ["raw notes text"],
      meetingOverview: {
        language: "vi",
        duration: "00:10:00",
        speakerCount: 2,
        mainTopic: "Chưa xác định",
      },
      keyDiscussionPoints: [
        {
          title: "Chưa xác định",
          details: ["raw notes text"],
        },
      ],
      decisions: ["Chưa xác định"],
      actionItems: [
        {
          task: "Chưa xác định",
          owner: "Chưa xác định",
          deadline: "Chưa xác định",
          priority: "Chưa xác định",
          notes: "Chưa xác định",
        },
      ],
      risksAndBlockers: ["Chưa xác định"],
      openQuestions: ["Chưa xác định"],
      transcript,
      rawText: "raw notes text",
    });
  });
});
