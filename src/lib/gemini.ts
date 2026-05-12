import {
  GoogleGenAI,
  createPartFromUri,
  createUserContent,
} from "@google/genai";
import { getGeminiModelId } from "./models";
import { sanitizeFilename } from "./upload-server";

export type TranscriptSegment = {
  start: string;
  end?: string;
  speaker: string;
  text: string;
};

export type VietnameseMeetingTranscript = {
  language: "vi";
  duration: string;
  speakers: string[];
  segments: TranscriptSegment[];
  rawText?: string;
};

export type ActionItemPriority = "High" | "Medium" | "Low" | "Chưa xác định";

export type VietnameseMeetingNotes = {
  title: string;
  executiveSummary: string[];
  meetingOverview: {
    language: string;
    duration: string;
    speakerCount: number;
    mainTopic: string;
  };
  keyDiscussionPoints: Array<{
    title: string;
    details: string[];
  }>;
  decisions: string[];
  actionItems: Array<{
    task: string;
    owner: string;
    deadline: string;
    priority: ActionItemPriority;
    notes: string;
  }>;
  risksAndBlockers: string[];
  openQuestions: string[];
  transcript: VietnameseMeetingTranscript;
  rawText?: string;
};

export type TranscribeVietnameseMeetingParams = {
  filePath: string;
  originalName: string;
  modelLabel: string;
};

export type GenerateVietnameseMeetingNotesParams = {
  transcript: VietnameseMeetingTranscript;
  modelLabel: string;
  originalName?: string;
};

const transcriptionPrompt = `Bạn là hệ thống transcription cho cuộc họp tiếng Việt.

Hãy transcribe file audio/video này sang tiếng Việt.

Yêu cầu:
- Giữ đúng nội dung người nói.
- Không bịa, không suy đoán thông tin không có trong audio.
- Chia theo từng lượt nói.
- Gắn timestamp dạng HH:MM:SS.
- Nếu có nhiều người nói, dùng Speaker 1, Speaker 2, Speaker 3...
- Nếu không chắc người nói, vẫn dùng speaker gần đúng.
- Nếu đoạn nào nghe không rõ, ghi [không nghe rõ].
- Sửa lỗi chính tả nhẹ để dễ đọc nhưng không thay đổi ý.
- Không thêm phần tóm tắt ở bước này.
- Chỉ trả về JSON hợp lệ, không markdown, không giải thích.

JSON schema:
{
  "language": "vi",
  "duration": "HH:MM:SS hoặc Chưa xác định",
  "speakers": ["Speaker 1", "Speaker 2"],
  "segments": [
    {
      "start": "00:00:00",
      "end": "00:00:10",
      "speaker": "Speaker 1",
      "text": "Nội dung nói..."
    }
  ]
}`;

const notesPromptIntro = `Bạn là trợ lý phân tích biên bản họp tiếng Việt cho môi trường doanh nghiệp.

Dựa trên transcript JSON bên dưới, hãy tạo meeting notes chuyên nghiệp bằng tiếng Việt.

Quy tắc bắt buộc:
- Chỉ dùng thông tin có trong transcript.
- Không bịa, không thêm thông tin không được nói trong cuộc họp.
- Không suy đoán tên người, deadline, quyết định, owner nếu transcript không nêu rõ.
- Nếu thiếu thông tin, ghi "Chưa xác định".
- Viết ngắn gọn, rõ ràng, có cấu trúc.
- Ưu tiên phát hiện decision, action item, risk/blocker, open question.
- Action item phải là việc có thể làm được, không viết chung chung.
- Chỉ trả về JSON hợp lệ, không markdown, không giải thích.

JSON schema:
{
  "title": "Meeting Notes",
  "executiveSummary": [
    "Ý chính 1",
    "Ý chính 2"
  ],
  "meetingOverview": {
    "language": "vi",
    "duration": "HH:MM:SS hoặc Chưa xác định",
    "speakerCount": 2,
    "mainTopic": "Chủ đề chính hoặc Chưa xác định"
  },
  "keyDiscussionPoints": [
    {
      "title": "Chủ đề",
      "details": [
        "Chi tiết 1",
        "Chi tiết 2"
      ]
    }
  ],
  "decisions": [
    "Quyết định đã chốt hoặc Chưa xác định"
  ],
  "actionItems": [
    {
      "task": "Việc cần làm",
      "owner": "Người phụ trách hoặc Chưa xác định",
      "deadline": "Deadline hoặc Chưa xác định",
      "priority": "High | Medium | Low | Chưa xác định",
      "notes": "Ghi chú hoặc Chưa xác định"
    }
  ],
  "risksAndBlockers": [
    "Rủi ro hoặc blocker"
  ],
  "openQuestions": [
    "Câu hỏi còn mở"
  ]
}`;

