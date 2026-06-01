export type EmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

export function renderEmailLayout({
  title,
  preview,
  body,
}: {
  title: string;
  preview: string;
  body: string;
}) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preview)}</div>
    <main style="max-width:640px;margin:0 auto;padding:32px 16px;">
      <section style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px;">
        <p style="margin:0 0 8px;color:#1d4ed8;font-size:12px;font-weight:700;text-transform:uppercase;">cuochop</p>
        <h1 style="margin:0 0 20px;font-size:24px;line-height:1.25;">${escapeHtml(title)}</h1>
        ${body}
      </section>
      <p style="margin:16px 0 0;text-align:center;color:#64748b;font-size:12px;">
        Sent by cuochop.
      </p>
    </main>
  </body>
</html>`;
}

export function metricCard(label: string, value: string | number) {
  return `<td style="width:25%;padding:10px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;">
    <p style="margin:0;color:#64748b;font-size:12px;">${escapeHtml(label)}</p>
    <p style="margin:4px 0 0;font-size:22px;font-weight:700;">${escapeHtml(String(value))}</p>
  </td>`;
}

export function buttonLink(label: string, href: string) {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;margin-top:20px;border-radius:8px;background:#1d4ed8;color:#fff;text-decoration:none;padding:10px 14px;font-weight:700;font-size:14px;">${escapeHtml(label)}</a>`;
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
