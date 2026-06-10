import { useQuery } from "@tanstack/react-query";
import { AlarmClock } from "lucide-react";

import { plansApi } from "../../lib/api";
import type { AgendaItem } from "../../types";

interface Props {
  onPick: (planId: string) => void;
}

function bucket(item: AgendaItem): "overdue" | "today" | "soon" {
  const due = new Date(item.due_at);
  const now = new Date();
  if (due.getTime() < now.getTime() && due.toDateString() !== now.toDateString()) return "overdue";
  if (due.toDateString() === now.toDateString()) return "today";
  return "soon";
}

const TONES: Record<string, string> = {
  overdue: "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20",
  today: "border-amber-400/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20",
  soon: "border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]",
};

export function AgendaStrip({ onPick }: Props) {
  const { data: items } = useQuery({ queryKey: ["agenda"], queryFn: plansApi.agenda });
  if (!items || items.length === 0) return null;

  const shown = items.slice(0, 8);

  return (
    <section className="mt-6">
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold tracking-tight text-zinc-200">
        <AlarmClock size={13} strokeWidth={2} className="text-zinc-500" />
        Reminders
      </h2>
      <div className="flex flex-wrap gap-2">
        {shown.map((item) => {
          const b = bucket(item);
          return (
            <button
              key={item.step_id}
              onClick={() => onPick(item.plan_id)}
              title={`${item.plan_title} — due ${new Date(item.due_at).toLocaleDateString()}`}
              className={`flex max-w-xs items-center gap-2 rounded-xl border px-3 py-1.5 text-left text-xs transition-colors duration-150 ${TONES[b]}`}
            >
              <span className="truncate font-medium">{item.title || "Untitled step"}</span>
              <span className="shrink-0 opacity-70">
                {b === "overdue"
                  ? "overdue"
                  : b === "today"
                    ? "today"
                    : new Date(item.due_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
              </span>
            </button>
          );
        })}
        {items.length > shown.length && (
          <span className="self-center text-xs text-zinc-600">+{items.length - shown.length} more</span>
        )}
      </div>
    </section>
  );
}