export function getGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Thiếu GEMINI_API_KEY. Hãy thêm key vào .env.local rồi restart dev server.",
    );
  }

  return apiKey;
}

export async function transcribeVietnameseMeeting({
  filePath,
  originalName,
  modelLabel,
}: TranscribeVietnameseMeetingParams): Promise<VietnameseMeetingTranscript> {
  const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
  const uploadedFile = await ai.files.upload({
    file: filePath,
    config: {
      displayName: sanitizeFilename(originalName),
      mimeType: getMimeTypeForFilename(originalName),
    },
  });
  const activeFile = await waitForGeminiFileActive({
    file: uploadedFile,
    files: ai.files,
  });

  if (!activeFile.uri || !activeFile.mimeType) {
    throw new Error("Gemini Files API did not return a usable file URI.");
  }

  const response = await ai.models.generateContent({
    model: getGeminiModelId(modelLabel),
    contents: createUserContent([
      createPartFromUri(activeFile.uri, activeFile.mimeType),
      transcriptionPrompt,
    ]),
    config: {
      temperature: 0,
      responseMimeType: "application/json",
    },
  });

  return parseJsonFromModelResponse(response.text || "");
}

export async function waitForGeminiFileActive({
  file,
  files,
  timeoutMs = 120_000,
  pollIntervalMs = 1_500,
}: {
  file: {
    name?: string;
    state?: string;
    uri?: string;
    mimeType?: string;
    error?: { message?: string; code?: number };
  };
  files: {
    get: (params: { name: string }) => Promise<{
      name?: string;
      state?: string;
      uri?: string;
      mimeType?: string;
      error?: { message?: string; code?: number };
    }>;
  };
  timeoutMs?: number;
  pollIntervalMs?: number;
}) {
  if (!file.name) {
    throw new Error("Gemini Files API did not return a file name.");
  }

  if (file.state === "ACTIVE") {
    return file;
  }

  const deadline = Date.now() + timeoutMs;
  let current = file;

  while (Date.now() < deadline) {
    if (current.state === "ACTIVE") {
      return current;
    }

    if (current.state === "FAILED") {
      throw new Error(
        `Gemini file processing failed: ${current.error?.message || "unknown error"}`,
      );
    }

    await sleep(pollIntervalMs);
    current = await files.get({ name: file.name });
  }

  throw new Error("Gemini file processing timed out before becoming ACTIVE.");
}

export async function generateVietnameseMeetingNotes({
  transcript,
  modelLabel,
  originalName,
}: GenerateVietnameseMeetingNotesParams): Promise<VietnameseMeetingNotes> {
  if (!Array.isArray(transcript.segments) || transcript.segments.length === 0) {
    throw new Error("Transcript is empty.");
  }

  const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
  const response = await ai.models.generateContent({
    model: getGeminiModelId(modelLabel),
    contents: `${notesPromptIntro}

Tên file gốc: ${originalName || "Chưa xác định"}

Transcript JSON:
${JSON.stringify(transcript, null, 2)}`,
    config: {
      temperature: 0,
      responseMimeType: "application/json",
    },
  });

  return parseNotesJsonFromModelResponse(response.text || "", transcript);
}

export function parseJsonFromModelResponse(text: string) {
  const jsonText = extractJsonText(text);

  if (!jsonText) {
    return buildFallbackTranscript(text);
  }

  try {
    return normalizeTranscript(JSON.parse(jsonText), text);
  } catch {
    return buildFallbackTranscript(text);
  }
}

export function buildFallbackTranscript(rawText: string): VietnameseMeetingTranscript {
  return {
    language: "vi",
    duration: "Chưa xác định",
    speakers: ["Speaker 1"],
    segments: [
      {
        start: "00:00:00",
        speaker: "Speaker 1",
        text: rawText || "[không nghe rõ]",
      },
    ],
    rawText,
  };
}

export function parseNotesJsonFromModelResponse(
  text: string,
  transcript: VietnameseMeetingTranscript,
) {
  const jsonText = extractJsonText(text);

  if (!jsonText) {
    return buildFallbackMeetingNotes(text, transcript);
  }

  try {
    return normalizeMeetingNotes(JSON.parse(jsonText), transcript, text);
  } catch {
    return buildFallbackMeetingNotes(text, transcript);
  }
}

