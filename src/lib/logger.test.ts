import { afterEach, describe, expect, test, vi } from "vitest";
import { logError, logInfo, logWarn, withErrorLogging } from "./logger";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logger", () => {
  test("logError writes JSON to stderr", () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    logError({ route: "/api/test", message: "something failed", code: "TEST" });
    expect(spy).toHaveBeenCalledOnce();
    const line = (spy.mock.calls[0]?.[0] as string).trim();
    const parsed = JSON.parse(line);
    expect(parsed.level).toBe("error");
    expect(parsed.route).toBe("/api/test");
    expect(parsed.message).toBe("something failed");
    expect(parsed.code).toBe("TEST");
    expect(parsed.timestamp).toBeTruthy();
  });

  test("logWarn writes JSON to stderr", () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    logWarn({ route: "/api/test", message: "warning" });
    const parsed = JSON.parse((spy.mock.calls[0]?.[0] as string).trim());
    expect(parsed.level).toBe("warn");
  });

  test("logInfo writes JSON to stdout", () => {
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    logInfo({ route: "/api/test", message: "info" });
    const parsed = JSON.parse((spy.mock.calls[0]?.[0] as string).trim());
    expect(parsed.level).toBe("info");
  });

  test("withErrorLogging logs and rethrows", async () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    await expect(
      withErrorLogging({ route: "/api/test", message: "wrap" }, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse((spy.mock.calls[0]?.[0] as string).trim());
    expect(parsed.level).toBe("error");
    expect(parsed.message).toBe("boom");
  });

  test("withErrorLogging returns result on success", async () => {
    const result = await withErrorLogging(
      { route: "/api/test", message: "ok" },
      async () => 42,
    );
    expect(result).toBe(42);
  });

  test("does not log prompt content or secrets", () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    logError({
      route: "/api/generate",
      message: "failed",
      userId: "u1",
    });
    const line = (spy.mock.calls[0]?.[0] as string).trim();
    expect(line).not.toContain("prompt");
    expect(line).not.toContain("password");
    expect(line).not.toContain("secret");
  });
});
