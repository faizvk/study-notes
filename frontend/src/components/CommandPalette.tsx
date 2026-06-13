import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CornerDownLeft, FileText, Search, Star, X } from "lucide-react";

import { searchApi } from "../lib/api";

interface Props {
  open: boolean;
  initialTag?: string;
  onClose: () => void;
}

/** Render text with case-insensitive occurrences of `query` highlighted. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const parts: Array<{ s: string; hit: boolean }> = [];
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  let i = 0;
  while (i < text.length) {
    const hit = lower.indexOf(needle, i);
    if (hit === -1) {
      parts.push({ s: text.slice(i), hit: false });
      break;
    }
    if (hit > i) parts.push({ s: text.slice(i, hit), hit: false });
    parts.push({ s: text.slice(hit, hit + needle.length), hit: true });
    i = hit + needle.length;
  }
  return (
    <>
      {parts.map((p, idx) =>
        p.hit ? (
          <mark key={idx} className="rounded-sm bg-indigo-500/30 px-0.5 text-indigo-100">
            {p.s}
          </mark>
        ) : (
          <span key={idx}>{p.s}</span>
        )
      )}
    </>
  );
}

export function CommandPalette({ open, initialTag, onClose }: Props) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (open) {
      setQ("");
      setTag(initialTag);
      setSelected(0);
    }
  }, [open, initialTag]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const { data: results } = useQuery({
    queryKey: ["search", q, tag ?? ""],
    queryFn: () => searchApi.search(q, tag),
    enabled: open && (q.trim().length > 0 || !!tag),
  });

  // Keep the keyboard selection within bounds whenever the result set changes.
  useEffect(() => {
    setSelected(0);
  }, [results]);

  if (!open) return null;

  function go(id: string) {
    onClose();
    const query = q.trim();
    // Carry the query so the note page can scroll to the matching section.
    navigate(query ? `/n/${id}?q=${encodeURIComponent(query)}` : `/n/${id}`);
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (!results || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const target = results[selected] ?? results[0];
      if (target) go(target.id);
    }
  }

  const hasQuery = q.trim().length > 0 || !!tag;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-start justify-center bg-zinc-950/70 px-3 pt-20 backdrop-blur-sm sm:pt-[18vh]"
      onClick={onClose}
    >
      <div
        className="animate-scale-in w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#1d1d1d] shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hairline flex items-center gap-3 border-b px-4 py-3.5">
          <Search size={16} strokeWidth={2} className="shrink-0 text-zinc-500" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search notes, code, links…"
            className="flex-1 bg-transparent text-[15px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
          />
          {tag && (
            <button
              onClick={() => setTag(undefined)}
              className="flex items-center gap-1 rounded-full bg-indigo-500/15 px-2.5 py-1 text-xs text-indigo-300 transition-colors duration-150 hover:bg-indigo-500/25"
            >
              #{tag}
              <X size={11} strokeWidth={2.5} />
            </button>
          )}
        </div>

        <div className="max-h-[20rem] overflow-y-auto">
          {results && results.length > 0 ? (
            <ul className="p-1.5">
              {results.map((r, i) => (
                <li key={r.id}>
                  <button
                    onClick={() => go(r.id)}
                    onMouseEnter={() => setSelected(i)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 ${
                      i === selected ? "bg-white/[0.06]" : ""
                    }`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-zinc-500">
                      {r.is_pinned ? (
                        <Star size={13} strokeWidth={2} className="fill-amber-300/90 text-amber-300/90" />
                      ) : (
                        <FileText size={13} strokeWidth={1.75} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-zinc-100">
                        <Highlight text={r.title || "Untitled"} query={q} />
                      </span>
                      {r.snippet && (
                        <span className="block truncate text-xs text-zinc-500">
                          <Highlight text={r.snippet} query={q} />
                        </span>
                      )}
                    </span>
                    {r.tags.length > 0 && (
                      <span className="shrink-0 text-[10px] text-indigo-300/80">
                        {r.tags.slice(0, 2).map((t) => `#${t}`).join(" ")}
                      </span>
                    )}
                    {i === selected && (
                      <CornerDownLeft size={13} strokeWidth={2} className="shrink-0 text-zinc-500" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : hasQuery ? (
            <p className="px-4 py-10 text-center text-sm text-zinc-600">No matches.</p>
          ) : (
            <p className="px-4 py-10 text-center text-sm text-zinc-600">
              Type to search across all your notes — titles, text, code, and links.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
