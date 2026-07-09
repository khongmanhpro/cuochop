import { describe, expect, test } from "vitest";
import type { VietnameseMeetingNotes } from "./gemini";
import {
  ACTION_ITEM_STATUSES,
  buildActionItemCreatePayloads,
  buildDecisionCreatePayloads,
  computeManagerDigest,
  isActionItemStatus,
  normalizeActionItemCreate,
  normalizeActionItemUpdate,
  normalizeDeadlineInput,
  resolveOwnerId,
  toDateInputValue,
} from "./action-items";
import type { MatchableMember } from "./action-items";

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
      organizationId: "org-1",
    });

    expect(payloads).toEqual([
      {
        meetingNoteId: "meeting-1",
        userId: "user-1",
        organizationId: "org-1",
        task: "Gửi kế hoạch launch",
        ownerId: null,
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
      organizationId: "org-1",
    });

    expect(payloads).toEqual([
      {
        meetingNoteId: "meeting-1",
        userId: "user-1",
        organizationId: "org-1",
        content: "Chốt launch vào 20/05",
      },
    ]);
  });

  test("normalizes action item update payload", () => {
    expect(
      normalizeActionItemUpdate({
        ownerId: " user-2 ",
        deadline: "21/05/2026",
        priority: "Medium",
        status: "doing",
        notes: "  Cần báo lại trước 17h  ",
      }),
    ).toEqual({
      ownerId: "user-2",
      deadline: "2026-05-21",
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
          ownerId: null,
          deadline: "01/01/2026",
        },
        {
          status: "blocked",
          ownerId: "user-1",
          deadline: "Chưa xác định",
        },
        {
          status: "done",
          ownerId: "user-2",
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

  test("computes manager digest metrics for a single organization", () => {
    const digest = computeManagerDigest(
      [
        {
          status: "todo",
          ownerId: "user-1",
          deadline: "01/01/2026",
          organizationId: "org-1",
        },
        {
          status: "blocked",
          ownerId: "user-2",
          deadline: "Chưa xác định",
          organizationId: "org-2",
        },
      ],
      new Date("2026-05-15T00:00:00Z"),
      "org-1",
    );

    expect(digest).toMatchObject({
      total: 1,
      open: 1,
      blocked: 0,
      clearlyOverdue: 1,
    });
  });
});

describe("resolveOwnerId", () => {
  const members: MatchableMember[] = [
    { id: "u1", name: "Nguyễn Văn An", email: "an@example.com" },
    { id: "u2", name: "Trần Thị Bình", email: "binh@example.com" },
    { id: "u3", name: "Lê Minh", email: "leminh@example.com" },
  ];

  test("returns null for empty or placeholder text", () => {
    expect(resolveOwnerId("", members)).toBeNull();
    expect(resolveOwnerId("  ", members)).toBeNull();
    expect(resolveOwnerId("Chưa xác định", members)).toBeNull();
  });

  test("exact name match (case-insensitive)", () => {
    expect(resolveOwnerId("Nguyễn Văn An", members)).toBe("u1");
    expect(resolveOwnerId("nguyễn văn an", members)).toBe("u1");
  });

  test("exact email match", () => {
    expect(resolveOwnerId("binh@example.com", members)).toBe("u2");
  });

  test("substring match — owner text in member name", () => {
    expect(resolveOwnerId("An", members)).toBe("u1");
    expect(resolveOwnerId("Bình", members)).toBe("u2");
    expect(resolveOwnerId("Minh", members)).toBe("u3");
  });

  test("reverse substring — member name in owner text", () => {
    expect(resolveOwnerId("An - Dev Lead", members)).toBe("u1");
    expect(resolveOwnerId("Trần Thị Bình (QA)", members)).toBe("u2");
  });

  test("returns null when no match found", () => {
    expect(resolveOwnerId("Unknown Person", members)).toBeNull();
    expect(resolveOwnerId("XYZ", members)).toBeNull();
  });

  test("returns null when members list is empty", () => {
    expect(resolveOwnerId("An", [])).toBeNull();
  });
});

describe("buildActionItemCreatePayloads with orgMembers", () => {
  test("resolves ownerId when orgMembers provided", () => {
    const members: MatchableMember[] = [
      { id: "u1", name: "An", email: "an@example.com" },
    ];

    const payloads = buildActionItemCreatePayloads({
      notes: baseNotes,
      meetingNoteId: "meeting-1",
      userId: "user-1",
      organizationId: "org-1",
      orgMembers: members,
    });

    expect(payloads).toHaveLength(1);
    expect(payloads[0].ownerId).toBe("u1");
  });

  test("keeps ownerId null when no orgMembers provided", () => {
    const payloads = buildActionItemCreatePayloads({
      notes: baseNotes,
      meetingNoteId: "meeting-1",
      userId: "user-1",
      organizationId: "org-1",
    });

    expect(payloads[0].ownerId).toBeNull();
  });

  test("keeps ownerId null when no match found", () => {
    const members: MatchableMember[] = [
      { id: "u99", name: "Phạm Đức", email: "duc@example.com" },
    ];

    const payloads = buildActionItemCreatePayloads({
      notes: baseNotes,
      meetingNoteId: "meeting-1",
      userId: "user-1",
      organizationId: "org-1",
      orgMembers: members,
    });

    expect(payloads[0].ownerId).toBeNull();
  });
});

describe("deadline + create/update helpers", () => {
  test("normalizeDeadlineInput keeps ISO dates", () => {
    expect(normalizeDeadlineInput("2026-07-15")).toBe("2026-07-15");
  });

  test("normalizeDeadlineInput parses Vietnamese day/month", () => {
    expect(normalizeDeadlineInput("15/7/2026")).toBe("2026-07-15");
  });

  test("toDateInputValue returns empty for free text", () => {
    expect(toDateInputValue("cuối tuần")).toBe("");
    expect(toDateInputValue("2026-07-15")).toBe("2026-07-15");
  });

  test("normalizeActionItemCreate requires task", () => {
    expect(() => normalizeActionItemCreate({ task: "" })).toThrow();
    expect(normalizeActionItemCreate({ task: "Gửi báo giá", deadline: "2026-08-01" })).toMatchObject({
      task: "Gửi báo giá",
      deadline: "2026-08-01",
      priority: "Medium",
      status: "todo",
    });
  });

  test("normalizeActionItemUpdate accepts task field", () => {
    expect(
      normalizeActionItemUpdate({ task: "Updated task", deadline: "2026-09-01" }),
    ).toEqual({
      task: "Updated task",
      deadline: "2026-09-01",
    });
  });
});
