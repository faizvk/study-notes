import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronRight, FileText, Plus, Star, Trash2 } from "lucide-react";

import { topicsApi } from "../lib/api";
import type { TopicNode } from "../types";

export function TopicTree() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { id: selectedId } = useParams();
  const { data: tree, isLoading } = useQuery({ queryKey: ["tree"], queryFn: topicsApi.tree });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["tree"] });
    qc.invalidateQueries({ queryKey: ["children"] });
    qc.invalidateQueries({ queryKey: ["pinned"] });
  }

  const createMutation = useMutation({
    mutationFn: (parentId: string) => topicsApi.create({ title: "Untitled", parent_id: parentId }),
    onSuccess: (topic) => {
      invalidateAll();
      if (topic.parent_id) setExpanded((s) => new Set(s).add(topic.parent_id as string));
      navigate(`/n/${topic.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => topicsApi.remove(id),
    onSuccess: invalidateAll,
  });

  function toggle(id: string) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderNodes(nodes: TopicNode[], depth: number) {
    return nodes.map((node) => {
      const hasChildren = node.children.length > 0;
      const isExpanded = expanded.has(node.id);
      const isSelected = selectedId === node.id;
      return (
        <div key={node.id}>
          <div
            className={`group flex items-center gap-1 rounded-lg py-1 pr-1.5 text-[13px] transition-colors duration-150 ${
              isSelected
                ? "bg-indigo-500/15 text-indigo-200"
                : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
            }`}
            style={{ paddingLeft: depth * 14 + 6 }}
          >
            <button
              onClick={() => hasChildren && toggle(node.id)}
              className={`flex h-4 w-4 shrink-0 items-center justify-center text-zinc-600 transition-transform duration-200 hover:text-zinc-300 ${
                hasChildren ? "" : "invisible"
              } ${isExpanded ? "rotate-90" : ""}`}
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              <ChevronRight size={13} strokeWidth={2} />
            </button>
            {node.is_pinned ? (
              <Star size={11} strokeWidth={2} className="shrink-0 fill-amber-300/90 text-amber-300/90" />
            ) : (
              <FileText size={12} strokeWidth={1.75} className="shrink-0 text-zinc-600" />
            )}
            <button
              onClick={() => navigate(`/n/${node.id}`)}
              className="flex-1 truncate py-0.5 text-left"
              title={node.title}
            >
              {node.title || "Untitled"}
            </button>
            <div className="hidden items-center group-hover:flex">
              <button
                onClick={() => createMutation.mutate(node.id)}
                title="Add subtopic"
                className="flex h-5 w-5 items-center justify-center rounded text-zinc-500 transition-colors duration-150 hover:text-indigo-300"
              >
                <Plus size={12} strokeWidth={2.25} />
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Delete "${node.title || "Untitled"}" and all its subtopics?`)) {
                    deleteMutation.mutate(node.id);
                  }
                }}
                title="Delete"
                className="flex h-5 w-5 items-center justify-center rounded text-zinc-500 transition-colors duration-150 hover:text-red-400"
              >
                <Trash2 size={12} strokeWidth={2} />
              </button>
            </div>
          </div>
          {hasChildren && isExpanded && (
            <div className="animate-fade-in">{renderNodes(node.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  }

  if (isLoading) return <p className="px-3 text-[13px] text-zinc-600">Loading…</p>;
  if (!tree || tree.length === 0)
    return <p className="px-3 text-[13px] text-zinc-600">No notes yet.</p>;
  return <div className="space-y-px px-1">{renderNodes(tree, 0)}</div>;
}