export function buildFallbackMeetingNotes(
  rawText: string,
  transcript: VietnameseMeetingTranscript,
): VietnameseMeetingNotes {
  const fallbackText = rawText || "Chưa xác định";

  return {
    title: "Meeting Notes",
    executiveSummary: [fallbackText],
    meetingOverview: {
      language: transcript.language || "vi",
      duration: transcript.duration || "Chưa xác định",
      speakerCount: transcript.speakers.length,
      mainTopic: "Chưa xác định",
    },
    keyDiscussionPoints: [
      {
        title: "Chưa xác định",
        details: [fallbackText],
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
    rawText,
  };
}

function extractJsonText(text: string) {
  const withoutFence = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return "";
  }

  return withoutFence.slice(start, end + 1);
}

function normalizeTranscript(
  value: unknown,
  rawText: string,
): VietnameseMeetingTranscript {
  if (!isRecord(value)) {
    return buildFallbackTranscript(rawText);
  }

  const rawSegments = Array.isArray(value.segments) ? value.segments : [];
  const segments = rawSegments
    .map(normalizeSegment)
    .filter((segment): segment is TranscriptSegment => Boolean(segment));

  if (segments.length === 0) {
    return buildFallbackTranscript(rawText);
  }

  const speakers =
    Array.isArray(value.speakers) && value.speakers.every((item) => typeof item === "string")
      ? value.speakers
      : Array.from(new Set(segments.map((segment) => segment.speaker)));

  return {
    language: "vi",
    duration:
      typeof value.duration === "string" && value.duration.length > 0
        ? value.duration
        : "Chưa xác định",
    speakers: speakers.length > 0 ? speakers : ["Speaker 1"],
    segments,
  };
}

function normalizeMeetingNotes(
  value: unknown,
  transcript: VietnameseMeetingTranscript,
  rawText: string,
): VietnameseMeetingNotes {
  if (!isRecord(value)) {
    return buildFallbackMeetingNotes(rawText, transcript);
  }

  const overview = isRecord(value.meetingOverview) ? value.meetingOverview : {};

  return {
    title: stringOrFallback(value.title, "Meeting Notes"),
    executiveSummary: normalizeStringArray(value.executiveSummary),
    meetingOverview: {
      language: stringOrFallback(overview.language, transcript.language || "vi"),
      duration: stringOrFallback(overview.duration, transcript.duration),
      speakerCount:
        typeof overview.speakerCount === "number"
          ? overview.speakerCount
          : transcript.speakers.length,
      mainTopic: stringOrFallback(overview.mainTopic, "Chưa xác định"),
    },
    keyDiscussionPoints: normalizeDiscussionPoints(value.keyDiscussionPoints),
    decisions: normalizeStringArray(value.decisions),
    actionItems: normalizeActionItems(value.actionItems),
    risksAndBlockers: normalizeStringArray(value.risksAndBlockers),
    openQuestions: normalizeStringArray(value.openQuestions),
    transcript,
  };
}

function normalizeDiscussionPoints(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return [{ title: "Chưa xác định", details: ["Chưa xác định"] }];
  }

  return value.map((item) => {
    const point = isRecord(item) ? item : {};
    return {
      title: stringOrFallback(point.title, "Chưa xác định"),
      details: normalizeStringArray(point.details),
    };
  });
}

function normalizeActionItems(value: unknown): VietnameseMeetingNotes["actionItems"] {
  if (!Array.isArray(value) || value.length === 0) {
    return [
      {
        task: "Chưa xác định",
        owner: "Chưa xác định",
        deadline: "Chưa xác định",
        priority: "Chưa xác định",
        notes: "Chưa xác định",
      },
    ];
  }

  return value.map((item) => {
    const actionItem = isRecord(item) ? item : {};
    return {
      task: stringOrFallback(actionItem.task, "Chưa xác định"),
      owner: stringOrFallback(actionItem.owner, "Chưa xác định"),
      deadline: stringOrFallback(actionItem.deadline, "Chưa xác định"),
      priority: normalizePriority(actionItem.priority),
      notes: stringOrFallback(actionItem.notes, "Chưa xác định"),
    };
  });
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return ["Chưa xác định"];
  }

  const strings = value.filter((item): item is string => Boolean(item));
  return strings.length > 0 ? strings : ["Chưa xác định"];
}

function stringOrFallback(value: unknown, fallback: string) {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function normalizePriority(value: unknown): ActionItemPriority {
  return value === "High" ||
    value === "Medium" ||
    value === "Low" ||
    value === "Chưa xác định"
    ? value
    : "Chưa xác định";
}

function normalizeSegment(value: unknown): TranscriptSegment | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (
    typeof value.start !== "string" ||
    typeof value.speaker !== "string" ||
    typeof value.text !== "string"
  ) {
    return undefined;
  }

  return {
    start: value.start,
    end: typeof value.end === "string" ? value.end : undefined,
    speaker: value.speaker,
    text: value.text,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getMimeTypeForFilename(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "mp3":
      return "audio/mpeg";
    case "mp4":
      return "video/mp4";
    case "wav":
      return "audio/wav";
    case "m4a":
      return "audio/mp4";
    default:
      throw new Error("Unsupported file format. Use MP3, MP4, WAV, or M4A.");
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
