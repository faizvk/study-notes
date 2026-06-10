import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, useNavigate } from "react-router-dom";
import { ListTodo, Plus, Star, StickyNote } from "lucide-react";

import { searchApi, topicsApi } from "../lib/api";
import { TopicTree } from "./TopicTree";

export function Sidebar({ onOpenPalette }: { onOpenPalette: (tag?: string) => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: pinned } = useQuery({ queryKey: ["pinned"], queryFn: topicsApi.pinned });
  const { data: tags } = useQuery({ queryKey: ["tags"], queryFn: searchApi.tags });

  const createRoot = useMutation({
    mutationFn: () => topicsApi.create({ title: "Untitled" }),
    onSuccess: (topic) => {
      qc.invalidateQueries({ queryKey: ["tree"] });
      qc.invalidateQueries({ queryKey: ["children"] });
      qc.invalidateQueries({ queryKey: ["pinned"] });
      navigate(`/n/${topic.id}`);
    },
  });

  const navCls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors duration-150 ${
      isActive ? "bg-white/[0.06] text-zinc-100" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
    }`;

  return (
    <div className="flex h-full flex-col">
      {/* Primary navigation */}
      <nav className="space-y-0.5 px-2 pb-2">
        <NavLink to="/" end className={navCls}>
          <StickyNote size={14} strokeWidth={1.75} />
          Notes
        </NavLink>
        <NavLink to="/plan" className={navCls}>
          <ListTodo size={14} strokeWidth={1.75} />
          Planner
        </NavLink>
      </nav>

      <div className="px-3 pb-1 pt-1">
        <button
          onClick={() => createRoot.mutate()}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[13px] font-medium text-zinc-400 transition-all duration-200 hover:bg-white/[0.06] hover:text-zinc-200 active:scale-[0.98]"
        >
          <Plus size={14} strokeWidth={2} />
          New note
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-2 py-3">
        {pinned && pinned.length > 0 && (
          <Section title="Pinned">
            <ul className="space-y-px">
              {pinned.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => navigate(`/n/${p.id}`)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-zinc-300 transition-colors duration-150 hover:bg-white/[0.04] hover:text-zinc-100"
                  >
                    <Star size={12} strokeWidth={2} className="shrink-0 fill-amber-300/90 text-amber-300/90" />
                    <span className="truncate">{p.title || "Untitled"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Notes">
          <TopicTree />
        </Section>

        {tags && tags.length > 0 && (
          <Section title="Tags">
            <div className="flex flex-wrap gap-1.5 px-1">
              {tags.map((t) => (
                <button
                  key={t}
                  onClick={() => onOpenPalette(t)}
                  className="rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-0.5 text-xs text-zinc-400 transition-all duration-200 hover:-tranzinc-y-px hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-indigo-300"
                >
                  #{t}
                </button>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
        {title}
      </h3>
      {children}
    </div>
  );
}
