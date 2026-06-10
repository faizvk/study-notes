import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star, X } from "lucide-react";

import { versionsApi } from "../lib/api";
import type { VersionSummary } from "../types";

interface Props {
  topicId: string;
  onClose: () => void;
  onRestored: () => void;
}

export function VersionPanel({ topicId, onClose, onRestored }: Props) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const { data: versions, isLoading } = useQuery({
    queryKey: ["versions", topicId],
    queryFn: () => versionsApi.list(topicId),
  });

  const checkpointMutation = useMutation({
    mutationFn: (label?: string) => versionsApi.createCheckpoint(topicId, label),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["versions", topicId] });
    },
    onError: () => setError("Could not save checkpoint — try again."),
  });

  const restoreMutation = useMutation({
    mutationFn: (versionId: string) => versionsApi.restore(versionId),
    onSuccess: (topic) => {
      setError(null);
      qc.setQueryData(["topic", topicId], topic);
      qc.invalidateQueries({ queryKey: ["tree"] });
      qc.invalidateQueries({ queryKey: ["versions", topicId] });
      qc.invalidateQueries({ queryKey: ["children"] });
      qc.invalidateQueries({ queryKey: ["pinned"] });
      onRestored();
    },
    onError: () => setError("Restore failed — try again."),
  });

  const deleteMutation = useMutation({
    mutationFn: (versionId: string) => versionsApi.remove(versionId),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["versions", topicId] });
    },
    onError: () => setError("Delete failed — try again."),
  });

  function addCheckpoint() {
    const label = window.prompt("Name this checkpoint:", "Checkpoint");
    if (label !== null) checkpointMutation.mutate(label || undefined);
  }

  const checkpoints = (versions ?? []).filter((v) => v.is_checkpoint);
  const autosaves = (versions ?? []).filter((v) => !v.is_checkpoint);

  const renderRow = (v: VersionSummary) => (
    <VersionRow
      key={v.id}
      version={v}
      onRestore={() => restoreMutation.mutate(v.id)}
      onDelete={() => {
        if (window.confirm("Delete this version?")) deleteMutation.mutate(v.id);
      }}
    />
  );

  return (
    <div className="flex h-full flex-col">
      <div className="hairline flex items-center justify-between border-b px-4 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
          History
        </span>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 transition-colors duration-150 hover:bg-white/5 hover:text-zinc-200"
          aria-label="Close"
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>

      <div className="px-3 pt-3">
        <button
          onClick={addCheckpoint}
          disabled={checkpointMutation.isPending}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-3 py-1.5 text-[13px] font-medium text-indigo-300 transition-all duration-200 hover:bg-indigo-500/20 active:scale-[0.98] disabled:opacity-60"
        >
          <Star size={13} strokeWidth={2} />
          Save checkpoint
        </button>
      </div>

      {error && (
        <p className="animate-fade-in mx-3 mt-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs text-red-300">
          {error}
        </p>
      )}

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
        {isLoading ? (
          <p className="text-[13px] text-zinc-600">Loading…</p>
        ) : versions && versions.length > 0 ? (
          <>
            {checkpoints.length > 0 && (
              <Section title={`Checkpoints · ${checkpoints.length}`}>
                {checkpoints.map(renderRow)}
              </Section>
            )}
            {autosaves.length > 0 && (
              <Section title={`Auto-saves · ${autosaves.length}`}>
                {autosaves.map(renderRow)}
              </Section>
            )}
          </>
        ) : (
          <p className="text-[13px] leading-relaxed text-zinc-600">
            No versions yet. Your edits are snapshotted automatically as you type.
          </p>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
        {title}
      </h3>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}

function VersionRow({
  version,
  onRestore,
  onDelete,
}: {
  version: VersionSummary;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const when = new Date(version.created_at).toLocaleString();
  return (
    <li className="group rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 transition-all duration-200 hover:border-white/10 hover:bg-white/[0.04]">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 truncate text-[13px] font-medium text-zinc-200">
          {version.is_checkpoint && (
            <Star size={11} strokeWidth={2} className="shrink-0 fill-amber-300/90 text-amber-300/90" />
          )}
          {version.is_checkpoint ? version.label ?? "Checkpoint" : "Auto-save"}
        </span>
      </div>
      <div className="mt-0.5 truncate text-[11px] text-zinc-600" title={version.title_snapshot}>
        {version.title_snapshot} · {when}
      </div>
      <div className="mt-1.5 hidden gap-2 group-hover:flex">
        <button
          onClick={onRestore}
          className="rounded-md bg-indigo-600 px-2.5 py-0.5 text-[11px] font-medium text-white transition-all duration-200 hover:bg-indigo-500 active:scale-95"
        >
          Restore
        </button>
        <button
          onClick={onDelete}
          className="rounded-md px-2 py-0.5 text-[11px] text-zinc-600 transition-colors duration-200 hover:text-red-400"
        >
          Delete
        </button>
      </div>
    </li>
  );
}
