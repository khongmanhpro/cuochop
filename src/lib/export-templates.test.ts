import { describe, expect, test } from "vitest";
import { EXPORT_TEMPLATES, getExportTemplate } from "./export-templates";
import type { VietnameseMeetingNotes } from "./gemini";

const mockNotes: VietnameseMeetingNotes = {
  title: "Weekly Ops",
  executiveSummary: ["Chốt launch vào 20/05", "Cần thêm budget ads"],
  meetingOverview: {
    language: "vi",
    duration: "00:25:00",
    speakerCount: 2,
    mainTopic: "Launch Q3",
  },
  keyDiscussionPoints: [
    { title: "Timeline", details: ["Phase 1: 2 tuần", "Phase 2: 3 tuần"] },
  ],
  decisions: ["Chốt launch vào 20/05", "Budget ads: 50 triệu"],
  actionItems: [
    {
      task: "Gửi kế hoạch launch",
      owner: "An",
      deadline: "20/05/2026",
      priority: "High",
      notes: "Gửi vào nhóm vận hành",
    },
    {
      task: "Chuẩn bị landing page",
      owner: "Bình",
      deadline: "18/05/2026",
      priority: "Medium",
      notes: "",
    },
  ],
  risksAndBlockers: ["Thiếu nội dung landing page"],
  openQuestions: ["Ai duyệt ngân sách ads?"],
  transcript: {
    language: "vi",
    duration: "00:25:00",
    speakers: ["Speaker 1", "Speaker 2"],
    segments: [
      { start: "00:00:00", end: "00:01:00", speaker: "Speaker 1", text: "Chào mọi người" },
    ],
  },
};

describe("EXPORT_TEMPLATES", () => {
  test("has 6 templates", () => {
    expect(EXPORT_TEMPLATES).toHaveLength(6);
  });

  test("all templates have required fields", () => {
    for (const t of EXPORT_TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.label).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.icon).toBeTruthy();
      expect(typeof t.format).toBe("function");
    }
  });

  test("getExportTemplate returns default for unknown id", () => {
    const result = getExportTemplate("nonexistent");
    expect(result.id).toBe("standard");
  });
});

describe("standard format", () => {
  test("contains all sections", () => {
    const result = getExportTemplate("standard").format(mockNotes);
    expect(result).toContain("# Meeting Notes");
    expect(result).toContain("Tóm tắt điều hành");
    expect(result).toContain("Quyết định");
    expect(result).toContain("Action Items");
    expect(result).toContain("Rủi ro / Blockers");
    expect(result).toContain("Câu hỏi còn mở");
  });

  test("contains action items in table", () => {
    const result = getExportTemplate("standard").format(mockNotes);
    expect(result).toContain("Gửi kế hoạch launch");
    expect(result).toContain("An");
    expect(result).toContain("High");
  });
});

describe("notion format", () => {
  test("has Notion-specific elements", () => {
    const result = getExportTemplate("notion").format(mockNotes);
    expect(result).toContain("> 📋");
    expect(result).toContain("<details>");
    expect(result).toContain("- [x]");
    expect(result).toContain("- [ ]");
    expect(result).toContain("🔴");
  });
});

describe("slack format", () => {
  test("has Slack emoji syntax", () => {
    const result = getExportTemplate("slack").format(mockNotes);
    expect(result).toContain(":clipboard:");
    expect(result).toContain(":white_check_mark:");
    expect(result).toContain(":dart:");
    expect(result).toContain(":red_circle:");
  });
});

describe("email format", () => {
  test("generates valid HTML", () => {
    const result = getExportTemplate("email").format(mockNotes);
    expect(result).toContain("<!DOCTYPE html>");
    expect(result).toContain("<table");
    expect(result).toContain("<tbody>");
    expect(result).toContain("#ef4444"); // High priority color
  });
});

describe("zalo format", () => {
  test("is plain text with emojis", () => {
    const result = getExportTemplate("zalo").format(mockNotes);
    expect(result).toContain("📋");
    expect(result).toContain("🔴");
    expect(result).toContain("👤");
    expect(result).not.toContain("<");
    expect(result).not.toContain("|");
  });
});

describe("googledocs format", () => {
  test("has numbered lists", () => {
    const result = getExportTemplate("googledocs").format(mockNotes);
    expect(result).toContain("1. Chốt launch vào 20/05");
    expect(result).toContain("1. Gửi kế hoạch launch");
    expect(result).toContain("   Người phụ trách: An");
  });
});
