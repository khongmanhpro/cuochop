/**
 * Integration tests for /api/generate-notes route.
 *
 * Verifies:
 * - Auth required (401 without session)
 * - Rate limiting (429 after 5 requests/minute)
 * - Input validation (400 for missing model, invalid transcript)
 * - Successful generation creates MeetingNote + ActionItems + Decisions
 * - Audit log entries are created
 * - Usage counter is incremented
 *
 * Gemini API is mocked to avoid real API calls.
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import {
  clearCookies,
  createTestUser,
  getPrisma,
  setAuthCookie,
  setupTestDb,
  teardownTestDb,
} from "./api-test-harness";
import { clearAllRateLimits } from "../lib/rate-limit";

// Mock Gemini API
vi.mock("../lib/gemini", () => ({
  generateVietnameseMeetingNotes: vi.fn().mockResolvedValue({
    title: "Test Meeting Notes",
    executiveSummary: ["Discussed project timeline"],
    meetingOverview: {
      language: "vi",
      duration: "00:10:00",
      speakerCount: 2,
      mainTopic: "Project timeline",
    },
    keyDiscussionPoints: [
      { title: "Timeline", details: ["Demo by Friday"] },
    ],
    decisions: ["Ship demo by Friday"],
    actionItems: [
      {
        task: "Complete demo",
        owner: "Chưa xác định",
        deadline: "Friday",
        priority: "High",
        notes: "Critical",
      },
    ],
    risksAndBlockers: ["Tight deadline"],
    openQuestions: ["Who owns QA?"],
    transcript: {
      language: "vi",
      duration: "00:10:00",
      speakers: ["Speaker 1", "Speaker 2"],
      segments: [
        { start: "00:00:00", speaker: "Speaker 1", text: "Test" },
      ],
    },
  }),
}));

const validTranscript = {
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

describe("/api/generate-notes — integration", () => {
  beforeAll(async () => {
    setupTestDb();
    const { execSync } = await import("node:child_process");
    execSync("npx prisma db push --force-reset", {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      stdio: "pipe",
    });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(() => {
    clearCookies();
    clearAllRateLimits();
  });

  test("returns 401 without auth", async () => {
    const { POST } = await import("../app/api/generate-notes/route");
    const response = await POST(
      new Request("http://localhost/api/generate-notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transcript: validTranscript,
          notesModel: "Gemini 2.5 Flash",
        }),
      }),
    );
    expect(response.status).toBe(401);
  });

  test("returns 400 for missing notesModel", async () => {
    const user = await createTestUser();
    await setAuthCookie(user.id);

    const { POST } = await import("../app/api/generate-notes/route");
    const response = await POST(
      new Request("http://localhost/api/generate-notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transcript: validTranscript,
        }),
      }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_MODEL");
  });

  test("returns 400 for invalid transcript", async () => {
    const user = await createTestUser();
    await setAuthCookie(user.id);

    const { POST } = await import("../app/api/generate-notes/route");
    const response = await POST(
      new Request("http://localhost/api/generate-notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transcript: { language: "en" }, // wrong language
          notesModel: "Gemini 2.5 Flash",
        }),
      }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_TRANSCRIPT");
  });

  test("returns 400 for empty transcript segments", async () => {
    const user = await createTestUser();
    await setAuthCookie(user.id);

    const { POST } = await import("../app/api/generate-notes/route");
    const response = await POST(
      new Request("http://localhost/api/generate-notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transcript: {
            language: "vi",
            duration: "00:10:00",
            speakers: [],
            segments: [],
          },
          notesModel: "Gemini 2.5 Flash",
        }),
      }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_TRANSCRIPT");
  });

  test("successfully generates notes and persists to DB", async () => {
    const user = await createTestUser();
    await setAuthCookie(user.id);
    const prisma = await getPrisma();

    const { POST } = await import("../app/api/generate-notes/route");
    const response = await POST(
      new Request("http://localhost/api/generate-notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transcript: validTranscript,
          notesModel: "Gemini 2.5 Flash",
          originalName: "meeting-2024-01-15.mp3",
        }),
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.notes.title).toBe("Test Meeting Notes");
    expect(body.markdown).toContain("Project timeline"); // mainTopic from notes

    // Verify MeetingNote persisted
    const meetingNotes = await prisma.meetingNote.findMany({
      where: { userId: user.id },
    });
    expect(meetingNotes).toHaveLength(1);
    expect(meetingNotes[0]?.title).toBe("Test Meeting Notes");
    expect(meetingNotes[0]?.audioName).toBe("meeting-2024-01-15.mp3");

    // Verify ActionItems persisted
    const actionItems = await prisma.actionItem.findMany({
      where: { userId: user.id },
    });
    expect(actionItems).toHaveLength(1);
    expect(actionItems[0]?.task).toBe("Complete demo");
    expect(actionItems[0]?.priority).toBe("High");

    // Verify Decisions persisted
    const decisions = await prisma.decision.findMany({
      where: { userId: user.id },
    });
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.content).toBe("Ship demo by Friday");

    // Verify usage counter incremented
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });
    expect(updatedUser?.usageThisMonth).toBe(1);

    // Verify audit log entries
    const auditLogs = await prisma.auditLog.findMany({
      where: { userId: user.id },
    });
    expect(auditLogs.length).toBeGreaterThanOrEqual(3); // MeetingNote + ActionItem + Decision
    const actionTypes = auditLogs.map((log) => log.entityType);
    expect(actionTypes).toContain("MeetingNote");
    expect(actionTypes).toContain("ActionItem");
    expect(actionTypes).toContain("Decision");
  });

  test("rate limits after 5 requests per minute", async () => {
    const user = await createTestUser();
    await setAuthCookie(user.id);

    const { POST } = await import("../app/api/generate-notes/route");
    const requestBody = JSON.stringify({
      transcript: validTranscript,
      notesModel: "Gemini 2.5 Flash",
    });

    // 5 requests should succeed
    for (let i = 0; i < 5; i++) {
      const response = await POST(
        new Request("http://localhost/api/generate-notes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: requestBody,
        }),
      );
      expect(response.status).toBe(200);
    }

    // 6th request should be rate limited
    const response = await POST(
      new Request("http://localhost/api/generate-notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: requestBody,
      }),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
  });
});
