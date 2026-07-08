import { appApiError, createApiErrorResponse } from "@/lib/api-errors";
import { getRequestIp, logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { getUserOrganization } from "@/lib/organizations";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const encoder = new TextEncoder();

export async function GET(request: Request) {
  try {
    const user = await getSession();
    if (!user) throw appApiError("UNAUTHENTICATED", "Bạn cần đăng nhập.", 401);

    const activeOrganization = await getUserOrganization(user.id);

    const url = new URL(request.url);
    const format = url.searchParams.get("format") === "markdown" ? "markdown" : "json";

    await logAudit({
      organizationId: activeOrganization?.id ?? null,
      userId: user.id,
      action: "export",
      entityType: "Personal",
      entityId: user.id,
      after: { format },
      ipAddress: getRequestIp(request),
    });

    const scope = activeOrganization
      ? { organizationId: activeOrganization.id }
      : { userId: user.id };

    if (format === "markdown") {
      const markdown = await buildMarkdownExport(scope);
      return new Response(encoder.encode(markdown), {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": 'attachment; filename="cuochop-export.md"',
        },
      });
    }

    const data = await buildJsonExport(scope);
    return new Response(encoder.encode(JSON.stringify(data, null, 2)), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="cuochop-export.json"',
      },
    });
  } catch (error) {
    return createApiErrorResponse(error, {
      route: "/api/export/personal",
      fallbackCode: "INTERNAL_ERROR",
      fallbackMessage: "Không thể export dữ liệu.",
    });
  }
}

type Scope = { organizationId: string } | { userId: string };

async function buildJsonExport(scope: Scope) {
  const [meetingNotes, actionItems, decisions] = await Promise.all([
    prisma.meetingNote.findMany({
      where: scope,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        audioName: true,
        notesJson: true,
        createdAt: true,
      },
    }),
    prisma.actionItem.findMany({
      where: scope,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        task: true,
        ownerId: true,
        deadline: true,
        priority: true,
        status: true,
        notes: true,
        meetingNoteId: true,
        createdAt: true,
      },
    }),
    prisma.decision.findMany({
      where: scope,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        content: true,
        meetingNoteId: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    meetingNotes: meetingNotes.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    })),
    actionItems: actionItems.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
    decisions: decisions.map((d) => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
    })),
  };
}

async function buildMarkdownExport(scope: Scope): Promise<string> {
  const [meetingNotes, actionItems, decisions] = await Promise.all([
    prisma.meetingNote.findMany({
      where: scope,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        audioName: true,
        notesJson: true,
        createdAt: true,
      },
    }),
    prisma.actionItem.findMany({
      where: scope,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        task: true,
        deadline: true,
        priority: true,
        status: true,
        notes: true,
        meetingNoteId: true,
        createdAt: true,
      },
    }),
    prisma.decision.findMany({
      where: scope,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        content: true,
        meetingNoteId: true,
        createdAt: true,
      },
    }),
  ]);

  const lines: string[] = [
    "# cuochop — Personal Data Export",
    "",
    `Exported: ${new Date().toISOString()}`,
    "",
    "---",
    "",
  ];

  // Meetings
  lines.push("## Meetings", "");
  for (const note of meetingNotes) {
    const date = formatDate(note.createdAt);
    lines.push(`### ${note.title} (${date})`);
    lines.push(`Audio: ${note.audioName}`);
    try {
      const parsed = JSON.parse(note.notesJson) as Record<string, unknown>;
      const summary = parsed.executiveSummary;
      if (Array.isArray(summary) && summary.length > 0) {
        lines.push("");
        lines.push("**Summary:**");
        for (const s of summary) lines.push(`- ${s}`);
      }
    } catch {
      // skip malformed
    }
    lines.push("");
  }

  // Decisions
  lines.push("## Decisions", "");
  if (decisions.length === 0) {
    lines.push("_No decisions recorded._", "");
  } else {
    for (const d of decisions) {
      const date = formatDate(d.createdAt);
      lines.push(`- ${d.content} _(${date})_`);
    }
    lines.push("");
  }

  // Action items
  lines.push("## Action Items", "");
  if (actionItems.length === 0) {
    lines.push("_No action items._", "");
  } else {
    for (const a of actionItems) {
      const date = formatDate(a.createdAt);
      const parts = [
        `[${a.priority}] ${a.task}`,
        `Status: ${a.status}`,
        a.deadline !== "Chưa xác định" ? `Deadline: ${a.deadline}` : null,
        a.notes ? `Notes: ${a.notes}` : null,
        `(${date})`,
      ].filter(Boolean);
      lines.push(`- ${parts.join(" - ")}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}
