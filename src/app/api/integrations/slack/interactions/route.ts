import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import {
  parseSlackDeadlineAction,
  verifySlackRequestSignature,
} from "@/lib/slack";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.text();
  const verified = verifySlackRequestSignature({
    body,
    timestamp: request.headers.get("x-slack-request-timestamp"),
    signature: request.headers.get("x-slack-signature"),
  });

  if (!verified) {
    return new Response("Invalid Slack signature", { status: 401 });
  }

  const form = new URLSearchParams(body);
  const payloadText = form.get("payload");
  if (!payloadText) {
    return Response.json({ text: "Missing Slack payload." }, { status: 400 });
  }

  const payload = JSON.parse(payloadText) as {
    actions?: Array<{ value?: string }>;
  };
  const value = payload.actions?.[0]?.value;
  if (!value) {
    return Response.json({ text: "Missing Slack action." }, { status: 400 });
  }

  const action = parseSlackDeadlineAction(value);
  const before = await prisma.actionItem.findUnique({
    where: { id: action.actionItemId },
    select: {
      id: true,
      userId: true,
      organizationId: true,
      status: true,
      lastReminderSent: true,
    },
  });
  if (!before) {
    return Response.json({ text: "Action item not found." }, { status: 404 });
  }

  if (action.action === "done") {
    await prisma.actionItem.update({
      where: { id: action.actionItemId },
      data: { status: "done" },
    });
  } else if (action.action === "blocked") {
    await prisma.actionItem.update({
      where: { id: action.actionItemId },
      data: { status: "blocked" },
    });
  } else {
    await prisma.actionItem.update({
      where: { id: action.actionItemId },
      data: { lastReminderSent: new Date() },
    });
  }

  const after = await prisma.actionItem.findUnique({
    where: { id: action.actionItemId },
    select: {
      status: true,
      lastReminderSent: true,
    },
  });

  await logAudit({
    organizationId: before.organizationId,
    userId: before.userId,
    action: "update",
    entityType: "ActionItem",
    entityId: before.id,
    before: {
      status: before.status,
      lastReminderSent: before.lastReminderSent,
    },
    after: {
      status: after?.status ?? before.status,
      lastReminderSent: after?.lastReminderSent ?? before.lastReminderSent,
    },
  });

  return Response.json({
    response_type: "ephemeral",
    text: "Action item updated.",
  });
}
