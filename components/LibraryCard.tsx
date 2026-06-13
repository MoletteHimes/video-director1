"use client";

import { Check } from "lucide-react";
import { PreviewAnimation } from "@/components/PreviewAnimation";
import { formatDisplayTags } from "@/lib/library-tags";
import { KnowledgeItem } from "@/types";

export function LibraryCard({
  item,
  onOpen,
  selectable = false,
  selected = false,
}: {
  item: KnowledgeItem;
  onOpen: (item: KnowledgeItem) => void;
  selectable?: boolean;
  selected?: boolean;
}) {
  const visibleTags = item.tags.slice(0, 4);
  const tagText = formatDisplayTags(visibleTags, item.category);

  return (
    <button
      onClick={() => onOpen(item)}
      className={`group relative w-full overflow-hidden rounded-xl border bg-black/25 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-cyan-300/[0.04] ${
        selected ? "border-cyan-200 shadow-neon" : "border-white/10"
      }`}
    >
      {selectable && (
        <span
          className={`absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-lg border transition ${
            selected
              ? "border-cyan-200 bg-cyan-300 text-slate-950"
              : "border-white/35 bg-slate-950/75 text-transparent"
          }`}
        >
          <Check className="h-4 w-4" />
        </span>
      )}
      <PreviewAnimation item={item} type={item.previewType} playback="hover" />

      <div className="px-3 pb-3 pt-2">
        <div className="mb-1">
          <div className="min-w-0 truncate text-xs leading-5 text-slate-300">
            {tagText}
          </div>
        </div>
        <h3 className="truncate text-lg font-black leading-6 text-white">{item.name}</h3>
      </div>
    </button>
  );
}
