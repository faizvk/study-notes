import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";

import { topicsApi } from "../lib/api";
import { findPath } from "../lib/tree";

export function Breadcrumbs({ id }: { id: string }) {
  const { data: tree } = useQuery({ queryKey: ["tree"], queryFn: topicsApi.tree });
  const path = tree ? findPath(tree, id) ?? [] : [];
  const ancestors = path.slice(0, -1);
  const current = path.length ? path[path.length - 1].title || "Untitled" : "…";

  const sep = <ChevronRight size={11} strokeWidth={2} className="shrink-0 text-zinc-700" />;

  return (
    <nav className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-zinc-500">
      <Link to="/" className="transition-colors duration-150 hover:text-zinc-300">
        Home
      </Link>
      {sep}
      {ancestors.map((a) => (
        <span key={a.id} className="flex min-w-0 items-center gap-1.5">
          <Link
            to={`/n/${a.id}`}
            className="max-w-[10rem] truncate transition-colors duration-150 hover:text-zinc-300"
          >
            {a.title || "Untitled"}
          </Link>
          {sep}
        </span>
      ))}
      <span className="truncate text-zinc-300">{current}</span>
    </nav>
  );
}
