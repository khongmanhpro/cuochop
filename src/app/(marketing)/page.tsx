import Link from "next/link";
import { Logo } from "@/components/logo";
import { getSession } from "@/lib/session";

const STEPS = [
  {
    step: "1",
    title: "Upload bản ghi họp",
    desc: "MP3, MP4, WAV hoặc M4A. Hệ thống phiên âm tiếng Việt, gắn speaker và timestamp.",
  },
  {
    step: "2",
    title: "Lấy quyết định & việc phải làm",
    desc: "AI tách summary, decisions, action items — rà soát, bỏ việc ảo trước khi vào board.",
  },
  {
    step: "3",
    title: "Theo dõi đến khi xong",
    desc: "Bảng việc: owner, deadline, trạng thái, filter «Việc của tôi», export & backup.",
  },
];

const FEATURES = [
  {
    title: "Bảng công việc",
    desc: "Một nơi cho việc từ mọi cuộc họp — lọc quá hạn, blocked, chưa owner.",
  },
  {
    title: "Lịch sử & tags",
    desc: "Mở lại notes, đổi speaker, gắn thẻ, tìm kiếm Cmd+K.",
  },
  {
    title: "Follow-up brief",
    desc: "Copy recap gửi team: decisions, actions, blockers.",
  },
  {
    title: "Dữ liệu của công ty",
    desc: "Self-host Docker, backup JSON/Markdown, không bắt buộc mua gói.",
  },
];

export default async function LandingPage() {
  const user = await getSession();
  const primaryHref = user ? "/app" : "/auth/login";
  const primaryLabel = user ? "Vào workspace" : "Đăng nhập";

  return (
    <main className="min-h-screen bg-canvas">
      <header className="app-header">
        <div className="app-header-inner !h-16">
          <Link
            href={user ? "/app" : "/"}
            className="shrink-0"
            aria-label={user ? "Về workspace" : "Trang chủ"}
          >
            <Logo width={148} height={40} />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <Link href="/app" className="button-primary">
                Vào workspace
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="text-[14px] font-medium text-slate transition-colors hover:text-ink"
                >
                  Đăng nhập
                </Link>
                <Link href="/auth/signup" className="button-primary">
                  Tạo tài khoản
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20">
        <div className="mx-auto max-w-[800px] text-center">
          <p className="page-eyebrow !normal-case tracking-[0.08em]">
            Công cụ nội bộ · Meeting → Action
          </p>
          <h1 className="mt-4 text-[clamp(32px,6vw,52px)] font-semibold leading-[1.12] tracking-[-1.2px] text-ink">
            Biến cuộc họp thành việc có người chịu trách nhiệm
          </h1>
          <p className="mx-auto mt-5 max-w-[560px] text-[16px] leading-[1.55] text-slate sm:text-[17px]">
            Dành cho team công ty: upload ghi âm, lấy notes tiếng Việt, theo dõi
            action items đến khi xong — triển khai trên server của bạn.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href={primaryHref} className="button-primary min-w-[160px]">
              {primaryLabel}
            </Link>
            {!user ? (
              <Link href="/auth/signup" className="button-secondary min-w-[160px]">
                Tạo tài khoản
              </Link>
            ) : (
              <Link href="/actions" className="button-secondary min-w-[160px]">
                Xem công việc
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="border-t border-hairline-soft bg-surface px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-[1100px]">
          <h2 className="text-center text-[clamp(22px,3vw,32px)] font-semibold tracking-[-0.5px] text-ink">
            Quy trình 3 bước
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {STEPS.map((item) => (
              <div key={item.step} className="card-surface p-5 sm:p-6">
                <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-on-primary">
                  {item.step}
                </div>
                <h3 className="text-[17px] font-semibold text-ink">
                  {item.title}
                </h3>
                <p className="mt-2 text-[14px] leading-[1.55] text-slate">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-[1100px]">
          <h2 className="text-center text-[clamp(22px,3vw,32px)] font-semibold tracking-[-0.5px] text-ink">
            Phù hợp team vận hành sau họp
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="card-surface p-5">
                <h3 className="text-[16px] font-semibold text-ink">
                  {feature.title}
                </h3>
                <p className="mt-2 text-[14px] leading-[1.55] text-slate">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-hairline-soft px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-[720px] text-center">
          <h2 className="text-[clamp(22px,3vw,28px)] font-semibold tracking-[-0.4px] text-ink">
            Sẵn sàng dùng trong team?
          </h2>
          <p className="mx-auto mt-3 max-w-[480px] text-[15px] leading-[1.55] text-slate">
            Không paywall. Đăng nhập workspace, upload họp, theo dõi việc.
          </p>
          <Link
            href={primaryHref}
            className="button-primary mt-6 inline-flex min-w-[160px]"
          >
            {primaryLabel}
          </Link>
        </div>
      </section>

      <footer className="border-t border-hairline-soft bg-surface px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Logo width={120} height={32} />
          <p className="text-[13px] text-steel">
            © {new Date().getFullYear()} cuochop · Meeting notes & action
            tracker cho nội bộ
          </p>
        </div>
      </footer>
    </main>
  );
}
