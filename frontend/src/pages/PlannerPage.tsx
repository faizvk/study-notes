import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ListTodo } from "lucide-react";

import { AgendaStrip } from "../components/planner/AgendaStrip";
import { NewPlanButton } from "../components/planner/NewPlanButton";
import { PlanDetail } from "../components/planner/PlanDetail";
import { PlanList } from "../components/planner/PlanList";
import { plansApi } from "../lib/api";

export function PlannerPage() {
  const { data: plans, isLoading } = useQuery({ queryKey: ["plans"], queryFn: plansApi.list });
  const [selectedId, setSelectedId] = useState<string | null>(
    () => localStorage.getItem("sn_plan") || null
  );

  // Remember the selection; default to the first plan once loaded (and recover
  // if the remembered plan was deleted).
  useEffect(() => {
    if (selectedId) localStorage.setItem("sn_plan", selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!plans) return;
    if (selectedId && plans.some((p) => p.id === selectedId)) return;
    setSelectedId(plans[0]?.id ?? null);
  }, [plans, selectedId]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
      <div className="animate-rise-in mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-8 sm:pt-12">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">Planner</h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-500">
          Roadmaps for the journey, checklists for the grind, reminders so nothing slips.
          Link steps to notes to jump straight into the material.
        </p>

        <AgendaStrip onPick={setSelectedId} />

        <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:gap-6">
          {/* Plans column */}
          <div className="w-full space-y-4 lg:w-72 lg:shrink-0">
            <NewPlanButton onCreated={setSelectedId} />
            {isLoading ? (
              <p className="px-1 text-sm text-zinc-600">Loading…</p>
            ) : plans && plans.length > 0 ? (
              <PlanList plans={plans} selectedId={selectedId} onSelect={setSelectedId} />
            ) : (
              <p className="rounded-xl border border-dashed border-white/[0.08] px-3 py-8 text-center text-sm text-zinc-600">
                No plans yet — create a roadmap for your next subject, or a checklist for
                this week's study tasks.
              </p>
            )}
          </div>

          {/* Detail column */}
          <div className="min-w-0 flex-1">
            {selectedId ? (
              <PlanDetail key={selectedId} planId={selectedId} onDeleted={() => setSelectedId(null)} />
            ) : (
              <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/[0.08] text-center">
                <ListTodo size={22} strokeWidth={1.5} className="text-zinc-700" />
                <p className="max-w-xs text-sm text-zinc-600">
                  Select a plan on the left, or create one to start mapping out your studies.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
