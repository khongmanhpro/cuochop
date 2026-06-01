import { describe, expect, test } from "vitest";
import { getSearchResultHref, type SearchResult } from "./global-search";

describe("getSearchResultHref", () => {
  test("routes note results to the source meeting", () => {
    const result: SearchResult = {
      type: "note",
      id: "note-1",
      title: "Weekly",
      snippet: "React",
      meetingDate: "2026-06-01T00:00:00.000Z",
      meetingTitle: "Weekly",
      meetingId: "meeting-1",
    };

    expect(getSearchResultHref(result)).toBe(
      "/history?meeting=meeting-1&highlight=note-1&section=note",
    );
  });

  test("routes decision and action results to the source section", () => {
    const decision: SearchResult = {
      type: "decision",
      id: "decision-1",
      title: "Use React",
      snippet: "Use React",
      meetingDate: "2026-06-01T00:00:00.000Z",
      meetingTitle: "Weekly",
      meetingId: "meeting-1",
    };
    const action: SearchResult = {
      ...decision,
      type: "action",
      id: "action-1",
    };

    expect(getSearchResultHref(decision)).toBe(
      "/actions?meeting=meeting-1&highlight=decision-1&section=decision",
    );
    expect(getSearchResultHref(action)).toBe(
      "/actions?meeting=meeting-1&highlight=action-1&section=action",
    );
  });
});
