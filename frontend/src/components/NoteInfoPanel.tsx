import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlignLeft,
  Clock,
  Code2,
  History,
  Image as ImageIcon,
  Layers,
  Link2,
  Star,
  X,
} from "lucide-react";

import { toEditorBlocks } from "../editor/convert";
import { topicsApi, versionsApi } from "../lib/api";
import type { Topic } from "../types";

interface Props {
  topic: Topic;
  onOpenHistory: () => void;
  onClose?: () => void;
}

export function NoteInfoPanel({ topic, onOpenHistory, onClose }: Props) {
  const qc = useQueryClient();
  const [checkpointDone, setCheckpointDone] = useState(false);

  const { data: children } = useQuery({
    queryKey: ["children", topic.id],
    queryFn: () => topicsApi.children(topic.id),
  });

  const blocks = useMemo(() => toEditorBlocks(topic.content), [topic.content]);

  const stats = useMemo(() => {
    const words = blocks
      .filter((b) => b.text)
      .map((b) => (b.text ?? "").trim().split(/\s+/).filter(Boolean).length)
      .reduce((a, b) => a + b, 0);
    return {
      words,
      minutes: Math.max(1, Math.round(words / 200)),
      code: blocks.filter((b) => b.type === "code").length,
      images: blocks.filter((b) => b.type === "image").length,
      links: blocks.filter((b) => b.type === "link").length,
    };
  }, [blocks]);

  const headings = blocks.filter((b) => ["h1", "h2", "h3"].includes(b.type) && (b.text ?? "").trim());

  const checkpointMutation = useMutation({
    mutationFn: () => versionsApi.createCheckpoint(topic.id, undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["versions", topic.id] });
      setCheckpointDone(true);
      window.setTimeout(() => setCheckpointDone(false), 2000);
    },
  });

  function jumpTo(blockId: string) {
    document.getElementById(`blk-${blockId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4">
      {/* Mobile-only header with a close control for the slide-over. */}
      {onClose && (
        <div className="-mt-1 flex items-center justify-between lg:hidden">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
            Details
          </span>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
            aria-label="Close"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* Outline */}
      {headings.length > 0 && (
        <Section title="On this page">
          <ul className="space-y-px">
            {headings.map((h) => (
              <li key={h.id}>
                <button
                  onClick={() => jumpTo(h.id)}
                  className={`block w-full truncate rounded-md py-1 text-left text-[13px] text-zinc-400 transition-colors hover:text-zinc-100 ${
                    h.type === "h1" ? "px-2" : h.type === "h2" ? "pl-5 pr-2" : "pl-8 pr-2"
                  }`}
                >
                  {h.text}
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Study stats */}
      <Section title="Details">
        <div className="space-y-1.5 px-2 text-[13px] text-zinc-400">
          <Row icon={AlignLeft} label={`${stats.words} words · ~${stats.minutes} min read`} />
          {stats.code > 0 && <Row icon={Code2} label={`${stats.code} code snippet${stats.code > 1 ? "s" : ""}`} />}
          {stats.images > 0 && <Row icon={ImageIcon} label={`${stats.images} image${stats.images > 1 ? "s" : ""}`} />}
          {stats.links > 0 && <Row icon={Link2} label={`${stats.links} link${stats.links > 1 ? "s" : ""}`} />}
          {(children?.length ?? 0) > 0 && (
            <Row icon={Layers} label={`${children!.length} subtopic${children!.length > 1 ? "s" : ""}`} />
          )}
          <Row icon={Clock} label={`Created ${fmt(topic.created_at)} · edited ${fmt(topic.updated_at)}`} />
        </div>
      </Section>

      {/* Actions */}
      <Section title="Actions">
        <div className="space-y-1.5 px-1">
          <button
            onClick={() => checkpointMutation.mutate()}
            disabled={checkpointMutation.isPending}
            className="flex w-full items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-300 transition-colors hover:border-amber-400/30 hover:text-amber-300 disabled:opacity-60"
          >
            <Star size={13} strokeWidth={2} className={checkpointDone ? "fill-amber-300 text-amber-300" : ""} />
            {checkpointDone ? "Checkpoint saved" : "Save checkpoint"}
          </button>
          <button
            onClick={onOpenHistory}
            className="flex w-full items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-300 transition-colors hover:border-white/[0.15] hover:text-zinc-100"
          >
            <History size={13} strokeWidth={2} />
            Version history
          </button>
        </div>
      </Section>

      {/* Shortcuts cheat-sheet */}
      <Section title="Shortcuts">
        <div className="space-y-1 px-2 text-xs text-zinc-500">
          <Shortcut k="/" label="Insert block (in editor)" />
          <Shortcut k="# · ## · -" label="Heading / bullet" />
          <Shortcut k="```" label="Code block" />
          <Shortcut k="Alt ↑↓" label="Move block" />
          <Shortcut k="← →" label="Prev / next page" />
          <Shortcut k="Alt ↑" label="Up to parent" />
          <Shortcut k="Alt N" label="New subtopic" />
          <Shortcut k="Alt P" label="Pin / unpin" />
          <Shortcut k="/ · Ctrl K" label="Search everything" />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Row({ icon: Icon, label }: { icon: typeof Clock; label: string }) {
  return (
    <p className="flex items-center gap-2">
      <Icon size={12} strokeWidth={1.75} className="shrink-0 text-zinc-600" />
      <span className="min-w-0 truncate">{label}</span>
    </p>
  );
}

function Shortcut({ k, label }: { k: string; label: string }) {
  return (
    <p className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <kbd className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-sans text-[10px] text-zinc-500">
        {k}
      </kbd>
    </p>
  );
}
