import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ListTodo, Map, Plus } from "lucide-react";

import { plansApi } from "../../lib/api";

export function NewPlanButton({ onCreated }: { onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"roadmap" | "checklist">("checklist");

  const createMutation = useMutation({
    mutationFn: () => plansApi.create({ title: title.trim() || "Untitled plan", kind }),
    onSuccess: (plan) => {
      qc.invalidateQueries({ queryKey: ["plans"] });
      setOpen(false);
      setTitle("");
      onCreated(plan.id);
    },
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[13px] font-medium text-zinc-400 transition-all duration-200 hover:bg-white/[0.06] hover:text-zinc-200 active:scale-[0.98]"
      >
        <Plus size={14} strokeWidth={2} />
        New plan
      </button>
    );
  }

  return (
    <div className="animate-rise-in space-y-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-2.5">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") createMutation.mutate();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Plan name…"
        className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors focus:border-indigo-400/40"
      />
      <div className="flex gap-1.5">
        {(
          [
            { value: "checklist", label: "Checklist", icon: ListTodo },
            { value: "roadmap", label: "Roadmap", icon: Map },
          ] as const
        ).map((opt) => (
          <button
            key={opt.value}
            onClick={() => setKind(opt.value)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs transition-colors duration-150 ${
              kind === opt.value
                ? "border-indigo-400/40 bg-indigo-500/10 text-indigo-300"
                : "border-white/[0.07] text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <opt.icon size={12} strokeWidth={2} />
            {opt.label}
          </button>
        ))}
      </div>
      <button
        onClick={() => createMutation.mutate()}
        disabled={createMutation.isPending}
        className="w-full rounded-lg bg-indigo-600/90 px-3 py-1.5 text-[13px] font-medium text-white transition-colors duration-200 hover:bg-indigo-500 disabled:opacity-60"
      >
        Create
      </button>
    </div>
  );
}
