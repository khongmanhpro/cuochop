import Link from "next/link";
import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: ReactNode;
  cta?: {
    label: string;
    href: string;
  };
  className?: string;
};

export function EmptyState({
  title,
  description,
  icon,
  cta,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline bg-surface px-6 py-10 text-center ${className ?? ""}`}
    >
      {icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-canvas text-2xl text-steel">
          {icon}
        </div>
      ) : null}
      <h3 className="text-[18px] font-semibold leading-[1.30] text-ink">
        {title}
      </h3>
      <p className="mt-2 max-w-[480px] text-[14px] leading-[1.50] text-slate">
        {description}
      </p>
      {cta ? (
        <Link
          href={cta.href}
          className="mt-6 inline-flex h-10 items-center rounded-full bg-primary px-5 text-[14px] font-semibold text-on-dark transition-colors hover:bg-charcoal"
        >
          {cta.label}
        </Link>
      ) : null}
    </div>
  );
}
