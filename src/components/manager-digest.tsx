"use client";

export function ManagerDigest({
  digest,
  isTeamContext,
}: {
  digest: {
    open: number;
    blocked: number;
    withoutOwner: number;
    clearlyOverdue: number;
    doneRatio: number;
    done: number;
    total: number;
  };
  isTeamContext: boolean;
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <DigestCard
        label={isTeamContext ? "Team open actions" : "Open actions"}
        value={String(digest.open)}
        helper="Việc còn phải xử lý"
      />
      <DigestCard label="Blocked" value={String(digest.blocked)} helper="Cần gỡ tắc" tone="dark" />
      <DigestCard
        label="Chưa có owner"
        value={String(digest.withoutOwner)}
        helper="Cần phân công"
      />
      <DigestCard
        label="Quá hạn"
        value={String(digest.clearlyOverdue)}
        helper="Deadline đã qua"
      />
      <DigestCard
        label="Done"
        value={`${Math.round(digest.doneRatio * 100)}%`}
        helper={`${digest.done}/${digest.total || 0} hoàn tất`}
        tone="blue"
      />
    </section>
  );
}

function DigestCard({
  label,
  value,
  helper,
  tone = "light",
}: {
  label: string;
  value: string;
  helper: string;
  tone?: "light" | "blue" | "dark";
}) {
  const toneClasses = {
    light: "border-hairline bg-canvas text-ink",
    blue: "border-brand-blue-deep bg-canvas text-brand-blue-deep",
    dark: "border-footer-bg bg-footer-bg text-on-dark",
  };

  return (
    <div className={`rounded-xl border p-4 ${toneClasses[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">{label}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-xs opacity-70">{helper}</p>
    </div>
  );
}
