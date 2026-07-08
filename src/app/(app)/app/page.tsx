import Link from "next/link";
import { redirect } from "next/navigation";
import { MeetingNotesGenerator } from "@/app/meeting-notes-generator";
import { prisma } from "@/lib/db";
import { getUserOrganization } from "@/lib/organizations";
import { getSession } from "@/lib/session";
import { EmptyState as SharedEmptyState } from "@/components/empty-state";

const upcomingWindowDays = 7;
const maxDashboardItems = 6;

type DashboardAction = {
  id: string;
  task: string;
  deadline: string;
  priority: string;
  status: string;
  ownerName: string;
  meetingTitle: string;
  createdAt: Date;
  parsedDeadline: Date | null;
};

type DashboardDecision = {
  id: string;
  content: string;
  createdAt: Date;
  meetingTitle: string;
};

type DashboardMeeting = {
  id: string;
  title: string;
  audioName: string;
  createdAt: Date;
  actionCount: number;
  decisionCount: number;
};

export default async function AppPage() {
  const user = await getSession();
  if (!user) redirect("/auth/login");

  const activeOrganization = await getUserOrganization(user.id);
  const scopedWhere = activeOrganization
    ? { organizationId: activeOrganization.id }
    : { userId: user.id };

  const [rawActions, rawDecisions, rawMeetings] = await Promise.all([
    prisma.actionItem.findMany({
      where: scopedWhere,
      include: {
        owner: { select: { name: true, email: true } },
        meetingNote: { select: { title: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.decision.findMany({
      where: scopedWhere,
      include: { meetingNote: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.meetingNote.findMany({
      where: scopedWhere,
      include: {
        _count: { select: { actionItems: true, decisions: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const actions: DashboardAction[] = rawActions.map((item) => ({
    id: item.id,
    task: item.task,
    deadline: item.deadline,
    priority: item.priority,
    status: item.status,
    ownerName: item.owner?.name || item.owner?.email || "Chưa có owner",
    meetingTitle: item.meetingNote.title,
    createdAt: item.createdAt,
    parsedDeadline: parseDeadline(item.deadline),
  }));

  const openActions = actions.filter((item) => item.status !== "done");
  const overdueActions = openActions
    .filter((item) => isOverdue(item.parsedDeadline))
    .sort(compareDeadlineAsc)
    .slice(0, maxDashboardItems);
  const upcomingActions = openActions
    .filter((item) => isUpcoming(item.parsedDeadline))
    .sort(compareDeadlineAsc)
    .slice(0, maxDashboardItems);
  const blockedActions = openActions
    .filter((item) => item.status === "blocked")
    .slice(0, maxDashboardItems);
  const unownedActions = openActions
    .filter((item) => item.ownerName === "Chưa có owner")
    .slice(0, maxDashboardItems);

  const decisions: DashboardDecision[] = rawDecisions.map((decision) => ({
    id: decision.id,
    content: decision.content,
    createdAt: decision.createdAt,
    meetingTitle: decision.meetingNote.title,
  }));

  const meetings: DashboardMeeting[] = rawMeetings.map((meeting) => ({
    id: meeting.id,
    title: meeting.title,
    audioName: meeting.audioName,
    createdAt: meeting.createdAt,
    actionCount: meeting._count.actionItems,
    decisionCount: meeting._count.decisions,
  }));

  const followUpLines = buildFollowUpBrief({
    overdueActions,
    upcomingActions,
    blockedActions,
    decisions,
  });

  return (
    <main className="mx-auto w-full max-w-[1280px] space-y-8 px-6 py-12">
      {/* Hero — canvas white card, heading-md, dual pill CTAs */}
      <section className="rounded-xl border border-hairline bg-canvas p-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-brand-coral">
              Bảng tổng hợp mỗi ngày
            </p>
            <h1 className="mt-3 text-[32px] font-semibold leading-[1.25] tracking-[-0.5px] text-ink">
              Hôm nay cần xử lý gì?
            </h1>
            <p className="mt-4 text-[16px] leading-[1.50] text-slate">
              Gom việc quá hạn, blocker, quyết định mới và cuộc họp gần đây vào
              một màn hình để vào app là biết việc ưu tiên ngay.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/actions" className="button-tertiary">
              Mở Action Board
            </Link>
            <a href="#new-meeting" className="button-primary">
              Tạo notes mới
            </a>
          </div>
        </div>
      </section>

      {/* Metrics — 5-column grid, card-base tiles */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Open actions" value={openActions.length} accent />
        <MetricCard label="Quá hạn" value={overdueActions.length} />
        <MetricCard label="7 ngày tới" value={upcomingActions.length} />
        <MetricCard label="Blocked" value={blockedActions.length} />
        <MetricCard label="Chưa có owner" value={unownedActions.length} />
      </section>

      {/* Action panels — 2-column grid of card-base */}
      <section className="grid gap-6 lg:grid-cols-2">
        <DashboardPanel
          title="Việc quá hạn"
          description="Ưu tiên xử lý hoặc đổi deadline."
          empty="Không có việc quá hạn rõ ràng."
          items={overdueActions}
        />
        <DashboardPanel
          title={`Deadline ${upcomingWindowDays} ngày tới`}
          description="Các việc sắp đến hạn cần chuẩn bị trước."
          empty="Chưa có deadline trong 7 ngày tới."
          items={upcomingActions}
        />
        <DashboardPanel
          title="Blocked"
          description="Các việc đang kẹt cần gỡ nút thắt."
          empty="Không có blocker đang mở."
          items={blockedActions}
        />
        <DashboardPanel
          title="Chưa có owner"
          description="Nên gán người phụ trách để tránh rơi việc."
          empty="Mọi việc đang mở đều đã có owner."
          items={unownedActions}
        />
      </section>

      {/* Decisions + Follow-up brief — 2-column, dark tile for brief */}
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border border-hairline bg-surface p-8">
          <div className="mb-6 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[24px] font-semibold leading-[1.30] text-ink">
                Quyết định mới
              </h2>
              <p className="mt-2 text-[14px] leading-[1.50] text-slate">
                Những quyết định gần nhất để đối chiếu khi follow-up.
              </p>
            </div>
            <Link
              href="/actions"
              className="text-[14px] font-medium text-ink transition-colors hover:text-brand-blue-deep"
            >
              Xem tất cả
            </Link>
          </div>
          {decisions.length === 0 ? (
            <EmptyState text="Chưa có decision nào được lưu." />
          ) : (
            <div className="space-y-3">
              {decisions.map((decision) => (
                <div
                  key={decision.id}
                  className="rounded-lg border border-hairline bg-canvas p-4"
                >
                  <p className="text-[16px] font-medium leading-[1.50] text-ink">
                    {decision.content}
                  </p>
                  <p className="mt-2 text-[14px] leading-[1.50] text-steel">
                    {decision.meetingTitle} · {formatDate(decision.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl bg-footer-bg p-8">
          <h2 className="text-[24px] font-semibold leading-[1.30] text-on-dark">
            Follow-up brief nhanh
          </h2>
          <p className="mt-2 text-[14px] leading-[1.50] text-muted">
            Copy nội dung này để gửi recap hoặc tự rà soát cuối ngày.
          </p>
          <pre className="mt-6 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-primary-soft p-4 text-[14px] leading-[1.50] text-on-dark">
            {followUpLines.join("\n")}
          </pre>
        </section>
      </section>

      {/* Recent meetings — card-base */}
      <section className="rounded-xl border border-hairline bg-canvas p-8">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[24px] font-semibold leading-[1.30] text-ink">
              Cuộc họp gần đây
            </h2>
            <p className="mt-2 text-[14px] leading-[1.50] text-slate">
              Mở lại notes, decisions và action items mới tạo.
            </p>
          </div>
          <Link
            href="/history"
            className="text-[14px] font-medium text-ink transition-colors hover:text-brand-blue-deep"
          >
            Xem lịch sử
          </Link>
        </div>
        {meetings.length === 0 ? (
          <SharedEmptyState
            icon="📋"
            title="Chưa có cuộc họp nào"
            description="Tạo meeting notes đầu tiên ở bên dưới. Upload file MP3, MP4, WAV hoặc M4A để bắt đầu."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {meetings.map((meeting) => (
              <Link
                key={meeting.id}
                href={`/history?meeting=${meeting.id}`}
                className="block rounded-xl border border-hairline bg-canvas p-5 transition-colors hover:border-ink"
              >
                <h3 className="line-clamp-2 text-[16px] font-semibold leading-[1.40] text-ink">
                  {meeting.title}
                </h3>
                <p className="mt-2 text-[14px] leading-[1.50] text-steel">
                  {formatDate(meeting.createdAt)} · {meeting.audioName}
                </p>
                <div className="mt-4 flex gap-2">
                  <span className="pill-tab">
                    {meeting.actionCount} actions
                  </span>
                  <span className="pill-tab">
                    {meeting.decisionCount} decisions
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* New meeting generator — surface card */}
      <section
        id="new-meeting"
        className="scroll-mt-6 rounded-xl border border-hairline bg-surface p-8"
      >
        <div className="mb-6">
          <h2 className="text-[24px] font-semibold leading-[1.30] text-ink">
            Tạo meeting notes mới
          </h2>
          <p className="mt-2 text-[14px] leading-[1.50] text-slate">
            Generator vẫn nằm ngay trong dashboard để ghi notes và tạo action
            items nhanh.
          </p>
        </div>
        <MeetingNotesGenerator />
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-canvas p-5">
      <p className="text-[14px] font-medium leading-[1.50] text-steel">
        {label}
      </p>
      <p
        className={
          accent
            ? "mt-3 text-[32px] font-semibold leading-[1.25] tracking-[-0.5px] text-brand-coral"
            : "mt-3 text-[32px] font-semibold leading-[1.25] tracking-[-0.5px] text-ink"
        }
      >
        {value}
      </p>
    </div>
  );
}

function DashboardPanel({
  title,
  description,
  empty,
  items,
}: {
  title: string;
  description: string;
  empty: string;
  items: DashboardAction[];
}) {
  return (
    <section className="rounded-xl border border-hairline bg-canvas p-8">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[24px] font-semibold leading-[1.30] text-ink">
            {title}
          </h2>
          <p className="mt-2 text-[14px] leading-[1.50] text-slate">
            {description}
          </p>
        </div>
        <Link
          href="/actions"
          className="text-[14px] font-medium text-ink transition-colors hover:text-brand-blue-deep"
        >
          Action Board
        </Link>
      </div>
      {items.length === 0 ? (
        <EmptyState text={empty} />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ActionCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function ActionCard({ item }: { item: DashboardAction }) {
  return (
    <Link
      href={`/actions?highlight=${item.id}`}
      className="block rounded-lg border border-hairline bg-canvas p-4 transition-colors hover:border-ink"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="pill-tab">{item.priority}</span>
        <span className="pill-tab">{item.status}</span>
      </div>
      <p className="mt-3 text-[16px] font-semibold leading-[1.40] text-ink">
        {item.task}
      </p>
      <p className="mt-2 text-[14px] leading-[1.50] text-steel">
        {item.ownerName} · {item.deadline || "Chưa có deadline"} ·{" "}
        {item.meetingTitle}
      </p>
    </Link>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-hairline bg-surface p-5 text-[14px] leading-[1.50] text-steel">
      {text}
    </div>
  );
}

function buildFollowUpBrief({
  overdueActions,
  upcomingActions,
  blockedActions,
  decisions,
}: {
  overdueActions: DashboardAction[];
  upcomingActions: DashboardAction[];
  blockedActions: DashboardAction[];
  decisions: DashboardDecision[];
}) {
  const lines = ["Follow-up brief", "", "Việc quá hạn:"];
  lines.push(...formatActionLines(overdueActions));
  lines.push("", `Deadline ${upcomingWindowDays} ngày tới:`);
  lines.push(...formatActionLines(upcomingActions));
  lines.push("", "Blockers:");
  lines.push(...formatActionLines(blockedActions));
  lines.push("", "Quyết định mới:");
  lines.push(
    ...(decisions.length
      ? decisions.slice(0, 5).map((decision) => `- ${decision.content}`)
      : ["- Không có quyết định mới."]),
  );
  return lines;
}

function formatActionLines(items: DashboardAction[]) {
  if (items.length === 0) return ["- Không có."];
  return items.slice(0, 5).map((item) => {
    const owner = item.ownerName === "Chưa có owner" ? "chưa gán owner" : item.ownerName;
    return `- ${item.task} — ${owner} — ${item.deadline || "chưa có deadline"}`;
  });
}

function compareDeadlineAsc(a: DashboardAction, b: DashboardAction) {
  return (a.parsedDeadline?.getTime() ?? Number.MAX_SAFE_INTEGER) -
    (b.parsedDeadline?.getTime() ?? Number.MAX_SAFE_INTEGER);
}

function isOverdue(date: Date | null) {
  if (!date) return false;
  return startOfDay(date).getTime() < startOfDay(new Date()).getTime();
}

function isUpcoming(date: Date | null) {
  if (!date) return false;
  const today = startOfDay(new Date());
  const deadline = startOfDay(date);
  const max = new Date(today);
  max.setDate(today.getDate() + upcomingWindowDays);
  return deadline.getTime() >= today.getTime() && deadline.getTime() <= max.getTime();
}

function parseDeadline(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "chưa xác định") return null;

  const isoLike = Date.parse(trimmed);
  if (!Number.isNaN(isoLike)) return new Date(isoLike);

  const vietnameseDate = trimmed.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (!vietnameseDate) return null;

  const day = Number(vietnameseDate[1]);
  const month = Number(vietnameseDate[2]);
  const currentYear = new Date().getFullYear();
  const yearText = vietnameseDate[3];
  const year = yearText
    ? Number(yearText.length === 2 ? `20${yearText}` : yearText)
    : currentYear;

  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
