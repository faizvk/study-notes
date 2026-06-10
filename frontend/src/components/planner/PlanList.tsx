import type { ReactNode } from "react";
import { ListTodo, Map } from "lucide-react";

import type { PlanSummary } from "../../types";

interface Props {
  plans: PlanSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function PlanList({ plans, selectedId, onSelect }: Props) {
  const roadmaps = plans.filter((p) => p.kind === "roadmap");
  const checklists = plans.filter((p) => p.kind === "checklist");

  return (
    <div className="space-y-5">
      {roadmaps.length > 0 && (
        <Group title="Roadmaps">
          {roadmaps.map((p) => (
            <PlanRow key={p.id} plan={p} selected={p.id === selectedId} onSelect={onSelect} />
          ))}
        </Group>
      )}
      {checklists.length > 0 && (
        <Group title="Checklists">
          {checklists.map((p) => (
            <PlanRow key={p.id} plan={p} selected={p.id === selectedId} onSelect={onSelect} />
          ))}
        </Group>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
        {title}
      </h3>
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}

function PlanRow({
  plan,
  selected,
  onSelect,
}: {
  plan: PlanSummary;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const pct = plan.total_steps > 0 ? Math.round((plan.done_steps / plan.total_steps) * 100) : 0;
  const Icon = plan.kind === "roadmap" ? Map : ListTodo;
  return (
    <li>
      <button
        onClick={() => onSelect(plan.id)}
        className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors duration-150 ${
          selected
            ? "border-white/[0.14] bg-white/[0.06]"
            : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]"
        }`}
      >
        <span className="flex items-center gap-2">
          <Icon size={13} strokeWidth={1.75} className="shrink-0 text-zinc-500" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-zinc-200">
            {plan.title || "Untitled plan"}
          </span>
          <span className="shrink-0 text-[11px] text-zinc-600">
            {plan.done_steps}/{plan.total_steps}
          </span>
        </span>
        {plan.total_steps > 0 && (
          <span className="mt-2 block h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <span
              className="block h-full rounded-full bg-indigo-500/80 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </span>
        )}
      </button>
    </li>
  );
}
