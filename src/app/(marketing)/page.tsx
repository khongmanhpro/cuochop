import Link from "next/link";

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
    desc: "Pro đưa action items vào Action Board để manager xem việc quá hạn, blocked và chưa có owner.",
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
    <main className="min-h-screen bg-white">
      <header className="border-b border-slate-100 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="text-sm font-bold text-blue-700">cuochop</span>
          <div className="flex items-center gap-4">
            <Link href="/auth/login" className="text-sm text-slate-600 hover:text-slate-900">
              Đăng nhập
            </Link>
            <Link
              href="/auth/signup"
              className="inline-flex h-8 items-center rounded-md bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Dùng miễn phí
            </Link>
          </div>
        </div>
      </header>

      <section className="px-4 py-16 text-center sm:px-6 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Pro Action Tracker cho manager
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Biến cuộc họp thành việc có người chịu trách nhiệm
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            cuochop tự động trích xuất quyết định, action items, owner,
            deadline và biến chúng thành bảng theo dõi cho founder/manager.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/auth/signup"
              className="inline-flex h-12 items-center rounded-md bg-blue-700 px-6 text-base font-semibold text-white shadow-sm hover:bg-blue-800"
            >
              Dùng miễn phí
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-12 items-center rounded-md border border-slate-300 px-6 text-base font-semibold text-slate-700 hover:border-blue-400 hover:text-blue-700"
            >
              Xem Pro Manager
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-100 bg-slate-50 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold text-slate-950">
            Từ transcript đến follow-through
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {STEPS.map((item) => (
              <div
                key={item.step}
                className="rounded-lg border border-slate-200 bg-white p-6"
              >
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-blue-700 text-sm font-bold text-white">
                  {item.step}
                </div>
                <h3 className="font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold text-slate-950">
            Pro giải quyết phần đau nhất sau cuộc họp
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-lg border border-slate-200 p-5"
              >
                <h3 className="font-semibold text-slate-950">{feature.title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-100 bg-slate-950 px-4 py-16 text-white sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-semibold">
            Đừng để cuộc họp kết thúc bằng một file notes bị quên
          </h2>
          <p className="mt-3 text-slate-300">
            Bắt đầu miễn phí. Nâng cấp Pro khi bạn muốn quản lý action items
            qua nhiều cuộc họp.
          </p>
          <Link
            href="/pricing"
            className="mt-6 inline-flex h-10 items-center rounded-md bg-white px-5 text-sm font-semibold text-slate-950 hover:bg-blue-50"
          >
            Xem pricing
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-100 px-4 py-8 text-center text-sm text-slate-500 sm:px-6">
        <p>© 2026 cuochop. Vietnamese AI Workspace.</p>
      </footer>
    </main>
  );
}
