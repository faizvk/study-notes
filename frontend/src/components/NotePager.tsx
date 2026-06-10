import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { topicsApi } from "../lib/api";
import type { TopicNode } from "../types";

interface FlatNote {
  id: string;
  title: string;
}

/** Notebook page order = depth-first walk of the topic tree:
 *  a topic, then its subtopics, then the next topic — like reading a book. */
export function useAdjacentNotes(id: string): { prev: FlatNote | null; next: FlatNote | null } {
  const { data: tree } = useQuery({ queryKey: ["tree"], queryFn: topicsApi.tree });
  return useMemo(() => {
    if (!tree) return { prev: null, next: null };
    const flat: FlatNote[] = [];
    const walk = (nodes: TopicNode[]) => {
      for (const n of nodes) {
        flat.push({ id: n.id, title: n.title || "Untitled" });
        walk(n.children);
      }
    };
    walk(tree);
    const i = flat.findIndex((n) => n.id === id);
    return {
      prev: i > 0 ? flat[i - 1] : null,
      next: i >= 0 && i < flat.length - 1 ? flat[i + 1] : null,
    };
  }, [tree, id]);
}

/** Compact chevrons for the note header row. */
export function PagerArrows({ id }: { id: string }) {
  const navigate = useNavigate();
  const { prev, next } = useAdjacentNotes(id);

  const cls = (enabled: boolean) =>
    `flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 active:scale-90 ${
      enabled ? "text-zinc-400 hover:bg-white/5 hover:text-zinc-100" : "cursor-default text-zinc-700"
    }`;

  return (
    <div className="flex items-center">
      <button
        disabled={!prev}
        onClick={() => prev && navigate(`/n/${prev.id}`)}
        title={prev ? `Previous: ${prev.title}` : "First page"}
        className={cls(!!prev)}
      >
        <ChevronLeft size={16} strokeWidth={2} />
      </button>
      <button
        disabled={!next}
        onClick={() => next && navigate(`/n/${next.id}`)}
        title={next ? `Next: ${next.title}` : "Last page"}
        className={cls(!!next)}
      >
        <ChevronRight size={16} strokeWidth={2} />
      </button>
    </div>
  );
}

/** Full-width Previous / Next cards for the bottom of the page. */
export function PagerFooter({ id }: { id: string }) {
  const navigate = useNavigate();
  const { prev, next } = useAdjacentNotes(id);
  if (!prev && !next) return null;

  return (
    <nav className="mt-10 flex gap-3">
      {prev ? (
        <button
          onClick={() => navigate(`/n/${prev.id}`)}
          className="group flex flex-1 items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-left transition-colors duration-200 hover:border-white/[0.15] hover:bg-white/[0.04]"
        >
          <ChevronLeft
            size={16}
            strokeWidth={2}
            className="shrink-0 text-zinc-500 transition-transform duration-200 group-hover:-translate-x-0.5"
          />
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
              Previous
            </span>
            <span className="block truncate text-[13px] font-medium text-zinc-200">{prev.title}</span>
          </span>
        </button>
      ) : (
        <span className="flex-1" />
      )}
      {next ? (
        <button
          onClick={() => navigate(`/n/${next.id}`)}
          className="group flex flex-1 items-center justify-end gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-right transition-colors duration-200 hover:border-white/[0.15] hover:bg-white/[0.04]"
        >
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
              Next
            </span>
            <span className="block truncate text-[13px] font-medium text-zinc-200">{next.title}</span>
          </span>
          <ChevronRight
            size={16}
            strokeWidth={2}
            className="shrink-0 text-zinc-500 transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </button>
      ) : (
        <span className="flex-1" />
      )}
    </nav>
  );
}
