"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function HistoryTagFilter({
  allTags,
  activeTag,
}: {
  allTags: string[];
  activeTag: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (allTags.length === 0) return null;

  function selectTag(tag: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!tag) params.delete("tag");
    else params.set("tag", tag);
    const qs = params.toString();
    router.push(qs ? `/history?${qs}` : "/history");
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <span className="text-[13px] font-semibold text-steel">Lọc thẻ:</span>
      <button
        type="button"
        onClick={() => selectTag("")}
        className={
          !activeTag
            ? "button-primary h-9 px-4 text-[13px]"
            : "button-tertiary h-9 px-4 text-[13px]"
        }
      >
        Tất cả
      </button>
      {allTags.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => selectTag(tag)}
          className={
            activeTag === tag
              ? "button-primary h-9 px-4 text-[13px]"
              : "button-tertiary h-9 px-4 text-[13px]"
          }
        >
          #{tag}
        </button>
      ))}
    </div>
  );
}
