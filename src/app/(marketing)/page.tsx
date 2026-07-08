import Link from "next/link";
import { Logo } from "@/components/logo";

const STEPS = [
  {
    step: "1",
    title: "Ghi lại cuộc họp",
    desc: "Upload file MP3, MP4, WAV hoặc M4A. cuochop transcribe tiếng Việt với timestamp và speaker labels.",
  },
  {
    step: "2",
    title: "Tách quyết định và việc phải làm",
    desc: "AI trích xuất decisions, action items, owner, deadline, priority và blockers từ transcript.",
  },
  {
    step: "3",
    title: "Theo dõi đến khi xong",
    desc: "Action Board đưa action items vào một nơi để xem việc quá hạn, blocked và chưa có owner.",
  },
];

const FEATURES = [
  {
    title: "Action Board",
    desc: "Một nơi để xem toàn bộ việc cần làm sau mọi cuộc họp.",
  },
  {
    title: "Owner & deadline",
    desc: "Sửa owner, deadline, priority và status thay vì để việc nằm chết trong notes.",
  },
  {
    title: "Decision Log",
    desc: "Tra lại quyết định đã chốt theo từng cuộc họp khi team cần đối chiếu.",
  },
  {
    title: "Follow-up Brief",
    desc: "Copy nhanh recap gửi team: decisions, actions, blockers và câu hỏi còn mở.",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-canvas">
      {/* Top nav — sticky white bar, hairline-soft bottom border */}
      <header className="sticky top-0 z-30 border-b border-hairline-soft bg-canvas">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-6">
          <Logo width={120} height={32} className="shrink-0" />
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="text-[14px] font-medium text-slate transition-colors hover:text-ink"
            >
              Đăng nhập
            </Link>
            <Link
              href="/auth/signup"
              className="button-primary"
            >
              Mở workspace
            </Link>
          </div>
        </div>
      </header>

      {/* Hero band — 80px display, -2px letter-spacing, 1.10 leading, dual CTA */}
      <section className="px-6 pb-[96px] pt-[96px] text-center">
        <div className="mx-auto max-w-[960px]">
          <p className="text-[14px] font-medium uppercase tracking-[0.08em] text-brand-coral">
            Personal Action Tracker
          </p>
          <h1 className="mt-4 text-[80px] font-semibold leading-[1.10] tracking-[-2px] text-ink sm:text-[80px]">
            Biến cuộc họp thành việc có người chịu trách nhiệm
          </h1>
          <p className="mx-auto mt-6 max-w-[720px] text-[18px] font-medium leading-[1.50] text-slate">
            cuochop tự động trích xuất quyết định, action items, owner,
            deadline và biến chúng thành bảng theo dõi cho founder/manager.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/auth/signup" className="button-primary">
              Mở workspace
            </Link>
            <Link href="/auth/login" className="button-secondary">
              Đăng nhập
            </Link>
          </div>
        </div>
      </section>

      {/* Steps — surface section, card-base tiles (rounded-xl, hairline border) */}
      <section className="border-t border-hairline-soft bg-surface px-6 py-[80px]">
        <div className="mx-auto max-w-[1280px]">
          <h2 className="text-center text-[40px] font-semibold leading-[1.20] tracking-[-1px] text-ink">
            Từ transcript đến follow-through
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {STEPS.map((item) => (
              <div
                key={item.step}
                className="rounded-xl border border-hairline bg-canvas p-6"
              >
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-on-primary">
                  {item.step}
                </div>
                <h3 className="text-[20px] font-semibold leading-[1.40] text-ink">
                  {item.title}
                </h3>
                <p className="mt-2 text-[14px] leading-[1.50] text-slate">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features — 4-column grid of card-base tiles */}
      <section className="px-6 py-[80px]">
        <div className="mx-auto max-w-[1280px]">
          <h2 className="text-center text-[40px] font-semibold leading-[1.20] tracking-[-1px] text-ink">
            Giải quyết phần đau nhất sau cuộc họp
          </h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-hairline bg-canvas p-5"
              >
                <h3 className="text-[20px] font-semibold leading-[1.40] text-ink">
                  {feature.title}
                </h3>
                <p className="mt-2 text-[14px] leading-[1.50] text-slate">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Promo CTA card — coral, rounded-hero (32px), embedded white pill */}
      <section className="px-6 py-[80px]">
        <div className="mx-auto max-w-[1280px]">
          <div className="rounded-hero bg-brand-coral px-[64px] py-[64px] text-center">
            <h2 className="text-[40px] font-semibold leading-[1.20] tracking-[-1px] text-on-dark">
              Đừng để cuộc họp kết thúc bằng một file notes bị quên
            </h2>
            <p className="mx-auto mt-4 max-w-[640px] text-[16px] leading-[1.50] text-on-dark/80">
              Tập trung vào tính năng lõi: notes, decisions, action items,
              lịch sử và export.
            </p>
            <Link
              href="/auth/signup"
              className="mt-8 inline-flex h-11 items-center rounded-full border border-on-dark/20 bg-canvas px-6 text-[14px] font-semibold text-ink transition-colors hover:bg-on-dark hover:text-ink"
            >
              Mở workspace
            </Link>
          </div>
        </div>
      </section>

      {/* Footer region — dense black canvas */}
      <footer className="bg-footer-bg px-6 py-[64px]">
        <div className="mx-auto max-w-[1280px]">
          <Logo width={100} height={28} className="mb-4 invert" />
          <p className="text-[14px] text-muted">
            © 2026 cuochop. Vietnamese AI Workspace.
          </p>
        </div>
      </footer>
    </main>
  );
}
