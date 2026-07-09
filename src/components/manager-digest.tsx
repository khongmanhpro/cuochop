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
        label={isTeamContext ? "Việc nhóm đang mở" : "Đang mở"}
        value={String(digest.open)}
        helper="Cần xử lý"
      />
      <DigestCard
        label="Đang kẹt"
        value={String(digest.blocked)}
        helper="Cần gỡ tắc"
        tone="warn"
      />
      <DigestCard
        label="Chưa owner"
        value={String(digest.withoutOwner)}
        helper="Cần phân công"
      />
      <DigestCard
        label="Quá hạn"
        value={String(digest.clearlyOverdue)}
        helper="Deadline đã qua"
        tone="danger"
      />
      <DigestCard
        label="Hoàn tất"
        value={`${Math.round(digest.doneRatio * 100)}%`}
        helper={`${digest.done}/${digest.total || 0} việc`}
        tone="success"
      />
    </section>
  );
}

function DigestCard({
  label,
  value,
  helper,
  tone = "default",
}: {
  label: string;
  value: string;
  helper: string;
  tone?: "default" | "success" | "warn" | "danger";
}) {
  const toneClass = {
    default: "card-surface text-ink",
    success: "card-surface text-success-text",
    warn: "border border-hairline bg-canvas text-ink",
    danger: "border border-error/25 bg-error/5 text-error",
  }[tone];

  return (
    <div className={`rounded-xl p-4 ${toneClass}`}>
      <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-steel">
        {label}
      </p>
      <p className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.5px]">
        {value}
      </p>
      <p className="mt-2 text-[12px] text-steel">{helper}</p>
    </div>
  );
}
