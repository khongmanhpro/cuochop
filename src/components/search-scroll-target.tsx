"use client";

import { useEffect } from "react";

export function SearchScrollTarget({ highlightId }: { highlightId?: string }) {
  useEffect(() => {
    if (!highlightId) return;

    const target = document.querySelector<HTMLElement>(
      `[data-search-id="${CSS.escape(highlightId)}"]`,
    );
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.dataset.searchHighlighted = "true";

    const timer = window.setTimeout(() => {
      delete target.dataset.searchHighlighted;
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [highlightId]);

  return null;
}
