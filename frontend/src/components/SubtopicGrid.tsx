import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CornerDownRight, Plus } from "lucide-react";

import { topicsApi } from "../lib/api";
import type { TopicCard } from "../types";
import { NoteCard } from "./NoteCard";

interface Props {
  parentId: string | null;
  title: string;
  addLabel: string;
}

export function SubtopicGrid({ parentId, title, addLabel }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const key = parentId ?? "root";

  const { data: cards, isLoading } = useQuery({
    queryKey: ["children", key],
    queryFn: () => topicsApi.children(parentId),
  });

  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  // Mouse drags after a small move; touch requires a short press-and-hold so a
  // normal finger swipe scrolls the page instead of starting a card drag.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const createMutation = useMutation({
    mutationFn: (t: string) => topicsApi.create({ title: t || "Untitled", parent_id: parentId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["children", key] });
      qc.invalidateQueries({ queryKey: ["tree"] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) =>
      topicsApi.reorder({ parent_id: parentId, ordered_ids: orderedIds }),
    // Optimistic reorder with rollback if the request fails.
    onMutate: async (orderedIds: string[]) => {
      await qc.cancelQueries({ queryKey: ["children", key] });
      const prev = qc.getQueryData<TopicCard[]>(["children", key]);
      if (prev) {
        const byId = new Map(prev.map((c) => [c.id, c]));
        const next = orderedIds
          .map((id) => byId.get(id))
          .filter((c): c is TopicCard => Boolean(c));
        qc.setQueryData(["children", key], next);
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["children", key], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["children", key] }),
  });

  const moveMutation = useMutation({
    mutationFn: (vars: { id: string; parent_id: string }) =>
      topicsApi.move(vars.id, { parent_id: vars.parent_id, position: 9999 }),
    onSuccess: (_data, vars) => {
      // Refresh only the source (this grid) and destination parents.
      qc.invalidateQueries({ queryKey: ["children", key] });
      qc.invalidateQueries({ queryKey: ["children", vars.parent_id] });
      qc.invalidateQueries({ queryKey: ["tree"] });
    },
  });

  const pinMutation = useMutation({
    mutationFn: (vars: { id: string; is_pinned: boolean }) =>
      topicsApi.update(vars.id, { is_pinned: vars.is_pinned }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["children", key] });
      qc.invalidateQueries({ queryKey: ["pinned"] });
      qc.invalidateQueries({ queryKey: ["tree"] });
    },
  });

  // Prefer a "nest" drop zone when the pointer is over one; otherwise fall back to
  // sortable reordering.
  const collisionDetection: CollisionDetection = (args) => {
    const within = pointerWithin(args);
    const nest = within.find((c) => String(c.id).startsWith("nest:"));
    if (nest) return [nest];
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (d) => !String(d.id).startsWith("nest:")
      ),
    });
  };

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over || !cards) return;
    const activeStr = String(active.id);
    const overStr = String(over.id);

    if (overStr.startsWith("nest:")) {
      const target = overStr.slice(5);
      if (target !== activeStr) moveMutation.mutate({ id: activeStr, parent_id: target });
      return;
    }
    if (overStr !== activeStr) {
      const oldIndex = cards.findIndex((c) => c.id === activeStr);
      const newIndex = cards.findIndex((c) => c.id === overStr);
      if (oldIndex !== -1 && newIndex !== -1) {
        const next = arrayMove(cards, oldIndex, newIndex);
        reorderMutation.mutate(next.map((c) => c.id)); // optimism handled in onMutate
      }
    }
  }

  function submitNew() {
    const t = newTitle.trim();
    setNewTitle("");
    setAdding(false);
    if (t) createMutation.mutate(t);
  }

  const activeCard = cards?.find((c) => c.id === activeId) ?? null;

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-200">
          {title}
          {cards && cards.length > 0 ? (
            <span className="ml-1.5 font-normal text-zinc-500">· {cards.length}</span>
          ) : null}
        </h2>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 text-xs text-zinc-400 transition-all duration-200 hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-indigo-300 active:scale-95"
          >
            <Plus size={12} strokeWidth={2.25} />
            {addLabel}
          </button>
        )}
      </div>

      {adding && (
        <div className="animate-rise-in mb-3 flex gap-2">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNew();
              if (e.key === "Escape") {
                setAdding(false);
                setNewTitle("");
              }
            }}
            onBlur={submitNew}
            placeholder={`${addLabel} name…`}
            className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 transition-all duration-200 focus:border-indigo-400/50 focus:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
          />
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={submitNew}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-indigo-500 active:scale-95"
          >
            Add
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : cards && cards.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={cards.map((c) => c.id)} strategy={rectSortingStrategy}>
            <div className="stagger grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
              {cards.map((card) => (
                <SortableCard
                  key={card.id}
                  card={card}
                  activeId={activeId}
                  onOpen={() => navigate(`/n/${card.id}`)}
                  onTogglePin={() => pinMutation.mutate({ id: card.id, is_pinned: !card.is_pinned })}
                />
              ))}
            </div>
          </SortableContext>
          {createPortal(
            <DragOverlay>
              {activeCard ? (
                <div className="rounded-xl border border-white/15 bg-[#1d1d1d] p-4 shadow-2xl shadow-black/50">
                  <span className="line-clamp-1 font-medium text-zinc-100">
                    {activeCard.title || "Untitled"}
                  </span>
                </div>
              ) : null}
            </DragOverlay>,
            document.body
          )}
        </DndContext>
      ) : (
        <p className="animate-fade-in rounded-2xl border border-dashed border-white/[0.08] px-3 py-12 text-center text-sm text-zinc-600">
          {adding ? "Type a name above and press Enter." : "Nothing here yet."}
        </p>
      )}
    </section>
  );
}

function SortableCard({
  card,
  activeId,
  onOpen,
  onTogglePin,
}: {
  card: TopicCard;
  activeId: string | null;
  onOpen: () => void;
  onTogglePin: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });
  const showNest = activeId !== null && activeId !== card.id;
  // Disabled droppables are excluded from collision detection, so the nest zone is
  // only a target while another card is being dragged (never the dragged card itself).
  const nest = useDroppable({ id: `nest:${card.id}`, disabled: !showNest });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <NoteCard
        card={card}
        onOpen={onOpen}
        onTogglePin={onTogglePin}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
      {/* Invisible center drop zone: pointer over the card's middle = nest;
          near the edges = reorder. Lights up only while actually hovered. */}
      <div
        ref={nest.setNodeRef}
        className="pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[78%] -tranzinc-x-1/2 -tranzinc-y-1/2"
      >
        <div
          className={`flex h-full w-full items-center justify-center rounded-xl border border-dashed transition-all duration-150 ${
            nest.isOver
              ? "border-indigo-400/70 bg-indigo-500/15 opacity-100 backdrop-blur-[2px]"
              : "border-transparent opacity-0"
          }`}
        >
          <span className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-lg shadow-black/40">
            <CornerDownRight size={12} strokeWidth={2} />
            Nest inside
          </span>
        </div>
      </div>
    </div>
  );
}
