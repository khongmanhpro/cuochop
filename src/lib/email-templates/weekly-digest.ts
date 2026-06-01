import type { EmailTemplate } from "./base";
import { buttonLink, escapeHtml, metricCard, renderEmailLayout } from "./base";

export type DigestTemplateItem = {
  task: string;
  owner: string;
  deadline: string;
};

export function renderWeeklyDigestEmail({
  organizationName,
  appUrl,
  open,
  blocked,
  overdue,
  donePercentage,
  upcomingDeadlines,
}: {
  organizationName: string;
  appUrl: string;
  open: number;
  blocked: number;
  overdue: number;
  donePercentage: number;
  upcomingDeadlines: DigestTemplateItem[];
}): EmailTemplate {
  const title = `${organizationName} weekly manager digest`;
  const deadlineRows =
    upcomingDeadlines.length > 0
      ? upcomingDeadlines
          .map(
            (item) => `<li style="margin:0 0 10px;">
              <strong>${escapeHtml(item.task)}</strong><br />
              <span style="color:#64748b;">${escapeHtml(item.owner)} · ${escapeHtml(item.deadline)}</span>
            </li>`,
          )
          .join("")
      : `<li style="color:#64748b;">No upcoming deadlines found.</li>`;

  const html = renderEmailLayout({
    title,
    preview: `${open} open actions, ${blocked} blocked, ${overdue} overdue.`,
    body: `
      <p style="margin:0 0 20px;color:#475569;line-height:1.6;">
        Here's the team follow-through snapshot for this week.
      </p>
      <table role="presentation" cellspacing="8" cellpadding="0" style="width:100%;border-collapse:separate;margin:0 0 22px;">
        <tr>
          ${metricCard("Open", open)}
          ${metricCard("Blocked", blocked)}
          ${metricCard("Overdue", overdue)}
          ${metricCard("Done", `${donePercentage}%`)}
        </tr>
      </table>
      <h2 style="font-size:16px;margin:0 0 12px;">Top upcoming deadlines</h2>
      <ol style="margin:0;padding-left:20px;color:#0f172a;">${deadlineRows}</ol>
      ${buttonLink("Open Action Board", `${appUrl}/actions`)}
    `,
  });

  return {
    subject: title,
    html,
    text: [
      title,
      `${open} open actions`,
      `${blocked} blocked`,
      `${overdue} overdue`,
      `${donePercentage}% done`,
      "Top upcoming deadlines:",
      ...upcomingDeadlines.map(
        (item) => `${item.task} - ${item.owner} - ${item.deadline}`,
      ),
      `${appUrl}/actions`,
    ].join("\n"),
  };
}
