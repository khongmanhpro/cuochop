import { createHmac } from "node:crypto";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { VietnameseMeetingNotes } from "./gemini";
import {
  buildDeadlineReminderBlocks,
  buildFollowUpBriefBlocks,
  createSlackOAuthState,
  parseSlackOAuthState,
  decryptSlackToken,
  encryptSlackToken,
  parseSlackDeadlineAction,
  verifySlackRequestSignature,
} from "./slack";

const key = "12345678901234567890123456789012";

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
  openQuestions: [],
  transcript: {
    language: "vi",
    duration: "00:25:00",
    speakers: ["Speaker 1"],
    segments: [],
  },
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Slack token encryption", () => {
  test("round-trips a token without storing it as plaintext", () => {
    vi.stubEnv("SLACK_TOKEN_ENCRYPTION_KEY", key);

    const encrypted = encryptSlackToken("xoxb-secret-token");

    expect(encrypted).not.toContain("xoxb-secret-token");
    expect(decryptSlackToken(encrypted)).toBe("xoxb-secret-token");
  });
});

describe("Slack request verification", () => {
  test("accepts valid Slack signatures", () => {
    const body = "payload=%7B%22type%22%3A%22block_actions%22%7D";
    const timestamp = "1760000000";
    const base = `v0:${timestamp}:${body}`;
    const signature = `v0=${createHmac("sha256", "signing-secret")
      .update(base)
      .digest("hex")}`;

    expect(
      verifySlackRequestSignature({
        body,
        timestamp,
        signature,
        signingSecret: "signing-secret",
        now: new Date(Number(timestamp) * 1000 + 1000),
      }),
    ).toBe(true);
  });

  test("rejects stale Slack signatures", () => {
    expect(
      verifySlackRequestSignature({
        body: "payload={}",
        timestamp: "100",
        signature: "v0=bad",
        signingSecret: "signing-secret",
        now: new Date(1_000_000),
      }),
    ).toBe(false);
  });
});

describe("Slack OAuth state", () => {
  test("round-trips organization and user ids with a signature", () => {
    vi.stubEnv("SESSION_SECRET", "12345678901234567890123456789012");

    const state = createSlackOAuthState({
      organizationId: "org-1",
      userId: "user-1",
    });

    expect(parseSlackOAuthState(state)).toEqual({
      organizationId: "org-1",
      userId: "user-1",
    });
  });
});

describe("Slack Block Kit formatting", () => {
  test("builds follow-up brief blocks with decisions, actions, blockers, and link", () => {
    const blocks = buildFollowUpBriefBlocks(notes, "https://app.example/history?meeting=1");

    expect(JSON.stringify(blocks)).toContain("Decisions");
    expect(JSON.stringify(blocks)).toContain("Chốt launch vào 20/05");
    expect(JSON.stringify(blocks)).toContain("Action items");
    expect(JSON.stringify(blocks)).toContain("Thiếu nội dung landing page");
    expect(JSON.stringify(blocks)).toContain("https://app.example/history?meeting=1");
  });

  test("builds deadline reminder action buttons with action item ids", () => {
    const blocks = buildDeadlineReminderBlocks([
      {
        id: "action-1",
        task: "Gửi kế hoạch launch",
        owner: "An",
        deadline: "20/05/2026",
        status: "todo",
      },
    ]);

    const payload = JSON.stringify(blocks);
    expect(payload).toContain("deadline_done:action-1");
    expect(payload).toContain("deadline_snooze:action-1");
    expect(payload).toContain("deadline_blocked:action-1");
  });
});

describe("Slack deadline action parsing", () => {
  test("parses supported deadline reminder actions", () => {
    expect(parseSlackDeadlineAction("deadline_done:action-1")).toEqual({
      action: "done",
      actionItemId: "action-1",
    });
    expect(parseSlackDeadlineAction("deadline_snooze:action-2")).toEqual({
      action: "snooze",
      actionItemId: "action-2",
    });
    expect(parseSlackDeadlineAction("deadline_blocked:action-3")).toEqual({
      action: "blocked",
      actionItemId: "action-3",
    });
  });
});
