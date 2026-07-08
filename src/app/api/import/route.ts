import { appApiError, createApiErrorResponse } from "@/lib/api-errors";
import { getRequestIp, logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { getUserOrganization } from "@/lib/organizations";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getSession();
    if (!user) throw appApiError("UNAUTHENTICATED", "Bạn cần đăng nhập.", 401);

    const activeOrganization = await getUserOrganization(user.id);

    const body: unknown = await request.json();
    const parsed = validateImportData(body);

    if (parsed.errors.length > 0) {
      throw appApiError(
        "INTERNAL_ERROR",
        `Dữ liệu import không hợp lệ: ${parsed.errors.join("; ")}`,
        400,
      );
    }

    const orgId = activeOrganization?.id ?? null;

    const imported = { meetings: 0, actions: 0, decisions: 0 };

    // Import meetings
    for (const note of parsed.meetingNotes) {
      const existing = await prisma.meetingNote.findFirst({
        where: { id: note.id, userId: user.id },
        select: { id: true },
      });
      if (!existing) {
        // Generate markdown from notesJson
        let markdown = "";
        try {
          const parsedNotes = JSON.parse(note.notesJson) as Record<string, unknown>;
          const summary = Array.isArray(parsedNotes.executiveSummary)
            ? (parsedNotes.executiveSummary as string[]).join("\n")
            : "";
          markdown = `# ${note.title}\n\n${summary}`;
        } catch {
          markdown = `# ${note.title}`;
        }

        if (orgId) {
          await prisma.meetingNote.create({
            data: { id: note.id, title: note.title, audioName: note.audioName, notesJson: note.notesJson, markdown, createdAt: new Date(note.createdAt), userId: user.id, organizationId: orgId },
          });
        } else {
          await prisma.meetingNote.create({
            data: { id: note.id, title: note.title, audioName: note.audioName, notesJson: note.notesJson, markdown, createdAt: new Date(note.createdAt), userId: user.id },
          });
        }
        imported.meetings++;
      }
    }

    // Import decisions
    for (const decision of parsed.decisions) {
      const existing = await prisma.decision.findFirst({
        where: { id: decision.id },
        select: { id: true },
      });
      if (!existing) {
        const meetingExists = await prisma.meetingNote.findFirst({
          where: { id: decision.meetingNoteId, userId: user.id },
          select: { id: true },
        });
        if (meetingExists) {
          if (orgId) {
            await prisma.decision.create({
              data: { id: decision.id, content: decision.content, meetingNoteId: decision.meetingNoteId, createdAt: new Date(decision.createdAt), userId: user.id, organizationId: orgId },
            });
          } else {
            await prisma.decision.create({
              data: { id: decision.id, content: decision.content, meetingNoteId: decision.meetingNoteId, createdAt: new Date(decision.createdAt), userId: user.id },
            });
          }
          imported.decisions++;
        }
      }
    }

    // Import action items
    for (const action of parsed.actionItems) {
      const existing = await prisma.actionItem.findFirst({
        where: { id: action.id },
        select: { id: true },
      });
      if (!existing) {
        const meetingExists = await prisma.meetingNote.findFirst({
          where: { id: action.meetingNoteId, userId: user.id },
          select: { id: true },
        });
        if (meetingExists) {
          if (orgId) {
            await prisma.actionItem.create({
              data: { id: action.id, task: action.task, ownerId: action.ownerId, deadline: action.deadline, priority: action.priority, status: action.status, notes: action.notes, meetingNoteId: action.meetingNoteId, createdAt: new Date(action.createdAt), userId: user.id, organizationId: orgId },
            });
          } else {
            await prisma.actionItem.create({
              data: { id: action.id, task: action.task, ownerId: action.ownerId, deadline: action.deadline, priority: action.priority, status: action.status, notes: action.notes, meetingNoteId: action.meetingNoteId, createdAt: new Date(action.createdAt), userId: user.id },
            });
          }
          imported.actions++;
        }
      }
    }

    await logAudit({
      organizationId: activeOrganization?.id ?? null,
      userId: user.id,
      action: "create",
      entityType: "Personal",
      entityId: user.id,
      after: imported,
      ipAddress: getRequestIp(request),
    });

    return Response.json({ ok: true, imported });
  } catch (error) {
    return createApiErrorResponse(error, {
      route: "/api/import",
      fallbackCode: "INTERNAL_ERROR",
      fallbackMessage: "Không thể import dữ liệu.",
    });
  }
}

