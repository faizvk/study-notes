import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { BlockEditor } from "../editor/BlockEditor";
import { toEditorBlocks } from "../editor/convert";
import type { EditorBlock } from "../editor/types";
import { topicsApi } from "../lib/api";
import type { Topic } from "../types";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function NoteContentEditor({ topic }: { topic: Topic }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<SaveStatus>("idle");

  // Convert once per mount (the page remounts this component per note/restore).
  const initial = useMemo(() => toEditorBlocks(topic.content), []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveMutation = useMutation({
    mutationFn: (content: EditorBlock[]) =>
      topicsApi.update(topic.id, { content: content as unknown as unknown[] }),
    onMutate: () => setStatus("saving"),
    onSuccess: (updated) => {
      setStatus("saved");
      qc.setQueryData(["topic", topic.id], updated);
      qc.invalidateQueries({ queryKey: ["versions", topic.id] });
      // Content only affects the parent's card preview — not the (title-only) tree.
      qc.invalidateQueries({ queryKey: ["children", topic.parent_id ?? "root"] });
    },
    onError: () => setStatus("error"),
  });

  const timer = useRef<number | undefined>(undefined);
  // Track unsaved edits so they can be flushed if the user navigates away
  // before the debounce fires (otherwise the last keystrokes would be lost).
  const dirty = useRef(false);
  const latest = useRef<EditorBlock[] | null>(null);

  function handleChange(blocks: EditorBlock[]) {
    dirty.current = true;
    latest.current = blocks;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      dirty.current = false;
      saveMutation.mutate(blocks);
    }, 800);
  }

  useEffect(() => {
    function flush() {
      if (!dirty.current || !latest.current) return;
      dirty.current = false;
      window.clearTimeout(timer.current);
      topicsApi
        .update(topic.id, { content: latest.current as unknown as unknown[] })
        .then(() => {
          qc.invalidateQueries({ queryKey: ["topic", topic.id] });
          qc.invalidateQueries({ queryKey: ["versions", topic.id] });
          qc.invalidateQueries({ queryKey: ["children", topic.parent_id ?? "root"] });
        })
        .catch(() => {});
    }
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      flush(); // unmount (navigation) — persist pending edits
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusLabel =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "Saved"
        : status === "error"
          ? "Save failed — retry"
          : "";

  return (
    <div>
      <div
        className={`mb-1 h-4 text-right text-xs ${status === "error" ? "text-red-400" : "text-zinc-600"}`}
      >
        {statusLabel}
      </div>
      <BlockEditor initial={initial} onChange={handleChange} />
    </div>
  );
}
