import { describe, expect, test } from "vitest";
import {
  applyTagsToNotesJson,
  notesMatchTag,
  parseTagsInput,
  tagsFromNotesJson,
} from "./meeting-tags";

describe("meeting tags", () => {
  test("parseTagsInput normalizes and dedupes", () => {
    expect(parseTagsInput("Khách hàng, weekly, khách hàng\nHiring")).toEqual([
      "khách hàng",
      "weekly",
      "hiring",
    ]);
  });

  test("apply and read tags on notesJson", () => {
    const base = JSON.stringify({ title: "M", executiveSummary: [] });
    const next = applyTagsToNotesJson(base, ["weekly", "client"]);
    expect(tagsFromNotesJson(next)).toEqual(["weekly", "client"]);
    expect(notesMatchTag(next, "weekly")).toBe(true);
    expect(notesMatchTag(next, "other")).toBe(false);
  });
});
