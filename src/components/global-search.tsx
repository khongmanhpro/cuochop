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

const TYPE_LABELS: Record<SearchResult["type"], string> = {
  note: "Ghi chú",
  decision: "Quyết định",
  action: "Công việc",
};

const TYPE_COLORS: Record<SearchResult["type"], string> = {
  note: "bg-blue-100 text-blue-700",
  decision: "bg-purple-100 text-purple-700",
  action: "bg-amber-100 text-amber-700",
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
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

  // Group results by type
  const grouped = results.reduce(
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
        className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-500"
      >
        <SearchIcon />
        <span className="hidden sm:inline">Tìm kiếm...</span>
        <kbd className="ml-1 hidden rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px] font-medium text-slate-400 sm:inline">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={closeSearch}
      />

      {/* Search modal */}
      <div className="fixed inset-x-0 top-0 z-50 mx-auto mt-[10vh] w-full max-w-lg px-4">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
          {/* Input */}
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <SearchIcon />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Tìm ghi chú, quyết định, công việc..."
              className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
            />
            {loading && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
            )}
            <button
              onClick={closeSearch}
              className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-100"
            >
              ESC
            </button>
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {query.length >= 2 && results.length === 0 && !loading && (
              <p className="px-4 py-8 text-center text-sm text-slate-400">
                Không tìm thấy kết quả cho &ldquo;{query}&rdquo;
              </p>
            )}

            {(["note", "decision", "action"] as const).map(
              (type) =>
                grouped[type] && (
                  <div key={type}>
                    <p className="border-b border-slate-50 bg-slate-50/50 px-4 py-1.5 text-xs font-medium text-slate-500">
                      {TYPE_LABELS[type]}
                    </p>
                    {grouped[type].map((r) => (
                      <button
                        key={`${r.type}-${r.id}`}
                        onClick={() => handleSelect(r)}
                        className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-blue-50"
                      >
                        <span
                          className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${TYPE_COLORS[r.type]}`}
                        >
                          {TYPE_LABELS[r.type]}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {r.title}
                          </p>
                          <p
                            className="truncate text-xs text-slate-500 [&_mark]:bg-yellow-200 [&_mark]:text-inherit"
                            dangerouslySetInnerHTML={{ __html: r.snippet }}
                          />
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            {r.meetingTitle}
                          </p>
                        </div>
                      </button>
                    ))}
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
  const params = new URLSearchParams({
    meeting: result.meetingId,
    highlight: result.id,
    section: result.type,
  });

  return result.type === "note"
    ? `/history?${params.toString()}`
    : `/actions?${params.toString()}`;
}

function SearchIcon() {
  return (
    <svg
      className="h-4 w-4 text-slate-400"
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
