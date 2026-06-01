"use client";

import { useState, useTransition } from "react";
import { getErrorCode, getErrorMessage, readApiError } from "@/lib/api-client";
import type { CheckoutTier } from "@/lib/billing";

export function CheckoutButton({
  tier,
  organizationId,
  children,
  className,
  wrapperClassName = "mt-8",
}: {
  tier: CheckoutTier;
  organizationId?: string;
  children: React.ReactNode;
  className: string;
  wrapperClassName?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startCheckout() {
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tier, organizationId }),
        });

        if (!response.ok) {
          const apiError = await readApiError(
            response,
            "Không thể tạo checkout. Vui lòng thử lại.",
          );
          if (getErrorCode(apiError) === "UNAUTHENTICATED") {
            window.location.href = `/auth/signup?tier=${tier}`;
            return;
          }
          throw apiError;
        }

        const body = (await response.json()) as { url?: string };
        if (!body.url) {
          throw new Error("Không thể tạo checkout URL.");
        }

        window.location.href = body.url;
      } catch (checkoutError) {
        setError(getErrorMessage(checkoutError, "Không thể tạo checkout."));
      }
    });
  }

  return (
    <div className={wrapperClassName}>
      <button
        type="button"
        disabled={isPending}
        onClick={startCheckout}
        className={className}
      >
        {isPending ? "Đang mở checkout..." : children}
      </button>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
