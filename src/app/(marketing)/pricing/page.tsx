import Link from "next/link";

const FREE_FEATURES = [
  "3 cuộc họp/tháng",
  "Transcript và meeting notes cơ bản",
  "Copy Markdown",
  "Download .md",
];

const PRO_FEATURES = [
  "Unlimited cuộc họp",
  "Action Board qua mọi meeting",
  "Sửa owner, deadline, priority, status",
  "Decision Log",
  "Follow-up Brief",
  "Manager Digest",
  "Download .docx management report",
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-slate-100 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="text-sm font-bold text-blue-700">
            cuochop
          </Link>
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
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Pricing cho manager
          </p>
          <h1 className="mt-2 text-4xl font-semibold text-slate-950">
            Trả tiền cho follow-through, không chỉ file notes
          </h1>
          <p className="mt-3 text-lg leading-8 text-slate-600">
            Free để thử chất lượng AI. Pro Manager để theo dõi việc phải làm,
            blocker và quyết định qua nhiều cuộc họp.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
          <PricingCard
            name="Free"
            price="$0"
            suffix="mãi mãi"
            description="Dành cho thử nghiệm và cuộc họp không thường xuyên."
            features={FREE_FEATURES}
            cta="Bắt đầu miễn phí"
            href="/auth/signup"
          />
          <PricingCard
            name="Pro Manager"
            price="$19"
            suffix="/tháng"
            description="Dành cho founder/manager cần biến họp thành accountability."
            features={PRO_FEATURES}
            cta="Nâng cấp Pro"
            href="/auth/signup"
            highlighted
          />
        </div>

        <div className="mx-auto mt-10 max-w-4xl rounded-lg border border-slate-200 bg-slate-50 p-5">
          <h2 className="font-semibold text-slate-950">Team plan</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Team workspace, email reminders và integrations sẽ được thêm sau.
            Bản hiện tại tập trung làm Pro Manager thật mạnh trước.
          </p>
        </div>
      </section>
    </main>
  );
}

function PricingCard({
  name,
  price,
  suffix,
  description,
  features,
  cta,
  href,
  highlighted = false,
}: {
  name: string;
  price: string;
  suffix: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={
        highlighted
          ? "rounded-xl border-2 border-blue-700 bg-blue-700 p-8 text-white"
          : "rounded-xl border border-slate-200 p-8"
      }
    >
      <p
        className={
          highlighted
            ? "text-xs font-bold uppercase tracking-wide text-blue-200"
            : "text-xs font-bold uppercase tracking-wide text-slate-500"
        }
      >
        {name}
      </p>
      <div className="mt-3 flex items-end gap-1">
        <span
          className={
            highlighted
              ? "text-4xl font-bold"
              : "text-4xl font-bold text-slate-950"
          }
        >
          {price}
        </span>
        <span
          className={
            highlighted ? "mb-1 text-sm text-blue-200" : "mb-1 text-sm text-slate-500"
          }
        >
          {suffix}
        </span>
      </div>
      <p className={highlighted ? "mt-3 text-sm text-blue-100" : "mt-3 text-sm text-slate-600"}>
        {description}
      </p>
      <ul className="mt-6 space-y-3">
        {features.map((feature) => (
          <li
            key={feature}
            className={
              highlighted
                ? "flex items-center gap-2 text-sm text-blue-100"
                : "flex items-center gap-2 text-sm text-slate-700"
            }
          >
            <span className={highlighted ? "text-white" : "text-emerald-500"}>
              ✓
            </span>
            {feature}
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className={
          highlighted
            ? "mt-8 flex h-10 items-center justify-center rounded-md bg-white text-sm font-semibold text-blue-700 hover:bg-blue-50"
            : "mt-8 flex h-10 items-center justify-center rounded-md border border-slate-300 text-sm font-semibold text-slate-700 hover:border-blue-400 hover:text-blue-700"
        }
      >
        {cta}
      </Link>
    </div>
  );
}
