import { computeManagerDigest } from "@/lib/action-items";
import { verifyCronRequest } from "@/lib/cron";
import { prisma } from "@/lib/db";
import { parseActionDeadline } from "@/lib/deadline-reminders";
import { sendEmail } from "@/lib/email";
import { renderWeeklyDigestEmail } from "@/lib/email-templates/weekly-digest";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!verifyCronRequest(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const organizations = await prisma.organization.findMany({
    where: { plan: "business" },
    include: {
      actionItems: {
        orderBy: { createdAt: "desc" },
      },
      memberships: {
        where: {
          role: { in: ["owner", "admin"] },
          user: {
            digestOptOut: false,
            digestFrequency: "weekly",
          },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      },
    },
  });

  let sent = 0;

  for (const organization of organizations) {
    if (organization.memberships.length === 0) continue;

    const digest = computeManagerDigest(
      organization.actionItems.map((item) => ({
        status: item.status,
        owner: item.owner,
        deadline: item.deadline,
        organizationId: item.organizationId,
      })),
      new Date(),
      organization.id,
    );
    const upcomingDeadlines = organization.actionItems
      .filter((item) => item.status !== "done" && parseActionDeadline(item.deadline))
      .sort((a, b) => {
        const left = parseActionDeadline(a.deadline)?.getTime() ?? 0;
        const right = parseActionDeadline(b.deadline)?.getTime() ?? 0;
        return left - right;
      })
      .slice(0, 5)
      .map((item) => ({
        task: item.task,
        owner: item.owner,
        deadline: item.deadline,
      }));

    const email = renderWeeklyDigestEmail({
      organizationName: organization.name,
      appUrl,
      open: digest.open,
      blocked: digest.blocked,
      overdue: digest.clearlyOverdue,
      donePercentage: Math.round(digest.doneRatio * 100),
      upcomingDeadlines,
    });

    await Promise.all(
      organization.memberships.map(async (membership) => {
        await sendEmail({
          to: membership.user.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
        });

        await prisma.notification.create({
          data: {
            userId: membership.user.id,
            type: "weekly_digest",
            title: `${organization.name} weekly digest`,
            body: `${digest.open} open, ${digest.blocked} blocked, ${digest.clearlyOverdue} overdue.`,
            actionUrl: "/actions",
          },
        });
        sent += 1;
      }),
    );
  }

  return Response.json({ ok: true, organizations: organizations.length, sent });
}
