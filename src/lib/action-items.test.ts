import { describe, expect, test } from "vitest";
import type { VietnameseMeetingNotes } from "./gemini";
import {
  ACTION_ITEM_STATUSES,
  buildActionItemCreatePayloads,
  buildDecisionCreatePayloads,
  computeManagerDigest,
  isActionItemStatus,
  normalizeActionItemUpdate,
} from "./action-items";

const baseNotes: VietnameseMeetingNotes = {
  title: "Weekly Ops",
  executiveSummary: ["Đội thống nhất kế hoạch tuần."],
  meetingOverview: {
    language: "vi",
    duration: "00:30:00",
    speakerCount: 2,
    mainTopic: "Kế hoạch vận hành",
  },
  keyDiscussionPoints: [],
  decisions: ["Chốt launch vào 20/05", "Chưa xác định"],
  actionItems: [
    {
      task: "Gửi kế hoạch launch",
      owner: "An",
      deadline: "20/05/2026",
      priority: "High",
      notes: "Gửi vào nhóm vận hành",
    },
    {
      task: "Chưa xác định",
      owner: "Chưa xác định",
      deadline: "Chưa xác định",
      priority: "Chưa xác định",
      notes: "Chưa xác định",
    },
  ],
  risksAndBlockers: ["Thiếu nội dung landing page"],
  openQuestions: ["Ai duyệt ngân sách ads?"],
  transcript: {
    language: "vi",
    duration: "00:30:00",
    speakers: ["Speaker 1"],
    segments: [],
  },
};

describe("action tracker helpers", () => {
  test("defines allowed statuses", () => {
    expect(ACTION_ITEM_STATUSES).toEqual(["todo", "doing", "done", "blocked"]);
    expect(isActionItemStatus("done")).toBe(true);
    expect(isActionItemStatus("invalid")).toBe(false);
  });

  test("builds action item create payloads and skips placeholder-only items", () => {
    const payloads = buildActionItemCreatePayloads({
      notes: baseNotes,
      meetingNoteId: "meeting-1",
      userId: "user-1",
    });

    expect(payloads).toEqual([
      {
        meetingNoteId: "meeting-1",
        userId: "user-1",
        task: "Gửi kế hoạch launch",
        owner: "An",
        deadline: "20/05/2026",
        priority: "High",
        status: "todo",
        notes: "Gửi vào nhóm vận hành",
      },
    ]);
  });

  test("builds decision create payloads and skips placeholder decisions", () => {
    const payloads = buildDecisionCreatePayloads({
      notes: baseNotes,
      meetingNoteId: "meeting-1",
      userId: "user-1",
    });

    expect(payloads).toEqual([
      {
        meetingNoteId: "meeting-1",
        userId: "user-1",
        content: "Chốt launch vào 20/05",
      },
    ]);
  });

  test("normalizes action item update payload", () => {
    expect(
      normalizeActionItemUpdate({
        owner: "  Bình  ",
        deadline: "21/05/2026",
        priority: "Medium",
        status: "doing",
        notes: "  Cần báo lại trước 17h  ",
      }),
    ).toEqual({
      owner: "Bình",
      deadline: "21/05/2026",
      priority: "Medium",
      status: "doing",
      notes: "Cần báo lại trước 17h",
    });

    expect(() => normalizeActionItemUpdate({ status: "later" })).toThrow(
      "Invalid action item status.",
    );
  });

  test("computes manager digest metrics", () => {
    const digest = computeManagerDigest(
      [
        {
          status: "todo",
          owner: "Chưa xác định",
          deadline: "01/01/2026",
        },
        {
          status: "blocked",
          owner: "An",
          deadline: "Chưa xác định",
        },
        {
          status: "done",
          owner: "Bình",
          deadline: "2026-05-20",
        },
      ],
      new Date("2026-05-15T00:00:00Z"),
    );

    expect(digest).toEqual({
      total: 3,
      open: 2,
      blocked: 1,
      withoutOwner: 1,
      clearlyOverdue: 1,
      done: 1,
      doneRatio: 1 / 3,
    });
  });
});
