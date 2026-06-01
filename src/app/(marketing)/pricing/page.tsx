import Link from "next/link";
import { CheckoutButton } from "./checkout-button";
import { FREE_MONTHLY_LIMIT } from "@/lib/plans";

const FREE_FEATURES = [
  `${FREE_MONTHLY_LIMIT} cuộc họp/tháng`,
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

const BUSINESS_FEATURES = [
  "Team workspace",
  "Shared Action Board",
  "Manager Digest across team",
  "Priority support",
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
            blocker và quyết định qua nhiều cuộc họp. Business mở workspace
            chung cho cả team.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-6xl gap-6 lg:grid-cols-3">
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
            tier="pro"
            highlighted
          />
          <PricingCard
            name="Business"
            price="$49"
            suffix="/tháng"
            description="Dành cho team cần workspace chung và visibility qua nhiều người."
            features={BUSINESS_FEATURES}
            cta="Nâng cấp Business"
            tier="business"
          />
        </div>

        <div className="mx-auto mt-10 max-w-6xl rounded-lg border border-blue-100 bg-blue-50 p-5">
          <h2 className="font-semibold text-slate-950">Team workspace is live</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Business gom meeting notes, Action Board, Decision Log và Manager
            Digest theo workspace để manager nhìn được follow-through của cả team.
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
  tier,
  highlighted = false,
}: {
  name: string;
  price: string;
  suffix: string;
  description: string;
  features: string[];
  cta: string;
  href?: string;
  tier?: "pro" | "business";
  highlighted?: boolean;
}) {
  const ctaClasses = highlighted
    ? "flex h-10 w-full items-center justify-center rounded-md bg-white text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:bg-blue-100"
    : "flex h-10 w-full items-center justify-center rounded-md border border-slate-300 text-sm font-semibold text-slate-700 hover:border-blue-400 hover:text-blue-700 disabled:bg-slate-100";

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
      {tier ? (
        <CheckoutButton tier={tier} className={ctaClasses}>
          {cta}
        </CheckoutButton>
      ) : (
        <Link href={href || "/auth/signup"} className={`mt-8 ${ctaClasses}`}>
          {cta}
        </Link>
      )}
    </div>
  );
}
