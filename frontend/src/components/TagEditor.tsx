import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";

import { topicsApi } from "../lib/api";
import type { Topic } from "../types";

export function TagEditor({ topic }: { topic: Topic }) {
  const qc = useQueryClient();
  const [input, setInput] = useState("");

  const [error, setError] = useState(false);

  const mutation = useMutation({
    mutationFn: (tags: string[]) => topicsApi.update(topic.id, { tags }),
    onSuccess: (updated) => {
      setError(false);
      qc.setQueryData(["topic", topic.id], updated);
      qc.invalidateQueries({ queryKey: ["tags"] });
      qc.invalidateQueries({ queryKey: ["children", topic.parent_id ?? "root"] });
    },
    onError: () => setError(true),
  });

  function addTag() {
    const t = input.trim().replace(/^#/, "");
    setInput("");
    if (t && !topic.tags.includes(t)) mutation.mutate([...topic.tags, t]);
  }

  function removeTag(tag: string) {
    mutation.mutate(topic.tags.filter((x) => x !== tag));
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {topic.tags.map((t) => (
        <span
          key={t}
          className="animate-fade-in group flex items-center gap-1 rounded-full bg-indigo-500/10 py-0.5 pl-2.5 pr-1.5 text-xs text-indigo-300 transition-colors duration-200 hover:bg-indigo-500/20"
        >
          #{t}
          <button
            onClick={() => removeTag(t)}
            className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-indigo-400/60 transition-colors duration-150 hover:text-indigo-100"
            aria-label={`Remove tag ${t}`}
          >
            <X size={10} strokeWidth={2.5} />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") addTag();
        }}
        onBlur={addTag}
        placeholder="+ tag"
        className="w-16 rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-0.5 text-xs text-zinc-300 placeholder:text-zinc-600 transition-all duration-200 focus:w-28 focus:border-indigo-400/40 focus:outline-none"
      />
      {error && <span className="text-xs text-red-400">Tag update failed — retry.</span>}
    </div>
  );
}
