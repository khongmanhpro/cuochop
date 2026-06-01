import { verifyCronRequest } from "@/lib/cron";
import { prisma } from "@/lib/db";
import {
  groupReminderCandidatesByEmail,
  shouldSendDeadlineReminder,
} from "@/lib/deadline-reminders";
import { sendEmail } from "@/lib/email";
import { renderReminderEmail } from "@/lib/email-templates/reminder";
import {
  buildDeadlineReminderBlocks,
  postSlackMessage,
  type DeadlineReminderBlockItem,
} from "@/lib/slack";

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
      owner: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      organization: {
        select: {
          id: true,
          slackIntegration: true,
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
      owner: item.owner ? item.owner.name || item.owner.email : "Unassigned",
      ownerEmail: item.owner?.email,
      deadline: item.deadline,
      status: item.status,
      userId: item.owner?.id ?? item.user.id,
      userEmail: item.user.email,
      lastReminderSent: item.lastReminderSent,
    })),
  );

  let sent = 0;
  let slackSent = 0;
  const remindedItemIds: string[] = [];

  for (const [emailAddress, items] of grouped) {
    const itemIds = items.map((item) => item.id);
    const email = renderReminderEmail({
      appUrl,
      items: items.map((item) => ({
        task: item.task,
        owner: item.owner,
        deadline: item.deadline,
        status: item.status,
      })),
      actionUrl: `${appUrl}/actions?filter=deadlines&items=${itemIds.join(",")}`,
    });

    await sendEmail(emailAddress, email.subject, email.html, email.text);

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

  const slackGroups = new Map<
    string,
    {
      accessToken: string;
      channelId: string;
      items: DeadlineReminderBlockItem[];
      itemIds: string[];
    }
  >();

  for (const item of actionItems) {
    const integration = item.organization?.slackIntegration;
    if (!item.organizationId || !integration?.accessToken || !integration.channelId) {
      continue;
    }
    if (
      !shouldSendDeadlineReminder({
        deadline: item.deadline,
        status: item.status,
        lastReminderSent: item.lastReminderSent,
      })
    ) {
      continue;
    }

    const group = slackGroups.get(item.organizationId) ?? {
      accessToken: integration.accessToken,
      channelId: integration.channelId,
      items: [],
      itemIds: [],
    };
    group.items.push({
      id: item.id,
      task: item.task,
      owner: item.owner ? item.owner.name || item.owner.email : "Unassigned",
      deadline: item.deadline,
      status: item.status,
    });
    group.itemIds.push(item.id);
    slackGroups.set(item.organizationId, group);
  }

  for (const group of slackGroups.values()) {
    try {
      await postSlackMessage({
        encryptedAccessToken: group.accessToken,
        channelId: group.channelId,
        text: "Action item deadline reminders",
        blocks: buildDeadlineReminderBlocks(group.items),
      });
      remindedItemIds.push(...group.itemIds);
      slackSent += 1;
    } catch (error) {
      console.warn("[slack] failed to post deadline reminders", error);
    }
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
    slackMessagesSent: slackSent,
    itemsReminded: remindedItemIds.length,
  });
}
