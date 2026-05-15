import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
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

      {/* Hero */}
      <section className="px-4 py-16 text-center sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Vietnamese AI Workspace
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Biến mọi cuộc họp thành
            <br />
            hành động rõ ràng
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            Upload file audio hoặc video — AI tạo meeting notes tiếng Việt có speaker labels,
            timestamps, decisions và action items trong vài phút.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
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
              Xem tính năng Pro →
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-slate-100 bg-slate-50 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold text-slate-950">
            3 bước đơn giản
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Upload",
                desc: "Kéo thả file MP3, MP4, WAV hoặc M4A lên tối đa 1GB. Upload theo chunk an toàn.",
              },
              {
                step: "2",
                title: "Transcribe",
                desc: "Gemini AI tạo transcript tiếng Việt với speaker labels và timestamps chính xác.",
              },
              {
                step: "3",
                title: "Export",
                desc: "Copy Markdown, tải file .md hoặc .docx (Pro). Lưu vào lịch sử để xem lại.",
              },
            ].map((item) => (
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

      {/* Features */}
      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold text-slate-950">
            Mọi thứ bạn cần từ một cuộc họp
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: "Speaker labels", desc: "Phân biệt từng người nói tự động." },
              { title: "Action items", desc: "Việc cần làm, người phụ trách, deadline." },
              { title: "Decisions", desc: "Các quyết định đã chốt trong cuộc họp." },
              { title: "Risks & blockers", desc: "Rủi ro và vấn đề cần giải quyết." },
            ].map((f) => (
              <div key={f.title} className="rounded-lg border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-950">{f.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing preview */}
      <section className="border-t border-slate-100 bg-slate-50 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-semibold text-slate-950">Đơn giản và minh bạch</h2>
          <p className="mt-3 text-slate-600">
            Bắt đầu miễn phí, nâng cấp khi cần.
          </p>
          <Link
            href="/pricing"
            className="mt-6 inline-flex h-10 items-center rounded-md border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:border-blue-400 hover:text-blue-700"
          >
            Xem chi tiết pricing →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 px-4 py-8 text-center text-sm text-slate-500 sm:px-6">
        <p>© 2026 cuochop. Vietnamese AI Workspace.</p>
      </footer>
    </main>
  );
}
