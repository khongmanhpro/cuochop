"use client";

import { useCallback, useState } from "react";

export function CopyFollowUpButton({
  label = "Copy follow-up",
  copiedLabel = "✓ Đã copy",
  brief,
  className,
}: {
  label?: string;
  copiedLabel?: string;
  brief: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(brief);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const textarea = document.createElement("textarea");
      textarea.value = brief;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [brief]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={
        className ??
        "inline-flex h-8 items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3 text-xs font-semibold text-ink transition hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-deep"
      }
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
