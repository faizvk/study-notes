import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListTodo, Map, Plus, Trash2 } from "lucide-react";

import { plansApi } from "../../lib/api";
import type { Plan, PlanStep } from "../../types";
import { StepRow } from "./StepRow";

interface Props {
  planId: string;
  onDeleted: () => void;
}

export function PlanDetail({ planId, onDeleted }: Props) {
  const qc = useQueryClient();
  const { data: plan, isLoading } = useQuery({
    queryKey: ["plan", planId],
    queryFn: () => plansApi.get(planId),
  });

  const [title, setTitle] = useState("");
  const [newStep, setNewStep] = useState("");
  useEffect(() => {
    if (plan) setTitle(plan.title);
  }, [plan?.title]); // eslint-disable-line react-hooks/exhaustive-deps

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["plan", planId] });
    qc.invalidateQueries({ queryKey: ["plans"] });
    qc.invalidateQueries({ queryKey: ["agenda"] });
  }

  const titleMutation = useMutation({
    mutationFn: (t: string) => plansApi.update(planId, { title: t }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: () => plansApi.remove(planId),
    onSuccess: () => {
      invalidate();
      onDeleted();
    },
  });

  const addMutation = useMutation({
    mutationFn: (t: string) => plansApi.addStep(planId, { title: t }),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: (stepId: string) => plansApi.removeStep(stepId),
    onSuccess: invalidate,
  });

  // Step edits: update the cache immediately, debounce the server PATCH per step.
  const timers = useRef(new Map<string, number>());
  function updateStep(stepId: string, patch: Partial<PlanStep>) {
    qc.setQueryData<Plan>(["plan", planId], (cur) =>
      cur
        ? { ...cur, steps: cur.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)) }
        : cur
    );
    window.clearTimeout(timers.current.get(stepId));
    timers.current.set(
      stepId,
      window.setTimeout(() => {
        void plansApi
          .updateStep(stepId, patch as Parameters<typeof plansApi.updateStep>[1])
          .then(invalidate)
          .catch(invalidate);
      }, 500)
    );
  }

  function moveStep(stepId: string, dir: -1 | 1) {
    const cur = qc.getQueryData<Plan>(["plan", planId]);
    if (!cur) return;
    const i = cur.steps.findIndex((s) => s.id === stepId);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= cur.steps.length) return;
    const steps = [...cur.steps];
    [steps[i], steps[j]] = [steps[j], steps[i]];
    qc.setQueryData<Plan>(["plan", planId], { ...cur, steps });
    void plansApi.reorderSteps(planId, steps.map((s) => s.id)).then(invalidate).catch(invalidate);
  }

  if (isLoading || !plan) {
    return <p className="px-1 text-sm text-zinc-600">Loading…</p>;
  }

  const Icon = plan.kind === "roadmap" ? Map : ListTodo;
  const pct = plan.total_steps > 0 ? Math.round((plan.done_steps / plan.total_steps) * 100) : 0;

  function submitStep() {
    const t = newStep.trim();
    if (!t) return;
    setNewStep("");
    addMutation.mutate(t);
  }

  return (
    <div className="rounded-2xl border border-white/[0.09] bg-[#0d0d0d] p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-zinc-400">
            <Icon size={14} strokeWidth={1.75} />
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title !== plan.title && titleMutation.mutate(title)}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            placeholder="Untitled plan"
            className="min-w-0 flex-1 bg-transparent text-xl font-semibold tracking-tight text-zinc-50 outline-none placeholder:text-zinc-700"
          />
        </div>
        <button
          onClick={() => {
            if (window.confirm(`Delete "${plan.title}" and all its steps?`)) deleteMutation.mutate();
          }}
          title="Delete plan"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-white/5 hover:text-red-400"
        >
          <Trash2 size={14} strokeWidth={2} />
        </button>
      </div>

      {/* Progress */}
      {plan.total_steps > 0 && (
        <div className="mt-4 flex items-center gap-3">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            <span
              className="block h-full rounded-full bg-indigo-500/80 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </span>
          <span className="shrink-0 text-xs text-zinc-500">
            {plan.done_steps}/{plan.total_steps} · {pct}%
          </span>
        </div>
      )}

      {/* Steps */}
      <ul className="mt-5 space-y-1.5">
        {plan.steps.map((step, i) => (
          <StepRow
            key={step.id}
            step={step}
            index={i}
            kind={plan.kind}
            onUpdate={updateStep}
            onRemove={(id) => removeMutation.mutate(id)}
            onMove={moveStep}
          />
        ))}
      </ul>

      {/* Add step */}
      <div className="mt-3 flex items-center gap-2">
        <Plus size={14} strokeWidth={2} className="shrink-0 text-zinc-600" />
        <input
          value={newStep}
          onChange={(e) => setNewStep(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitStep()}
          placeholder={plan.kind === "roadmap" ? "Add a milestone…" : "Add a task…"}
          className="flex-1 bg-transparent py-1.5 text-[13px] text-zinc-200 outline-none placeholder:text-zinc-600"
        />
      </div>
    </div>
  );
}
