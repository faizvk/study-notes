import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowRight, FileText, Star } from "lucide-react";

import { searchApi } from "../lib/api";
import { SubtopicGrid } from "../components/SubtopicGrid";

export function HomePage() {
  const navigate = useNavigate();
  // Empty query returns the user's notes ordered pinned-first, most recently
  // edited first — exactly what "jump back in" wants.
  const { data: recent } = useQuery({
    queryKey: ["recent"],
    queryFn: () => searchApi.search(""),
    staleTime: 10_000,
  });
  const resume = (recent ?? []).slice(0, 4);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="animate-rise-in mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-8 sm:pt-12">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">Your notes</h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-500">
          Open a note to add content and subtopics. Drag the grip to reorder, or drop a
          card onto another to nest it.
        </p>

        {resume.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold tracking-tight text-zinc-200">
              Jump back in
            </h2>
            <div className="stagger flex flex-wrap gap-2">
              {resume.map((r) => (
                <button
                  key={r.id}
                  onClick={() => navigate(`/n/${r.id}`)}
                  className="group flex max-w-xs items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] py-2 pl-3 pr-2.5 text-left transition-colors duration-200 hover:border-white/[0.14] hover:bg-white/[0.04]"
                >
                  {r.is_pinned ? (
                    <Star size={13} strokeWidth={2} className="shrink-0 fill-amber-300/90 text-amber-300/90" />
                  ) : (
                    <FileText size={13} strokeWidth={1.75} className="shrink-0 text-zinc-500" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-zinc-100">
                      {r.title || "Untitled"}
                    </span>
                    {r.snippet && (
                      <span className="block max-w-[14rem] truncate text-[11px] text-zinc-500">
                        {r.snippet}
                      </span>
                    )}
                  </span>
                  <ArrowRight
                    size={12}
                    strokeWidth={2}
                    className="shrink-0 text-zinc-600 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  />
                </button>
              ))}
            </div>
          </section>
        )}

        <SubtopicGrid parentId={null} title="All notes" addLabel="New note" />
      </div>
    </div>
  );
}
