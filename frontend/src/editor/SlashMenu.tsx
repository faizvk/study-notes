import {
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Link2,
  List,
  Minus,
  Type,
  type LucideIcon,
} from "lucide-react";

import type { BlockType } from "./types";

export interface SlashItem {
  type: BlockType | "image-upload";
  label: string;
  hint: string;
  icon: LucideIcon;
  keywords: string;
}

export const SLASH_ITEMS: SlashItem[] = [
  { type: "paragraph", label: "Text", hint: "Plain paragraph", icon: Type, keywords: "text paragraph plain p" },
  { type: "h1", label: "Heading 1", hint: "Large section heading", icon: Heading1, keywords: "h1 heading title" },
  { type: "h2", label: "Heading 2", hint: "Medium heading", icon: Heading2, keywords: "h2 heading subtitle" },
  { type: "h3", label: "Heading 3", hint: "Small heading", icon: Heading3, keywords: "h3 heading" },
  { type: "bullet", label: "Bullet list", hint: "Simple bullet point", icon: List, keywords: "bullet list ul item" },
  { type: "code", label: "Code", hint: "Code block with highlighting", icon: Code2, keywords: "code snippet pre" },
  { type: "image-upload", label: "Image", hint: "Upload or paste an image", icon: ImageIcon, keywords: "image picture photo upload img" },
  { type: "link", label: "Link", hint: "Bookmark a URL", icon: Link2, keywords: "link url bookmark website" },
  { type: "divider", label: "Divider", hint: "Horizontal rule", icon: Minus, keywords: "divider rule hr separator line" },
];

export function filterSlashItems(query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_ITEMS;
  return SLASH_ITEMS.filter(
    (item) => item.label.toLowerCase().includes(q) || item.keywords.includes(q)
  );
}

interface MenuProps {
  items: SlashItem[];
  selected: number;
  onPick: (item: SlashItem) => void;
  onHover: (index: number) => void;
}

export function SlashMenu({ items, selected, onPick, onHover }: MenuProps) {
  if (items.length === 0) return null;
  return (
    <div className="animate-scale-in absolute left-0 top-full z-30 mt-1 w-72 overflow-hidden rounded-xl border border-white/10 bg-[#1d1d1d] py-1.5 shadow-2xl shadow-black/60">
      {items.map((item, i) => (
        <button
          key={item.label}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(item)}
          onMouseEnter={() => onHover(i)}
          className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-100 ${
            i === selected ? "bg-white/[0.07]" : ""
          }`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-zinc-400">
            <item.icon size={14} strokeWidth={1.75} />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-medium text-zinc-100">{item.label}</span>
            <span className="block text-[11px] text-zinc-500">{item.hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
