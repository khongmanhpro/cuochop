import { describe, expect, test, vi } from "vitest";
import {
  buildFallbackMeetingNotes,
  buildFallbackTranscript,
  extractJsonText,
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

describe("extractJsonText", () => {
  test("extracts JSON from plain text", () => {
    const text = 'Here is the result: {"key": "value"} done.';
    expect(extractJsonText(text)).toBe('{"key": "value"}');
  });

  test("extracts JSON from markdown fence", () => {
    const text = '```json\n{"key": "value"}\n```';
    expect(extractJsonText(text)).toBe('{"key": "value"}');
  });

  test("extracts JSON from bare fence", () => {
    const text = '```\n{"key": "value"}\n```';
    expect(extractJsonText(text)).toBe('{"key": "value"}');
  });

  test("extracts nested JSON objects", () => {
    const text = '{"outer": {"inner": "value"}}';
    expect(extractJsonText(text)).toBe('{"outer": {"inner": "value"}}');
  });

  test("extracts JSON with arrays", () => {
    const text = 'prefix {"items": [1, 2, 3]} suffix';
    expect(extractJsonText(text)).toBe('{"items": [1, 2, 3]}');
  });

  test("returns empty string when no JSON found", () => {
    expect(extractJsonText("no json here")).toBe("");
  });

  test("returns empty string for empty input", () => {
    expect(extractJsonText("")).toBe("");
  });

  test("returns empty string for non-string input", () => {
    expect(extractJsonText(null as unknown as string)).toBe("");
  });

  test("handles JSON with nested braces in strings", () => {
    const text = '{"text": "value with } brace"}';
    expect(extractJsonText(text)).toBe('{"text": "value with } brace"}');
  });

  test("handles multiple JSON blocks — takes outermost", () => {
    const text = '{"a": 1} and {"b": 2}';
    // First { to last } — captures both blocks
    expect(extractJsonText(text)).toBe('{"a": 1} and {"b": 2}');
  });
});

describe("parseJsonFromModelResponse — edge cases", () => {
  const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

  test("returns fallback for empty response", () => {
    const result = parseJsonFromModelResponse("");
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]?.text).toBe("[không nghe rõ]");
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  test("returns fallback for pure prose without JSON", () => {
    const result = parseJsonFromModelResponse("This is just text, no JSON.");
    expect(result.segments[0]?.text).toBe("This is just text, no JSON.");
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  test("returns fallback for malformed JSON", () => {
    const result = parseJsonFromModelResponse('{"broken": "json"');
    expect(result.segments[0]?.text).toContain("broken");
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  test("returns fallback for JSON without segments array", () => {
    const result = parseJsonFromModelResponse('{"language": "vi", "duration": "00:00:10"}');
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]?.text).toContain("language");
  });

  test("returns fallback for JSON with empty segments", () => {
    const result = parseJsonFromModelResponse(
      '{"language": "vi", "duration": "00:00:10", "speakers": [], "segments": []}',
    );
    expect(result.segments).toHaveLength(1);
  });

  test("parses JSON embedded in prose", () => {
    const result = parseJsonFromModelResponse(
      'Here is the transcript:\n{"language": "vi", "duration": "00:00:05", "speakers": ["Speaker 1"], "segments": [{"start": "00:00:00", "speaker": "Speaker 1", "text": "Hello"}]}\nDone.',
    );
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]?.text).toBe("Hello");
  });

  test("normalizes missing speakers from segments", () => {
    const result = parseJsonFromModelResponse(
      '{"language": "vi", "duration": "00:00:05", "segments": [{"start": "00:00:00", "speaker": "Speaker 1", "text": "Hello"}, {"start": "00:00:05", "speaker": "Speaker 2", "text": "Hi"}]}',
    );
    expect(result.speakers).toEqual(["Speaker 1", "Speaker 2"]);
  });

  test("logs structured warning on parse failure", () => {
    consoleWarnSpy.mockClear();
    parseJsonFromModelResponse("not json at all");
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    const logCall = consoleWarnSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(logCall);
    expect(parsed.event).toBe("gemini_parse_failure");
    expect(parsed.kind).toBe("transcript");
    expect(parsed.reason).toBeDefined();
    expect(parsed.rawResponseLength).toBe(15);
  });
});

describe("parseNotesJsonFromModelResponse — edge cases", () => {
  const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

  const transcript = {
    language: "vi" as const,
    duration: "00:10:00",
    speakers: ["Speaker 1"],
    segments: [
      { start: "00:00:00", speaker: "Speaker 1", text: "Test" },
    ],
  };

  test("returns fallback for empty response", () => {
    const result = parseNotesJsonFromModelResponse("", transcript);
    expect(result.title).toBe("Meeting Notes");
    expect(result.executiveSummary).toEqual(["Chưa xác định"]);
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  test("returns fallback for pure prose", () => {
    const result = parseNotesJsonFromModelResponse("Just text, no JSON.", transcript);
    expect(result.title).toBe("Meeting Notes");
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  test("returns fallback for malformed JSON", () => {
    const result = parseNotesJsonFromModelResponse('{"title": "broken"', transcript);
    expect(result.title).toBe("Meeting Notes");
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  test("normalizes JSON with missing fields", () => {
    const result = parseNotesJsonFromModelResponse('{"title": "Test Meeting"}', transcript);
    expect(result.title).toBe("Test Meeting");
    expect(result.executiveSummary).toEqual(["Chưa xác định"]);
    expect(result.decisions).toEqual(["Chưa xác định"]);
    expect(result.actionItems[0]?.task).toBe("Chưa xác định");
  });

  test("normalizes JSON with wrong field types", () => {
    const result = parseNotesJsonFromModelResponse(
      '{"title": 123, "executiveSummary": "not an array", "decisions": null}',
      transcript,
    );
    expect(result.title).toBe("Meeting Notes");
    expect(result.executiveSummary).toEqual(["Chưa xác định"]);
    expect(result.decisions).toEqual(["Chưa xác định"]);
  });

  test("normalizes action items with invalid priority", () => {
    const result = parseNotesJsonFromModelResponse(
      '{"actionItems": [{"task": "Test", "owner": "A", "deadline": "soon", "priority": "URGENT", "notes": ""}]}',
      transcript,
    );
    expect(result.actionItems[0]?.priority).toBe("Chưa xác định");
  });

  test("logs structured warning on parse failure", () => {
    consoleWarnSpy.mockClear();
    parseNotesJsonFromModelResponse("not json", transcript);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    const logCall = consoleWarnSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(logCall);
    expect(parsed.event).toBe("gemini_parse_failure");
    expect(parsed.kind).toBe("notes");
  });
});