type ImportMeetingNote = {
  id: string;
  title: string;
  audioName: string;
  notesJson: string;
  createdAt: string;
};

type ImportActionItem = {
  id: string;
  task: string;
  ownerId: string | null;
  deadline: string;
  priority: string;
  status: string;
  notes: string;
  meetingNoteId: string;
  createdAt: string;
};

type ImportDecision = {
  id: string;
  content: string;
  meetingNoteId: string;
  createdAt: string;
};

type ImportResult = {
  meetingNotes: ImportMeetingNote[];
  actionItems: ImportActionItem[];
  decisions: ImportDecision[];
  errors: string[];
};

function validateImportData(body: unknown): ImportResult {
  const errors: string[] = [];
  const result: ImportResult = {
    meetingNotes: [],
    actionItems: [],
    decisions: [],
    errors,
  };

  if (typeof body !== "object" || body === null) {
    errors.push("Body phải là JSON object");
    return result;
  }

  const record = body as Record<string, unknown>;

  // Validate meetingNotes
  if (!Array.isArray(record.meetingNotes)) {
    errors.push("meetingNotes phải là array");
  } else {
    for (const [i, note] of record.meetingNotes.entries()) {
      if (!isString(note, "id") || !isString(note, "title") || !isString(note, "notesJson")) {
        errors.push(`meetingNotes[${i}]: thiếu id/title/notesJson`);
      } else {
        result.meetingNotes.push({
          id: note.id as string,
          title: note.title as string,
          audioName: (note.audioName as string) ?? "unknown",
          notesJson: note.notesJson as string,
          createdAt: isString(note, "createdAt") ? (note.createdAt as string) : new Date().toISOString(),
        });
      }
    }
  }

  // Validate actionItems
  if (!Array.isArray(record.actionItems)) {
    errors.push("actionItems phải là array");
  } else {
    for (const [i, action] of record.actionItems.entries()) {
      if (!isString(action, "id") || !isString(action, "task") || !isString(action, "meetingNoteId")) {
        errors.push(`actionItems[${i}]: thiếu id/task/meetingNoteId`);
      } else {
        result.actionItems.push({
          id: action.id as string,
          task: action.task as string,
          ownerId: (action.ownerId as string) ?? null,
          deadline: isString(action, "deadline") ? (action.deadline as string) : "Chưa xác định",
          priority: isString(action, "priority") ? (action.priority as string) : "Chưa xác định",
          status: isString(action, "status") ? (action.status as string) : "todo",
          notes: isString(action, "notes") ? (action.notes as string) : "",
          meetingNoteId: action.meetingNoteId as string,
          createdAt: isString(action, "createdAt") ? (action.createdAt as string) : new Date().toISOString(),
        });
      }
    }
  }

  // Validate decisions
  if (!Array.isArray(record.decisions)) {
    errors.push("decisions phải là array");
  } else {
    for (const [i, decision] of record.decisions.entries()) {
      if (!isString(decision, "id") || !isString(decision, "content") || !isString(decision, "meetingNoteId")) {
        errors.push(`decisions[${i}]: thiếu id/content/meetingNoteId`);
      } else {
        result.decisions.push({
          id: decision.id as string,
          content: decision.content as string,
          meetingNoteId: decision.meetingNoteId as string,
          createdAt: isString(decision, "createdAt") ? (decision.createdAt as string) : new Date().toISOString(),
        });
      }
    }
  }

  return result;
}

function isString(obj: unknown, key: string): boolean {
  return typeof (obj as Record<string, unknown>)[key] === "string";
}
