import Link from "next/link";

const FREE_FEATURES = [
  "5 cuộc họp/tháng",
  "Copy Markdown",
  "Download .md",
  "Gemini transcription",
];

const PRO_FEATURES = [
  "Unlimited cuộc họp",
  "Copy Markdown",
  "Download .md",
  "Download .docx",
  "Lịch sử meeting notes",
  "Gemini transcription",
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-slate-100 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="text-sm font-bold text-blue-700">cuochop</Link>
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

      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-semibold text-slate-950">Pricing đơn giản</h1>
          <p className="mt-3 text-lg text-slate-600">
            Bắt đầu miễn phí. Nâng cấp khi bạn cần thêm.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-3xl gap-6 sm:grid-cols-2">
          {/* Free */}
          <div className="rounded-xl border border-slate-200 p-8">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Free</p>
            <div className="mt-3 flex items-end gap-1">
              <span className="text-4xl font-bold text-slate-950">$0</span>
              <span className="mb-1 text-sm text-slate-500">mãi mãi</span>
            </div>
            <ul className="mt-6 space-y-3">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                  <span className="text-emerald-500">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/auth/signup"
              className="mt-8 flex h-10 items-center justify-center rounded-md border border-slate-300 text-sm font-semibold text-slate-700 hover:border-blue-400 hover:text-blue-700"
            >
              Bắt đầu miễn phí
            </Link>
          </div>

          {/* Pro */}
          <div className="rounded-xl border-2 border-blue-700 bg-blue-700 p-8 text-white">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-200">Pro</p>
            <div className="mt-3 flex items-end gap-1">
              <span className="text-4xl font-bold">$9</span>
              <span className="mb-1 text-sm text-blue-200">/tháng</span>
            </div>
            <ul className="mt-6 space-y-3">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-blue-100">
                  <span className="text-white">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/auth/signup"
              className="mt-8 flex h-10 items-center justify-center rounded-md bg-white text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              Nâng cấp Pro
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
