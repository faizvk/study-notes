import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, Check, Link2, Trash2 } from "lucide-react";

import type { PlanStep } from "../../types";
import { NotePicker } from "./NotePicker";

/** "2026-06-14" ⇄ ISO datetime, due dates land at end-of-day local time. */
function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fromDateInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(`${value}T23:59:00`);
  return d.toISOString();
}

function dueTone(iso: string | null, done: boolean): string {
  if (!iso || done) return "text-zinc-600";
  const due = new Date(iso).getTime();
  const now = Date.now();
  if (due < now) return "text-red-400";
  if (due - now < 48 * 3600 * 1000) return "text-amber-300";
  return "text-zinc-500";
}

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
  const navigate = useNavigate();
  const [picking, setPicking] = useState(false);
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

      {/* Linked note: open it, or attach one via the picker. */}
      <span className="relative flex shrink-0 items-center">
        {step.topic_id ? (
          <button
            onClick={() => navigate(`/n/${step.topic_id}`)}
            onContextMenu={(e) => {
              e.preventDefault();
              onUpdate(step.id, { topic_id: null });
            }}
            title={`Open note: ${step.topic_title ?? "note"} (right-click to unlink)`}
            className="flex max-w-[10rem] items-center gap-1 truncate rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-[11px] text-indigo-300 transition-colors hover:bg-indigo-500/20"
          >
            <Link2 size={10} strokeWidth={2} />
            <span className="truncate">{step.topic_title ?? "note"}</span>
          </button>
        ) : (
          <button
            onClick={() => setPicking(true)}
            title="Link a note"
            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-600 opacity-0 transition-all hover:bg-white/5 hover:text-indigo-300 group-hover:opacity-100"
          >
            <Link2 size={12} strokeWidth={2} />
          </button>
        )}
        {picking && (
          <NotePicker
            onPick={(topicId) => {
              setPicking(false);
              onUpdate(step.id, { topic_id: topicId });
            }}
            onClose={() => setPicking(false)}
          />
        )}
      </span>

      {/* Due date — the reminders backbone. Overdue red, <48h amber. */}
      <label
        title={step.due_at ? "Due date — clear to remove" : "Set a due date"}
        className={`relative flex shrink-0 cursor-pointer items-center gap-1 text-[11px] transition-colors hover:text-zinc-300 ${dueTone(step.due_at, done)} ${
          step.due_at ? "" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <CalendarClock size={12} strokeWidth={2} />
        {step.due_at &&
          new Date(step.due_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
        <input
          type="date"
          value={toDateInput(step.due_at)}
          onChange={(e) => onUpdate(step.id, { due_at: fromDateInput(e.target.value) })}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>

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
