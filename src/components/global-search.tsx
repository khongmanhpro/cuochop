"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type SearchResult = {
  type: "note" | "decision" | "action";
  id: string;
  title: string;
  snippet: string;
  meetingDate: string;
  meetingTitle: string;
  meetingId: string;
};

type ResultType = SearchResult["type"] | "all";

const TYPE_LABELS: Record<SearchResult["type"], string> = {
  note: "Ghi chú",
  decision: "Quyết định",
  action: "Công việc",
};

const TYPE_COLORS: Record<SearchResult["type"], string> = {
  note: "bg-brand-blue-200/40 text-brand-blue-deep",
  decision: "bg-brand-purple/10 text-brand-purple",
  action: "bg-brand-coral/10 text-brand-coral",
};

const FILTER_LABELS: Record<ResultType, string> = {
  all: "Tất cả",
  note: "Ghi chú",
  decision: "Quyết định",
  action: "Công việc",
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<ResultType>("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const openSearch = useCallback(() => {
    setOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setLoading(false);
    setTypeFilter("all");
    setActiveIndex(0);
  }, []);

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) {
          closeSearch();
        } else {
          openSearch();
        }
      }
      if (e.key === "Escape") {
        closeSearch();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeSearch, open, openSearch]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? []);
          setActiveIndex(0);
        }
      } catch {
        // ignore abort
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Filtered results
  const filteredResults = typeFilter === "all"
    ? results
    : results.filter((r) => r.type === typeFilter);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    function handleNav(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filteredResults.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && filteredResults.length > 0) {
        e.preventDefault();
        const result = filteredResults[activeIndex];
        if (result) {
          closeSearch();
          router.push(getSearchResultHref(result));
        }
      }
    }

    document.addEventListener("keydown", handleNav);
    return () => document.removeEventListener("keydown", handleNav);
  }, [open, filteredResults, activeIndex, closeSearch, router]);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (value.length < 2) {
      setResults([]);
      setLoading(false);
    }
  }

  const handleSelect = useCallback(
    (result: SearchResult) => {
      closeSearch();
      router.push(getSearchResultHref(result));
    },
    [closeSearch, router],
  );

  // Group filtered results by type
  const grouped = filteredResults.reduce(
    (acc, r) => {
      (acc[r.type] ??= []).push(r);
      return acc;
    },
    {} as Record<SearchResult["type"], SearchResult[]>,
  );

  if (!open) {
    return (
      <button
        onClick={openSearch}
        className="inline-flex items-center gap-2 rounded-full border border-hairline bg-canvas px-3 py-1.5 text-sm text-steel transition hover:border-primary hover:text-primary"
      >
        <SearchIcon />
        <span className="hidden sm:inline">Tìm kiếm...</span>
        <kbd className="ml-1 hidden rounded border border-hairline bg-surface px-1 py-0.5 text-[10px] font-medium text-steel sm:inline">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={closeSearch}
      />

      {/* Search modal */}
      <div className="fixed inset-x-0 top-0 z-50 mx-auto mt-[10vh] w-full max-w-lg px-4">
        <div className="overflow-hidden rounded-[18px] border border-hairline bg-canvas shadow-2xl">
          {/* Input */}
          <div className="flex items-center gap-2 border-b border-hairline-soft px-4 py-3">
            <SearchIcon />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Tìm ghi chú, quyết định, công việc..."
              className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-steel"
            />
            {loading && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-hairline border-t-primary" />
            )}
            <button
              onClick={closeSearch}
              className="rounded px-1.5 py-0.5 text-xs text-steel hover:bg-surface"
            >
              ESC
            </button>
          </div>

          {/* Type filters */}
          <div className="flex gap-1 border-b border-hairline-soft px-4 py-2">
            {(["all", "note", "decision", "action"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setTypeFilter(type);
                  setActiveIndex(0);
                }}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  typeFilter === type
                    ? "bg-ink text-on-dark"
                    : "text-steel hover:text-ink"
                }`}
              >
                {FILTER_LABELS[type]}
              </button>
            ))}
            {results.length > 0 && (
              <span className="ml-auto self-center text-[10px] text-steel">
                {filteredResults.length} kết quả
              </span>
            )}
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {query.length >= 2 && filteredResults.length === 0 && !loading && (
              <p className="px-4 py-8 text-center text-sm text-steel">
                Không tìm thấy kết quả cho &ldquo;{query}&rdquo;
              </p>
            )}

            {(["note", "decision", "action"] as const).map(
              (type) =>
                grouped[type] && (
                  <div key={type}>
                    <p className="border-b border-hairline-soft bg-surface px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-steel">
                      {TYPE_LABELS[type]}
                    </p>
                    {grouped[type].map((r) => {
                      const globalIdx = filteredResults.indexOf(r);
                      const isActive = globalIdx === activeIndex;
                      return (
                        <button
                          key={`${r.type}-${r.id}`}
                          onClick={() => handleSelect(r)}
                          onMouseEnter={() => setActiveIndex(globalIdx)}
                          className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition ${
                            isActive ? "bg-surface" : ""
                          }`}
                        >
                          <span
                            className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${TYPE_COLORS[r.type]}`}
                          >
                            {TYPE_LABELS[r.type]}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-ink">
                              {r.title}
                            </p>
                            <p
                              className="truncate text-xs text-steel [&_mark]:bg-brand-blue-200 [&_mark]:text-inherit"
                              dangerouslySetInnerHTML={{ __html: r.snippet }}
                            />
                            <p className="mt-0.5 text-[10px] text-steel">
                              {r.meetingTitle}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ),
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export function getSearchResultHref(result: SearchResult): string {
  if (result.type === "note") {
    return `/history/${result.meetingId}`;
  }

  const params = new URLSearchParams({
    meeting: result.meetingId,
    highlight: result.id,
    section: result.type,
  });

  return `/actions?${params.toString()}`;
}

function SearchIcon() {
  return (
    <svg
      className="h-4 w-4 text-steel"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}
