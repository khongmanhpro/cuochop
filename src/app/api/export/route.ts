import { appApiError, createApiErrorResponse } from "@/lib/api-errors";
import { getRequestIp, logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { csvRow, jsonLine } from "@/lib/export-org-data";
import { getUserOrganization } from "@/lib/organizations";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const encoder = new TextEncoder();

export async function GET(request: Request) {
  try {
    const user = await getSession();
    if (!user) throw appApiError("UNAUTHENTICATED", "Bạn cần đăng nhập.", 401);

    const activeOrganization = await getUserOrganization(user.id);
    if (!activeOrganization || activeOrganization.role !== "owner") {
      throw appApiError("FORBIDDEN", "Chỉ owner có thể export dữ liệu.", 403);
    }

    const url = new URL(request.url);
    const format = url.searchParams.get("format") === "csv" ? "csv" : "json";

    await logAudit({
      organizationId: activeOrganization.id,
      userId: user.id,
      action: "export",
      entityType: "Organization",
      entityId: activeOrganization.id,
      after: { format },
      ipAddress: getRequestIp(request),
    });

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        if (format === "csv") {
          controller.enqueue(encoder.encode("dataset,id,data\n"));
          await writeCsvRows(controller, activeOrganization.id);
        } else {
          controller.enqueue(encoder.encode("[\n"));
          await writeJsonRows(controller, activeOrganization.id);
          controller.enqueue(encoder.encode("\n]\n"));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": format === "csv" ? "text/csv" : "application/json",
        "Content-Disposition": `attachment; filename="cuochop-org-export.${format}"`,
      },
    });
  } catch (error) {
    return createApiErrorResponse(error, {
      route: "/api/export",
      fallbackCode: "INTERNAL_ERROR",
      fallbackMessage: "Không thể export dữ liệu.",
    });
  }
}

async function writeJsonRows(
  controller: ReadableStreamDefaultController<Uint8Array>,
  organizationId: string,
) {
  let first = true;
  for await (const record of iterateOrgData(organizationId)) {
    controller.enqueue(
      encoder.encode(`${first ? "" : ",\n"}${jsonLine(record.dataset, record.data)}`),
    );
    first = false;
  }
}

async function writeCsvRows(
  controller: ReadableStreamDefaultController<Uint8Array>,
  organizationId: string,
) {
  for await (const record of iterateOrgData(organizationId)) {
    controller.enqueue(
      encoder.encode(`${csvRow(record.dataset, record.data as Record<string, unknown>)}\n`),
    );
  }
}

async function* iterateOrgData(organizationId: string) {
  const meetingNotes = await prisma.meetingNote.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
  });
  for (const row of meetingNotes) yield { dataset: "MeetingNotes", data: row };

  const actionItems = await prisma.actionItem.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
  });
  for (const row of actionItems) yield { dataset: "ActionItems", data: row };

  const decisions = await prisma.decision.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
  });
  for (const row of decisions) yield { dataset: "Decisions", data: row };

  const auditLogs = await prisma.auditLog.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
  });
  for (const row of auditLogs) yield { dataset: "AuditLogs", data: row };
}
