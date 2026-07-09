import { describe, expect, test } from "vitest";
import { buildMeetingNoteAccessWhere } from "./meeting-access";

describe("buildMeetingNoteAccessWhere", () => {
  test("scopes personal meetings to userId when no organization", () => {
    expect(
      buildMeetingNoteAccessWhere({
        userId: "user-1",
        organizationId: null,
      }),
    ).toEqual({ userId: "user-1" });
  });

  test("scopes team meetings to organizationId when present", () => {
    expect(
      buildMeetingNoteAccessWhere({
        userId: "user-1",
        organizationId: "org-9",
      }),
    ).toEqual({ organizationId: "org-9" });
  });
});
