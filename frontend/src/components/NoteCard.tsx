import { GripVertical, Layers, Star } from "lucide-react";

import type { TopicCard } from "../types";

interface Props {
  card: TopicCard;
  onOpen: () => void;
  onTogglePin: () => void;
  // dnd-kit sortable attributes + listeners, spread onto the drag handle.
  dragHandleProps?: Record<string, unknown>;
}

export function NoteCard({ card, onOpen, onTogglePin, dragHandleProps }: Props) {
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 transition-colors duration-200 ease-out hover:border-white/[0.14] hover:bg-white/[0.04]">
      <div className="mb-2 flex items-center justify-between">
        <button
          {...dragHandleProps}
          title="Drag to reorder · drop onto another card to nest"
          className="-ml-1 cursor-grab text-zinc-600 opacity-0 transition-all duration-200 hover:text-zinc-300 group-hover:opacity-100 active:cursor-grabbing"
        >
          <GripVertical size={14} strokeWidth={2} />
        </button>
        <button
          onClick={onTogglePin}
          title={card.is_pinned ? "Unpin" : "Pin"}
          className={`transition-all duration-200 hover:scale-110 active:scale-95 ${
            card.is_pinned
              ? "text-amber-300"
              : "text-zinc-600 opacity-0 hover:text-amber-300 group-hover:opacity-100"
          }`}
        >
          <Star size={14} strokeWidth={2} className={card.is_pinned ? "fill-amber-300" : ""} />
        </button>
      </div>

      <button onClick={onOpen} className="flex-1 text-left">
        <span className="line-clamp-1 text-[15px] font-medium tracking-tight text-zinc-100 transition-colors duration-200 group-hover:text-white">
          {card.title || "Untitled"}
        </span>
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-zinc-500">
          {card.preview || "Empty note"}
        </p>
      </button>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {card.child_count > 0 && (
          <span className="flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
            <Layers size={9} strokeWidth={2} />
            {card.child_count}
          </span>
        )}
        {card.tags.slice(0, 3).map((t) => (
          <span
            key={t}
            className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-300/90"
          >
            #{t}
          </span>
        ))}
      </div>
    </div>
  );
}
