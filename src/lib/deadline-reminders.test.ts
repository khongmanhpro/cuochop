import { describe, expect, test } from "vitest";
import {
  groupReminderCandidatesByEmail,
  parseActionDeadline,
  shouldSendDeadlineReminder,
} from "./deadline-reminders";

describe("deadline reminders", () => {
  test("parses supported deadline formats", () => {
    expect(parseActionDeadline("2026-06-03")?.toISOString()).toBe(
      "2026-06-03T00:00:00.000Z",
    );
    expect(parseActionDeadline("03/06/2026")?.toISOString()).toBe(
      "2026-06-03T00:00:00.000Z",
    );
    expect(parseActionDeadline("Chưa xác định")).toBeNull();
  });

  test("selects due soon or overdue open items and skips duplicates for today", () => {
    const now = new Date("2026-06-01T12:00:00Z");

    expect(
      shouldSendDeadlineReminder({
        deadline: "2026-06-03",
        status: "todo",
        lastReminderSent: null,
        now,
      }),
    ).toBe(true);
    expect(
      shouldSendDeadlineReminder({
        deadline: "2026-06-04",
        status: "todo",
        lastReminderSent: null,
        now,
      }),
    ).toBe(false);
    expect(
      shouldSendDeadlineReminder({
        deadline: "2026-05-31",
        status: "done",
        lastReminderSent: null,
        now,
      }),
    ).toBe(false);
    expect(
      shouldSendDeadlineReminder({
        deadline: "2026-05-31",
        status: "todo",
        lastReminderSent: new Date("2026-06-01T01:00:00Z"),
        now,
      }),
    ).toBe(false);
  });

  test("groups reminder candidates by user email", () => {
    const groups = groupReminderCandidatesByEmail(
      [
        {
          id: "item_1",
          task: "Send recap",
          owner: "An",
          deadline: "2026-06-02",
          status: "todo",
          userId: "user_1",
          userEmail: "a@example.com",
          lastReminderSent: null,
        },
      ],
      new Date("2026-06-01T00:00:00Z"),
    );

    expect(groups.get("a@example.com")).toHaveLength(1);
  });
});
