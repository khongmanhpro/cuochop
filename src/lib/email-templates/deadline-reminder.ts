import type { EmailTemplate } from "./base";
import { buttonLink, escapeHtml, renderEmailLayout } from "./base";

export type ReminderTemplateItem = {
  task: string;
  owner: string;
  deadline: string;
  status: string;
};

export function renderDeadlineReminderEmail({
  appUrl,
  items,
  actionUrl = `${appUrl}/actions?filter=deadlines`,
}: {
  appUrl: string;
  items: ReminderTemplateItem[];
  actionUrl?: string;
}): EmailTemplate {
  const title = `${items.length} action item${items.length === 1 ? "" : "s"} need attention`;
  const rows = items
    .map(
      (item) => `<li style="margin:0 0 12px;">
        <strong>${escapeHtml(item.task)}</strong><br />
        <span style="color:#64748b;">${escapeHtml(item.owner)} · ${escapeHtml(item.deadline)} · ${escapeHtml(item.status)}</span>
      </li>`,
    )
    .join("");
  return {
    subject: title,
    html: renderEmailLayout({
      title,
      preview: "Upcoming or overdue action item deadlines.",
      body: `
        <p style="margin:0 0 18px;color:#475569;line-height:1.6;">
          These items are due soon or already past due.
        </p>
        <ul style="margin:0;padding-left:20px;">${rows}</ul>
        ${buttonLink("Review deadlines", actionUrl)}
      `,
    }),
    text: [
      title,
      ...items.map(
        (item) => `${item.task} - ${item.owner} - ${item.deadline} - ${item.status}`,
      ),
      actionUrl,
    ].join("\n"),
  };
}
