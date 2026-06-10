import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { Plus } from "lucide-react";

import { filesApi } from "../lib/api";
import { caretOffset } from "./caret";
import { CodeBlock, DividerBlock, ImageBlock, LinkBlock, TextBlock } from "./blocks";
import { isStructured, parseHtml, parsePlainText } from "./paste";
import { filterSlashItems, SlashMenu, type SlashItem } from "./SlashMenu";
import { isTextBlock, newBlock, type EditorBlock } from "./types";

interface Props {
  initial: EditorBlock[];
  onChange: (blocks: EditorBlock[]) => void;
}

interface MenuState {
  blockId: string;
  query: string;
  index: number;
}

const PLACEHOLDERS: Record<string, string> = {
  h1: "Heading 1",
  h2: "Heading 2",
  h3: "Heading 3",
  bullet: "List item",
  paragraph: "Write, or type '/' for blocks…",
};

export function BlockEditor({ initial, onChange }: Props) {
  const [blocks, setBlocks] = useState<EditorBlock[]>(initial);
  const [menu, setMenu] = useState<MenuState | null>(null);

  const focusFns = useRef(new Map<string, (pos: number) => void>());
  const pendingFocus = useRef<{ id: string; pos: number } | null>(null);

  const register = useCallback((id: string, fn: ((pos: number) => void) | null) => {
    if (fn) focusFns.current.set(id, fn);
    else focusFns.current.delete(id);
  }, []);

  useLayoutEffect(() => {
    if (pendingFocus.current) {
      const { id, pos } = pendingFocus.current;
      pendingFocus.current = null;
      focusFns.current.get(id)?.(pos);
    }
  });

  function update(next: EditorBlock[], focus?: { id: string; pos: number }) {
    if (focus) pendingFocus.current = focus;
    setBlocks(next);
    onChange(next);
  }

  const at = (id: string) => blocks.findIndex((b) => b.id === id);
  const patch = (id: string, p: Partial<EditorBlock>) =>
    update(blocks.map((b) => (b.id === id ? { ...b, ...p } : b)));

  /* ── structural operations ───────────────────────────────── */

  function insertAfter(id: string, block: EditorBlock, focusPos = 0) {
    const i = at(id);
    const next = [...blocks.slice(0, i + 1), block, ...blocks.slice(i + 1)];
    update(next, isTextBlock(block) || block.type === "code" ? { id: block.id, pos: focusPos } : undefined);
    return block;
  }

  function remove(id: string) {
    const i = at(id);
    let next = blocks.filter((b) => b.id !== id);
    let focus: { id: string; pos: number } | undefined;
    if (next.length === 0) {
      const empty = newBlock();
      next = [empty];
      focus = { id: empty.id, pos: 0 };
    } else {
      const neighbor = next[Math.max(0, i - 1)];
      if (isTextBlock(neighbor)) focus = { id: neighbor.id, pos: (neighbor.text ?? "").length };
    }
    update(next, focus);
  }

  function moveBlock(id: string, dir: -1 | 1) {
    const i = at(id);
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  }

  /* ── slash menu ──────────────────────────────────────────── */

  function applySlashItem(blockId: string, item: SlashItem) {
    setMenu(null);
    if (item.type === "image-upload") {
      update(blocks.map((b) => (b.id === blockId ? { ...newBlock("image"), id: b.id, url: "" } : b)));
      return;
    }
    if (item.type === "link") {
      update(blocks.map((b) => (b.id === blockId ? { ...newBlock("link"), id: b.id, url: "" } : b)));
      return;
    }
    if (item.type === "divider") {
      const i = at(blockId);
      const para = newBlock();
      const next = [...blocks];
      next.splice(i, 1, { ...newBlock("divider"), id: blockId }, para);
      update(next, { id: para.id, pos: 0 });
      return;
    }
    const focusTarget = { id: blockId, pos: 0 };
    update(
      blocks.map((b) =>
        b.id === blockId
          ? { ...b, type: item.type as EditorBlock["type"], text: "", language: item.type === "code" ? "text" : undefined }
          : b
      ),
      focusTarget
    );
  }

  /* ── text block events ───────────────────────────────────── */

  function handleTextInput(id: string, text: string) {
    const block = blocks.find((b) => b.id === id);
    if (!block) return;

    // Slash menu lifecycle: open while the block content is "/query".
    if (text.startsWith("/") && !text.includes(" ")) {
      setMenu({ blockId: id, query: text.slice(1), index: 0 });
    } else if (menu?.blockId === id) {
      setMenu(null);
    }

    // Markdown shortcuts at line start.
    const shortcuts: Array<[string, EditorBlock["type"]]> = [
      ["# ", "h1"],
      ["## ", "h2"],
      ["### ", "h3"],
      ["- ", "bullet"],
      ["* ", "bullet"],
    ];
    for (const [prefix, type] of shortcuts) {
      if (text.startsWith(prefix) && block.type === "paragraph") {
        update(
          blocks.map((b) => (b.id === id ? { ...b, type, text: text.slice(prefix.length) } : b)),
          { id, pos: 0 }
        );
        return;
      }
    }
    if (text.startsWith("```") && block.type === "paragraph") {
      update(
        blocks.map((b) =>
          b.id === id ? { ...b, type: "code" as const, text: "", language: text.slice(3).trim() || "text" } : b
        ),
        { id, pos: 0 }
      );
      return;
    }

    update(blocks.map((b) => (b.id === id ? { ...b, text } : b)));
  }

  function handleTextKeyDown(e: KeyboardEvent<HTMLDivElement>, id: string, el: HTMLDivElement) {
    const i = at(id);
    const block = blocks[i];
    const text = block.text ?? "";

    // Menu navigation captures keys while open on this block.
    if (menu?.blockId === id) {
      const items = filterSlashItems(menu.query);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMenu({ ...menu, index: Math.min(menu.index + 1, items.length - 1) });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMenu({ ...menu, index: Math.max(menu.index - 1, 0) });
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (items[menu.index]) applySlashItem(id, items[menu.index]);
        return;
      }
      if (e.key === "Escape") {
        setMenu(null);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const pos = caretOffset(el);
      const before = text.slice(0, pos);
      const after = text.slice(pos);
      // Empty bullet → back to paragraph instead of a new bullet.
      if (block.type === "bullet" && text === "") {
        update(blocks.map((b) => (b.id === id ? { ...b, type: "paragraph" as const } : b)), { id, pos: 0 });
        return;
      }
      const continueType = block.type === "bullet" ? "bullet" : "paragraph";
      const fresh = newBlock(continueType, { text: after });
      const next = blocks.map((b) => (b.id === id ? { ...b, text: before } : b));
      next.splice(i + 1, 0, fresh);
      update(next, { id: fresh.id, pos: 0 });
      return;
    }

    if (e.key === "Backspace" && caretOffset(el) === 0 && window.getSelection()?.isCollapsed) {
      if (block.type !== "paragraph") {
        // First soften to paragraph, like Notion.
        e.preventDefault();
        update(blocks.map((b) => (b.id === id ? { ...b, type: "paragraph" as const } : b)), { id, pos: 0 });
        return;
      }
      const prev = blocks[i - 1];
      if (!prev) return;
      e.preventDefault();
      if (isTextBlock(prev)) {
        const junction = (prev.text ?? "").length;
        const next = blocks
          .map((b) => (b.id === prev.id ? { ...b, text: (prev.text ?? "") + text } : b))
          .filter((b) => b.id !== id);
        update(next, { id: prev.id, pos: junction });
      } else if (text === "") {
        remove(id);
      }
      return;
    }

    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      moveBlock(id, e.key === "ArrowUp" ? -1 : 1);
      return;
    }

    if (e.key === "ArrowUp" && caretOffset(el) === 0) {
      const prev = blocks[i - 1];
      if (prev && focusFns.current.has(prev.id)) {
        e.preventDefault();
        focusFns.current.get(prev.id)?.((prev.text ?? "").length);
      }
      return;
    }
    if (e.key === "ArrowDown" && caretOffset(el) === text.length) {
      const nxt = blocks[i + 1];
      if (nxt && focusFns.current.has(nxt.id)) {
        e.preventDefault();
        focusFns.current.get(nxt.id)?.(0);
      }
    }
  }

  /* ── paste ───────────────────────────────────────────────── */

  async function uploadImageInto(id: string, file: File) {
    const asset = await filesApi.upload(file);
    setBlocks((cur) => {
      const next = cur.map((b) => (b.id === id ? { ...b, url: asset.url, text: asset.filename } : b));
      onChange(next);
      return next;
    });
  }

  /** Insert parsed blocks: replace the current block if it's an empty text
   *  block (the "fresh note" case), otherwise splice in after it. */
  function insertParsed(id: string, parsed: EditorBlock[]) {
    const i = at(id);
    const current = blocks[i];
    const replaceCurrent = isTextBlock(current) && (current.text ?? "").trim() === "";
    const next = [...blocks];
    next.splice(replaceCurrent ? i : i + 1, replaceCurrent ? 1 : 0, ...parsed);
    const lastText = [...parsed].reverse().find((b) => isTextBlock(b));
    update(next, lastText ? { id: lastText.id, pos: (lastText.text ?? "").length } : undefined);
  }

  function handlePaste(e: ClipboardEvent<HTMLDivElement>, id: string) {
    const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
    if (files.length > 0) {
      e.preventDefault();
      let anchor = id;
      for (const file of files) {
        const img = newBlock("image", { url: "" });
        insertAfter(anchor, img);
        anchor = img.id;
        void uploadImageInto(img.id, file);
      }
      return;
    }

    const html = e.clipboardData.getData("text/html");
    const plain = e.clipboardData.getData("text/plain");

    // Rich HTML (ChatGPT, docs, web pages): parse the real structure —
    // headings, lists, code blocks with language, links, images.
    if (html) {
      try {
        const parsed = parseHtml(html);
        if (isStructured(parsed)) {
          e.preventDefault();
          insertParsed(id, parsed);
          return;
        }
      } catch {
        /* fall through to plain text */
      }
    }

    // Markdown-ish plain text (also what ChatGPT puts in text/plain).
    if (plain && (plain.includes("\n") || /^(#{1,6}\s|[-*•]\s|\d+[.)]\s|```|https?:\/\/\S+$)/.test(plain.trim()))) {
      const parsed = parsePlainText(plain);
      if (parsed.length > 0) {
        e.preventDefault();
        insertParsed(id, parsed);
        return;
      }
    }

    // Single-line text: insert as plain text at the caret ourselves so the
    // browser can't paste styled HTML into the contenteditable.
    e.preventDefault();
    document.execCommand ? document.execCommand("insertText", false, plain) : insertPlain(plain);
  }

  function insertPlain(text: string) {
    // Fallback for environments without execCommand.
    import("./caret").then(({ insertPlainText }) => insertPlainText(text));
  }

  /* ── render ──────────────────────────────────────────────── */

  function addParagraphAfter(id: string) {
    insertAfter(id, newBlock());
  }

  return (
    <div className="block-editor">
      {blocks.map((block) => (
        <div key={block.id} id={`blk-${block.id}`} className="group/row relative flex items-start gap-1">
          {/* Gutter: add-below, visible on row hover. */}
          <div className="flex w-6 shrink-0 justify-center pt-[5px] opacity-0 transition-opacity duration-150 group-hover/row:opacity-100">
            <button
              tabIndex={-1}
              onClick={() => addParagraphAfter(block.id)}
              title="Add block below (Alt+↑/↓ moves a block)"
              className="flex h-5 w-5 items-center justify-center rounded text-zinc-600 transition-colors hover:bg-white/5 hover:text-zinc-300"
            >
              <Plus size={13} strokeWidth={2.25} />
            </button>
          </div>

          <div className="relative min-w-0 flex-1">
            {isTextBlock(block) ? (
              <TextBlock
                block={block}
                placeholder={PLACEHOLDERS[block.type] ?? ""}
                solo={blocks.length === 1}
                onInput={handleTextInput}
                onKeyDown={handleTextKeyDown}
                onPaste={handlePaste}
                register={register}
              />
            ) : block.type === "code" ? (
              <CodeBlock
                block={block}
                onChange={(id, p) => patch(id, p)}
                onRemove={remove}
                onExitDown={(id) => {
                  const i = at(id);
                  const nxt = blocks[i + 1];
                  if (nxt && isTextBlock(nxt)) focusFns.current.get(nxt.id)?.(0);
                  else addParagraphAfter(id);
                }}
                register={register}
              />
            ) : block.type === "image" ? (
              <ImageBlock block={block} onUpload={(id, f) => void uploadImageInto(id, f)} onRemove={remove} />
            ) : block.type === "link" ? (
              <LinkBlock block={block} onChange={(id, p) => patch(id, p)} onRemove={remove} />
            ) : (
              <DividerBlock id={block.id} onRemove={remove} />
            )}

            {menu?.blockId === block.id && (
              <SlashMenu
                items={filterSlashItems(menu.query)}
                selected={menu.index}
                onPick={(item) => applySlashItem(block.id, item)}
                onHover={(index) => setMenu((m) => (m ? { ...m, index } : m))}
              />
            )}
          </div>
        </div>
      ))}

      {/* Click-to-append zone below the last block. */}
      <div
        className="h-24 cursor-text"
        onClick={() => {
          const last = blocks[blocks.length - 1];
          if (last && isTextBlock(last) && (last.text ?? "") === "") {
            focusFns.current.get(last.id)?.(0);
          } else if (last) {
            addParagraphAfter(last.id);
          }
        }}
      />
    </div>
  );
}
