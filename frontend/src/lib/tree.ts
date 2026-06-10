import type { TopicNode } from "../types";

/** Returns the chain of nodes from a root down to (and including) `id`, or null. */
export function findPath(nodes: TopicNode[], id: string): TopicNode[] | null {
  for (const n of nodes) {
    if (n.id === id) return [n];
    const sub = findPath(n.children, id);
    if (sub) return [n, ...sub];
  }
  return null;
}
