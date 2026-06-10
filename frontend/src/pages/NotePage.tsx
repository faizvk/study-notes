import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";

import { toEditorBlocks } from "../editor/convert";
import { topicsApi } from "../lib/api";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { NoteContentEditor } from "../components/NoteContentEditor";
import { NoteInfoPanel } from "../components/NoteInfoPanel";
import { PagerArrows, PagerFooter, useAdjacentNotes } from "../components/NotePager";
import { SubtopicGrid } from "../components/SubtopicGrid";
import { TagEditor } from "../components/TagEditor";
import { VersionPanel } from "../components/VersionPanel";

export function NotePage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { prev, next } = useAdjacentNotes(id);

  // Page-flip feel: land at the top of each note, and allow keyboard flips.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [id]);

  const { data: topic, isLoading } = useQuery({
    queryKey: ["topic", id],
    queryFn: () => topicsApi.get(id),
  });

  // Arriving from search (?q=…): scroll to the first block containing the
  // query and flash it, instead of just landing at the top of the note.
  const [searchParams] = useSearchParams();
  const jumpedFor = useRef<string | null>(null);
  const searchQuery = searchParams.get("q") ?? "";

  useEffect(() => {
    const key = `${id}|${searchQuery}`;
    if (!topic || !searchQuery || jumpedFor.current === key) return;
    jumpedFor.current = key;
    const needle = searchQuery.toLowerCase();
    const target = toEditorBlocks(topic.content).find(
      (b) =>
        (b.text ?? "").toLowerCase().includes(needle) ||
        (b.url ?? "").toLowerCase().includes(needle)
    );
    if (!target) return;
    // Let the editor mount its rows first.
    window.setTimeout(() => {
      const el = document.getElementById(`blk-${target.id}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("flash-jump");
      window.setTimeout(() => el.classList.remove("flash-jump"), 1800);
    }, 120);
  }, [topic, id, searchQuery]);

  const [title, setTitle] = useState("");
  const [showVersions, setShowVersions] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  // While the title input is focused, server refetches must not clobber typing.
  const editingTitle = useRef(false);

  useEffect(() => {
    if (topic && !editingTitle.current) setTitle(topic.title);
  }, [topic?.title]);

  const updateMutation = useMutation({
    mutationFn: (data: { title?: string; is_pinned?: boolean }) => topicsApi.update(id, data),
    onSuccess: (updated) => {
      qc.setQueryData(["topic", id], updated);
      qc.invalidateQueries({ queryKey: ["tree"] });
      qc.invalidateQueries({ queryKey: ["pinned"] });
      qc.invalidateQueries({ queryKey: ["children", updated.parent_id ?? "root"] });
    },
  });

  // Notebook keyboard shortcuts. Plain arrows flip pages only while NOT
  // editing text; Ctrl+Alt+arrows always work, even mid-edit.
  useEffect(() => {
    function editing(): boolean {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      return (
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT" ||
        el.isContentEditable
      );
    }
    async function newSubtopic() {
      const created = await topicsApi.create({ title: "Untitled", parent_id: id });
      qc.invalidateQueries({ queryKey: ["tree"] });
      qc.invalidateQueries({ queryKey: ["children", id] });
      navigate(`/n/${created.id}`);
    }
    function onKey(e: KeyboardEvent) {
      const free = !editing();
      if (e.ctrlKey && e.altKey && e.key === "ArrowRight" && next) {
        e.preventDefault();
        navigate(`/n/${next.id}`);
      } else if (e.ctrlKey && e.altKey && e.key === "ArrowLeft" && prev) {
        e.preventDefault();
        navigate(`/n/${prev.id}`);
      } else if (free && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === "ArrowRight" && next) {
          e.preventDefault();
          navigate(`/n/${next.id}`);
        } else if (e.key === "ArrowLeft" && prev) {
          e.preventDefault();
          navigate(`/n/${prev.id}`);
        }
      } else if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === "ArrowUp" && free && topic?.parent_id) {
          e.preventDefault();
          navigate(`/n/${topic.parent_id}`);
        } else if (e.key.toLowerCase() === "p" && topic) {
          e.preventDefault();
          updateMutation.mutate({ is_pinned: !topic.is_pinned });
        } else if (e.key.toLowerCase() === "n") {
          e.preventDefault();
          void newSubtopic();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prev, next, navigate, id, topic?.parent_id, topic?.is_pinned]);

  if (isLoading || !topic) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-600">
        Loading…
      </div>
    );
  }

  function saveTitle() {
    if (topic && title !== topic.title) updateMutation.mutate({ title });
  }

  return (
    <div className="flex h-full min-h-0">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="animate-rise-in mx-auto w-full max-w-6xl px-6 pb-16 pt-6">
          <div className="mb-4 flex items-center justify-between gap-3 px-1">
            <Breadcrumbs id={id} />
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => updateMutation.mutate({ is_pinned: !topic.is_pinned })}
                title={topic.is_pinned ? "Unpin" : "Pin"}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200 active:scale-90 ${
                  topic.is_pinned
                    ? "text-amber-300"
                    : "text-zinc-500 hover:bg-white/5 hover:text-amber-300"
                }`}
              >
                <Star size={15} strokeWidth={2} className={topic.is_pinned ? "fill-amber-300" : ""} />
              </button>
              <span className="mx-1 h-4 w-px bg-white/10" />
              <PagerArrows id={id} />
            </div>
          </div>

          {/* Document sheet: black page; blocks inside sit on grey surfaces. */}
          <div className="rounded-2xl border border-white/[0.09] bg-[#0d0d0d] px-8 py-7">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onFocus={() => (editingTitle.current = true)}
              onBlur={() => {
                editingTitle.current = false;
                saveTitle();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              placeholder="Untitled"
              className="w-full border-none bg-transparent text-4xl font-bold tracking-tight text-zinc-50 placeholder:text-zinc-700 focus:outline-none"
            />

            <TagEditor topic={topic} />

            <div className="mt-6">
              <NoteContentEditor key={`${id}-${reloadNonce}`} topic={topic} />
            </div>
          </div>

          <SubtopicGrid parentId={id} title="Subtopics" addLabel="Add subtopic" />

          <PagerFooter id={id} />
        </div>
      </div>

      {/* Right rail: study info by default, version history when toggled. */}
      <div className="hidden w-72 shrink-0 overflow-y-auto rounded-tl-2xl bg-[var(--bg-side)] lg:block">
        {showVersions ? (
          <VersionPanel
            topicId={id}
            onClose={() => setShowVersions(false)}
            onRestored={() => setReloadNonce((n) => n + 1)}
          />
        ) : (
          <NoteInfoPanel topic={topic} onOpenHistory={() => setShowVersions(true)} />
        )}
      </div>
    </div>
  );
}
