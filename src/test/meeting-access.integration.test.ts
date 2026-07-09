/**
 * Integration tests for meeting access + rename/delete server actions.
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
  seedActionItem,
  seedMeetingNote,
  setAuthCookie,
  setupTestDb,
  teardownTestDb,
} from "./api-test-harness";

// next/cache + navigation used by server actions
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const redirectMock = vi.fn((url: string) => {
  const error = new Error(`NEXT_REDIRECT:${url}`);
  // mimic next redirect digest so callers can detect it if needed
  (error as Error & { digest?: string }).digest = `NEXT_REDIRECT;replace;${url}`;
  throw error;
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

describe("meeting access + history actions — integration", () => {
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
    redirectMock.mockClear();
  });

  afterEach(() => {
    clearCookies();
  });

  test("findAccessibleMeetingNote returns own meeting", async () => {
    const user = await createTestUser();
    const meeting = await seedMeetingNote(user.id, { title: "Own meeting" });
    await setAuthCookie(user.id);

    const { findAccessibleMeetingNote } = await import("../lib/meeting-access");
    const found = await findAccessibleMeetingNote(user.id, meeting.id);

    expect(found?.id).toBe(meeting.id);
    expect(found?.title).toBe("Own meeting");
  });

  test("findAccessibleMeetingNote hides another user's meeting", async () => {
    const owner = await createTestUser({ email: "owner@test.com" });
    const other = await createTestUser({ email: "other@test.com" });
    const meeting = await seedMeetingNote(owner.id, { title: "Secret" });

    const { findAccessibleMeetingNote } = await import("../lib/meeting-access");
    const found = await findAccessibleMeetingNote(other.id, meeting.id);

    expect(found).toBeNull();
  });

  test("renameMeetingNote updates title for owner", async () => {
    const user = await createTestUser();
    const meeting = await seedMeetingNote(user.id, { title: "Old title" });
    await setAuthCookie(user.id);

    const { renameMeetingNote } = await import(
      "../app/(app)/history/actions"
    );

    const formData = new FormData();
    formData.set("meetingId", meeting.id);
    formData.set("title", "New title");

    const result = await renameMeetingNote({}, formData);
    expect(result.success).toBeTruthy();
    expect(result.error).toBeUndefined();

    const prisma = await getPrisma();
    const updated = await prisma.meetingNote.findUnique({
      where: { id: meeting.id },
    });
    expect(updated?.title).toBe("New title");
  });

  test("renameMeetingNote rejects empty title", async () => {
    const user = await createTestUser();
    const meeting = await seedMeetingNote(user.id);
    await setAuthCookie(user.id);

    const { renameMeetingNote } = await import(
      "../app/(app)/history/actions"
    );

    const formData = new FormData();
    formData.set("meetingId", meeting.id);
    formData.set("title", "   ");

    const result = await renameMeetingNote({}, formData);
    expect(result.error).toMatch(/không được để trống/i);
  });

  test("renameMeetingNote rejects non-owner", async () => {
    const owner = await createTestUser({ email: "owner2@test.com" });
    const other = await createTestUser({ email: "other2@test.com" });
    const meeting = await seedMeetingNote(owner.id, { title: "Locked" });
    await setAuthCookie(other.id);

    const { renameMeetingNote } = await import(
      "../app/(app)/history/actions"
    );

    const formData = new FormData();
    formData.set("meetingId", meeting.id);
    formData.set("title", "Hacked");

    const result = await renameMeetingNote({}, formData);
    expect(result.error).toMatch(/không có quyền|không tìm thấy/i);

    const prisma = await getPrisma();
    const unchanged = await prisma.meetingNote.findUnique({
      where: { id: meeting.id },
    });
    expect(unchanged?.title).toBe("Locked");
  });

  test("deleteMeetingNote cascades action items and redirects", async () => {
    const user = await createTestUser();
    const meeting = await seedMeetingNote(user.id, { title: "To delete" });
    const action = await seedActionItem(meeting.id, user.id, {
      task: "Child action",
    });
    await setAuthCookie(user.id);

    const { deleteMeetingNote } = await import(
      "../app/(app)/history/actions"
    );

    const formData = new FormData();
    formData.set("meetingId", meeting.id);

    await expect(deleteMeetingNote(formData)).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith("/history");

    const prisma = await getPrisma();
    const deletedMeeting = await prisma.meetingNote.findUnique({
      where: { id: meeting.id },
    });
    const deletedAction = await prisma.actionItem.findUnique({
      where: { id: action.id },
    });
    expect(deletedMeeting).toBeNull();
    expect(deletedAction).toBeNull();
  });

  test("deleteMeetingNote rejects non-owner", async () => {
    const owner = await createTestUser({ email: "owner3@test.com" });
    const other = await createTestUser({ email: "other3@test.com" });
    const meeting = await seedMeetingNote(owner.id, { title: "Stay" });
    await setAuthCookie(other.id);

    const { deleteMeetingNote } = await import(
      "../app/(app)/history/actions"
    );

    const formData = new FormData();
    formData.set("meetingId", meeting.id);

    await expect(deleteMeetingNote(formData)).rejects.toThrow(
      /không tìm thấy|không có quyền/i,
    );

    const prisma = await getPrisma();
    const stillThere = await prisma.meetingNote.findUnique({
      where: { id: meeting.id },
    });
    expect(stillThere?.title).toBe("Stay");
  });

  test("updateMeetingNotesContent saves notesJson and syncs decisions", async () => {
    const user = await createTestUser({ email: "editor@test.com" });
    const prisma = await getPrisma();

    const fullNotes = {
      title: "Editable",
      executiveSummary: ["Cũ"],
      meetingOverview: {
        language: "vi",
        duration: "00:05:00",
        speakerCount: 1,
        mainTopic: "Cũ",
      },
      keyDiscussionPoints: [{ title: "P", details: ["D"] }],
      decisions: ["QĐ cũ"],
      actionItems: [
        {
          task: "Keep action",
          owner: "A",
          deadline: "Mai",
          priority: "Medium",
          notes: "",
        },
      ],
      risksAndBlockers: ["R cũ"],
      openQuestions: ["H cũ"],
      transcript: {
        language: "vi",
        duration: "00:05:00",
        speakers: ["Speaker 1"],
        segments: [
          { start: "00:00:00", speaker: "Speaker 1", text: "Hello" },
        ],
      },
    };

    const meeting = await prisma.meetingNote.create({
      data: {
        userId: user.id,
        title: "Editable",
        audioName: "edit.mp3",
        notesJson: JSON.stringify(fullNotes),
        markdown: "# Editable",
      },
    });

    await prisma.decision.create({
      data: {
        meetingNoteId: meeting.id,
        userId: user.id,
        content: "QĐ cũ",
      },
    });

    await setAuthCookie(user.id);

    const { updateMeetingNotesContent } = await import(
      "../app/(app)/history/actions"
    );

    const formData = new FormData();
    formData.set("meetingId", meeting.id);
    formData.set("mainTopic", "Chủ đề mới");
    formData.set("executiveSummary", "Ý mới 1\nÝ mới 2");
    formData.set("decisions", "Quyết định mới");
    formData.set("risksAndBlockers", "Rủi ro mới");
    formData.set("openQuestions", "Câu hỏi mới");

    const result = await updateMeetingNotesContent({}, formData);
    expect(result.success).toBeTruthy();
    expect(result.error).toBeUndefined();

    const updated = await prisma.meetingNote.findUnique({
      where: { id: meeting.id },
    });
    const parsed = JSON.parse(updated!.notesJson);
    expect(parsed.meetingOverview.mainTopic).toBe("Chủ đề mới");
    expect(parsed.executiveSummary).toEqual(["Ý mới 1", "Ý mới 2"]);
    expect(parsed.decisions).toEqual(["Quyết định mới"]);
    expect(parsed.actionItems[0].task).toBe("Keep action");
    expect(updated!.markdown).toContain("Ý mới 1");

    const decisions = await prisma.decision.findMany({
      where: { meetingNoteId: meeting.id },
    });
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.content).toBe("Quyết định mới");
  });

  test("updateMeetingTags stores tags in notesJson", async () => {
    const user = await createTestUser({ email: "tagger@test.com" });
    const meeting = await seedMeetingNote(user.id, { title: "Tagged" });
    await setAuthCookie(user.id);

    const { updateMeetingTags } = await import(
      "../app/(app)/history/actions"
    );
    const formData = new FormData();
    formData.set("meetingId", meeting.id);
    formData.set("tags", "weekly, client");

    const result = await updateMeetingTags({}, formData);
    expect(result.success).toBeTruthy();

    const prisma = await getPrisma();
    const updated = await prisma.meetingNote.findUnique({
      where: { id: meeting.id },
    });
    const tags = JSON.parse(updated!.notesJson).tags;
    expect(tags).toEqual(["weekly", "client"]);
  });

  test("renameMeetingSpeakers updates transcript speakers", async () => {
    const user = await createTestUser({ email: "speaker@test.com" });
    const prisma = await getPrisma();
    const notes = {
      title: "Call",
      executiveSummary: ["Hi"],
      meetingOverview: {
        language: "vi",
        duration: "00:01:00",
        speakerCount: 1,
        mainTopic: "Call",
      },
      keyDiscussionPoints: [],
      decisions: [],
      actionItems: [],
      risksAndBlockers: [],
      openQuestions: [],
      transcript: {
        language: "vi",
        duration: "00:01:00",
        speakers: ["Speaker 1"],
        segments: [
          { start: "00:00:00", speaker: "Speaker 1", text: "Xin chào" },
        ],
      },
    };
    const meeting = await prisma.meetingNote.create({
      data: {
        userId: user.id,
        title: "Call",
        audioName: "a.mp3",
        notesJson: JSON.stringify(notes),
        markdown: "# Call",
      },
    });
    await setAuthCookie(user.id);

    const { renameMeetingSpeakers } = await import(
      "../app/(app)/history/actions"
    );
    const formData = new FormData();
    formData.set("meetingId", meeting.id);
    formData.set("speaker:Speaker 1", "An");

    const result = await renameMeetingSpeakers({}, formData);
    expect(result.success).toBeTruthy();

    const updated = await prisma.meetingNote.findUnique({
      where: { id: meeting.id },
    });
    const parsed = JSON.parse(updated!.notesJson);
    expect(parsed.transcript.speakers).toEqual(["An"]);
    expect(parsed.transcript.segments[0].speaker).toBe("An");
  });

  test("updateMeetingNotesContent rejects non-owner", async () => {
    const owner = await createTestUser({ email: "owner-edit@test.com" });
    const other = await createTestUser({ email: "other-edit@test.com" });
    const meeting = await seedMeetingNote(owner.id, { title: "No touch" });
    await setAuthCookie(other.id);

    const { updateMeetingNotesContent } = await import(
      "../app/(app)/history/actions"
    );

    const formData = new FormData();
    formData.set("meetingId", meeting.id);
    formData.set("mainTopic", "Hack");
    formData.set("executiveSummary", "x");
    formData.set("decisions", "y");
    formData.set("risksAndBlockers", "z");
    formData.set("openQuestions", "w");

    const result = await updateMeetingNotesContent({}, formData);
    expect(result.error).toMatch(/không có quyền|không tìm thấy/i);
  });
});
