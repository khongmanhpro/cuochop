import { verifyCronRequest } from "@/lib/cron";
import { prisma } from "@/lib/db";
import { groupReminderCandidatesByEmail } from "@/lib/deadline-reminders";
import { sendEmail } from "@/lib/email";
import { renderDeadlineReminderEmail } from "@/lib/email-templates/deadline-reminder";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!verifyCronRequest(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const actionItems = await prisma.actionItem.findMany({
    where: {
      status: { not: "done" },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const grouped = groupReminderCandidatesByEmail(
    actionItems.map((item) => ({
      id: item.id,
      task: item.task,
      owner: item.owner,
      deadline: item.deadline,
      status: item.status,
      userId: item.user.id,
      userEmail: item.user.email,
      lastReminderSent: item.lastReminderSent,
    })),
  );

  let sent = 0;
  const remindedItemIds: string[] = [];

  for (const [emailAddress, items] of grouped) {
    const email = renderDeadlineReminderEmail({
      appUrl,
      items: items.map((item) => ({
        task: item.task,
        owner: item.owner,
        deadline: item.deadline,
        status: item.status,
      })),
    });

    await sendEmail({
      to: emailAddress,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    await prisma.notification.createMany({
      data: items.map((item) => ({
        userId: item.userId,
        type: "deadline_reminder",
        title: "Action item deadline reminder",
        body: `${item.task} is due ${item.deadline}.`,
        actionUrl: `/actions?filter=deadlines&item=${item.id}`,
      })),
    });

    remindedItemIds.push(...items.map((item) => item.id));
    sent += 1;
  }

  if (remindedItemIds.length > 0) {
    await prisma.actionItem.updateMany({
      where: { id: { in: remindedItemIds } },
      data: { lastReminderSent: new Date() },
    });
  }

  return Response.json({
    ok: true,
    emailsSent: sent,
    itemsReminded: remindedItemIds.length,
  });
}
