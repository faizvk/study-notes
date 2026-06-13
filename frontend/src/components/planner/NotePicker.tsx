import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Search } from "lucide-react";

import { searchApi } from "../../lib/api";

interface Props {
  onPick: (topicId: string, title: string) => void;
  onClose: () => void;
}

/** Small inline note search used to attach a note to a plan step. */
export function NotePicker({ onPick, onClose }: Props) {
  const [q, setQ] = useState("");
  const { data: results } = useQuery({
    queryKey: ["search", q, ""],
    queryFn: () => searchApi.search(q),
    enabled: q.trim().length > 0,
  });

  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} />
      <div className="animate-scale-in absolute right-0 top-full z-30 mt-1 w-72 max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-xl border border-white/10 bg-[#1d1d1d] shadow-2xl shadow-black/60">
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2">
          <Search size={12} strokeWidth={2} className="shrink-0 text-zinc-500" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && onClose()}
            placeholder="Link a note…"
            className="flex-1 bg-transparent text-[13px] text-zinc-100 placeholder:text-zinc-600 outline-none"
          />
        </div>
        <div className="max-h-56 overflow-y-auto py-1">
          {results && results.length > 0 ? (
            results.slice(0, 8).map((r) => (
              <button
                key={r.id}
                onClick={() => onPick(r.id, r.title)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-zinc-300 transition-colors hover:bg-white/[0.05]"
              >
                <FileText size={12} strokeWidth={1.75} className="shrink-0 text-zinc-600" />
                <span className="truncate">{r.title || "Untitled"}</span>
              </button>
            ))
          ) : (
            <p className="px-3 py-4 text-center text-xs text-zinc-600">
              {q.trim() ? "No matches." : "Type to search your notes."}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
