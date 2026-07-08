import Link from "next/link";

const CORE_FEATURES = [
  "Không giới hạn số lần tạo meeting notes trong app cá nhân",
  "Action Board qua mọi meeting",
  "Lịch sử cuộc họp và Decision Log",
  "Copy Follow-up Brief gửi team",
  "Export Markdown và DOCX",
  "Workspace/team tools giữ lại khi cần, nhưng không còn là điều kiện trả phí",
];

const NEXT_FEATURES = [
  "Dashboard việc quá hạn, blocked, chưa có owner",
  "Tìm kiếm mạnh hơn theo người, deadline, priority, quyết định",
  "Template notes theo kiểu họp",
  "Reminder cá nhân và backup/export dữ liệu",
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-canvas">
      {/* Top nav — sticky white bar, hairline-soft bottom border */}
      <header className="sticky top-0 z-30 border-b border-hairline-soft bg-canvas">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-6">
          <Link
            href="/"
            className="text-[15px] font-semibold tracking-tight text-ink"
          >
            cuochop
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="text-[14px] font-medium text-slate transition-colors hover:text-ink"
            >
              Đăng nhập
            </Link>
            <Link href="/auth/signup" className="button-primary">
              Mở workspace
            </Link>
          </div>
        </div>
      </header>

      <section className="px-6 py-[80px]">
        <div className="mx-auto max-w-[720px] text-center">
          <p className="text-[14px] font-medium uppercase tracking-[0.08em] text-brand-coral">
            Feature-first personal workspace
          </p>
          <h1 className="mt-4 text-[56px] font-semibold leading-[1.10] tracking-[-1.5px] text-ink">
            Tính năng đã mở trong app
          </h1>
          <p className="mx-auto mt-6 max-w-[640px] text-[18px] font-medium leading-[1.50] text-slate">
            cuochop hiện ưu tiên dùng cá nhân: mở toàn bộ tính năng lõi,
            không dẫn người dùng qua checkout hay paywall.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/auth/signup" className="button-primary">
              Dùng ngay
            </Link>
            <Link href="/" className="button-secondary">
              Về trang chủ
            </Link>
          </div>
        </div>

        {/* 2-column tier cards — highlighted uses coral (rounded-hero), other uses card-base (rounded-xl) */}
        <div className="mx-auto mt-16 grid max-w-[1280px] gap-6 lg:grid-cols-2">
          <FeatureCard
            title="Đã mở trong app"
            items={CORE_FEATURES}
            highlighted
          />
          <FeatureCard title="Hướng phát triển tiếp theo" items={NEXT_FEATURES} />
        </div>
      </section>
    </main>
  );
}

function FeatureCard({
  title,
  items,
  highlighted = false,
}: {
  title: string;
  items: string[];
  highlighted?: boolean;
}) {
  if (highlighted) {
    return (
      <div className="rounded-hero bg-brand-coral p-[32px] text-on-dark">
        <h2 className="text-[24px] font-semibold leading-[1.30] text-on-dark">
          {title}
        </h2>
        <ul className="mt-8 space-y-3">
          {items.map((item) => (
            <li
              key={item}
              className="flex gap-2 text-[14px] leading-[1.50] text-on-dark/90"
            >
              <span className="text-on-dark">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-hairline bg-canvas p-[32px]">
      <h2 className="text-[24px] font-semibold leading-[1.30] text-ink">
        {title}
      </h2>
      <ul className="mt-8 space-y-3">
        {items.map((item) => (
          <li
            key={item}
            className="flex gap-2 text-[14px] leading-[1.50] text-charcoal"
          >
            <span className="text-success-text">✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
