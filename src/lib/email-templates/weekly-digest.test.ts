import { describe, expect, test } from "vitest";
import { renderWeeklyDigestEmail } from "./weekly-digest";

describe("renderWeeklyDigestEmail", () => {
  test("renders manager digest metrics and upcoming deadlines", () => {
    const email = renderWeeklyDigestEmail({
      organizationName: "Acme",
      appUrl: "https://app.example.com",
      open: 7,
      blocked: 2,
      overdue: 3,
      donePercentage: 60,
      upcomingDeadlines: [
        {
          task: "Ship launch plan",
          owner: "An",
          deadline: "2026-06-03",
        },
      ],
    });

    expect(email.subject).toContain("Acme");
    expect(email.html).toContain("Open");
    expect(email.html).toContain("7");
    expect(email.html).toContain("Ship launch plan");
    expect(email.text).toContain("https://app.example.com/actions");
  });
});
