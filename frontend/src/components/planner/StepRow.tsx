import { Check, Trash2 } from "lucide-react";

import type { PlanStep } from "../../types";

export interface StepRowProps {
  step: PlanStep;
  index: number;
  kind: "roadmap" | "checklist";
  onUpdate: (stepId: string, patch: Partial<PlanStep>) => void;
  onRemove: (stepId: string) => void;
}

const NEXT_STATUS: Record<PlanStep["status"], PlanStep["status"]> = {
  todo: "doing",
  doing: "done",
  done: "todo",
};

export function StepRow({ step, index, kind, onUpdate, onRemove }: StepRowProps) {
  const done = step.status === "done";

  return (
    <li className="group flex items-center gap-2.5 rounded-xl border border-white/[0.05] bg-white/[0.015] px-3 py-2 transition-colors duration-150 hover:border-white/[0.1] hover:bg-white/[0.03]">
      {/* Status control: roadmap shows the step number, checklist a checkbox.
          Clicking cycles todo → doing → done. */}
      <button
        onClick={() => onUpdate(step.id, { status: NEXT_STATUS[step.status] })}
        title={`Status: ${step.status} — click to change`}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium transition-all duration-200 active:scale-90 ${
          done
            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
            : step.status === "doing"
              ? "border-indigo-400/50 bg-indigo-500/15 text-indigo-300"
              : "border-white/15 text-zinc-500 hover:border-white/30"
        }`}
      >
        {done ? <Check size={12} strokeWidth={2.5} /> : kind === "roadmap" ? index + 1 : ""}
      </button>

      <input
        value={step.title}
        onChange={(e) => onUpdate(step.id, { title: e.target.value })}
        placeholder="Step…"
        className={`min-w-0 flex-1 bg-transparent text-[13px] outline-none transition-colors placeholder:text-zinc-600 ${
          done ? "text-zinc-500 line-through" : "text-zinc-200"
        }`}
      />

      <button
        onClick={() => onRemove(step.id)}
        title="Delete step"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-600 opacity-0 transition-all hover:bg-white/5 hover:text-red-400 group-hover:opacity-100"
      >
        <Trash2 size={12} strokeWidth={2} />
      </button>
    </li>
  );
}
