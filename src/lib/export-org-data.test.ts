import { describe, expect, test } from "vitest";
import { csvCell, jsonLine } from "./export-org-data";

describe("org export formatting", () => {
  test("escapes CSV cells", () => {
    expect(csvCell('hello, "world"')).toBe('"hello, ""world"""');
  });

  test("formats JSON export records with dataset and data", () => {
    expect(jsonLine("ActionItems", { id: "a1", task: "Ship" })).toBe(
      JSON.stringify({ dataset: "ActionItems", data: { id: "a1", task: "Ship" } }),
    );
  });
});
