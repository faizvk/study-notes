import { newBlock, type EditorBlock } from "./types";

/**
 * Normalise stored note content into our block model.
 *
 * Accepts either our own format (returned untouched, with ids ensured) or the
 * legacy BlockNote document format from before the editor was rewritten
 * (recognisable by `props` / nested inline-content arrays), which is mapped
 * block-by-block so old notes and old version snapshots still open.
 */
export function toEditorBlocks(raw: unknown): EditorBlock[] {
  if (!Array.isArray(raw) || raw.length === 0) return [newBlock()];

  const blocks: EditorBlock[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const b = item as Record<string, unknown>;

    // Our own format: `type` is one of ours and content is flat.
    if (typeof b.type === "string" && !("props" in b) && !Array.isArray(b.content)) {
      blocks.push({
        // Stored id is kept; otherwise a *deterministic* positional id so every
        // caller (editor, outline, search-jump) agrees on the same DOM ids.
        id: typeof b.id === "string" ? b.id : `b${blocks.length}`,
        type: (b.type as EditorBlock["type"]) ?? "paragraph",
        text: typeof b.text === "string" ? b.text : "",
        language: typeof b.language === "string" ? b.language : undefined,
        url: typeof b.url === "string" ? b.url : undefined,
      });
      continue;
    }

    // Legacy (BlockNote) blocks have no stable id — assign deterministic ones by
    // position instead of the random ids newBlock() produces, so conversions are
    // reproducible across components.
    for (const converted of fromBlockNote(b)) {
      converted.id = `b${blocks.length}`;
      blocks.push(converted);
    }
  }
  return blocks.length > 0 ? blocks : [newBlock()];
}

function inlineText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((n) => {
      if (!n || typeof n !== "object") return "";
      const node = n as Record<string, unknown>;
      if (typeof node.text === "string") return node.text;
      if (node.type === "link") {
        const inner = inlineText(node.content);
        return inner || (typeof node.href === "string" ? node.href : "");
      }
      return "";
    })
    .join("");
}

function fromBlockNote(b: Record<string, unknown>): EditorBlock[] {
  const props = (b.props ?? {}) as Record<string, unknown>;
  const text = inlineText(b.content);
  const children = Array.isArray(b.children)
    ? b.children.flatMap((c) => fromBlockNote(c as Record<string, unknown>))
    : [];

  let block: EditorBlock | null;
  switch (b.type) {
    case "heading": {
      const level = Number(props.level) || 1;
      block = newBlock(level === 1 ? "h1" : level === 2 ? "h2" : "h3", { text });
      break;
    }
    case "codeBlock":
      block = newBlock("code", {
        text,
        language: typeof props.language === "string" ? props.language : "text",
      });
      break;
    case "bulletListItem":
    case "numberedListItem":
    case "checkListItem":
      block = newBlock("bullet", { text });
      break;
    case "image":
      block = newBlock("image", {
        url: typeof props.url === "string" ? props.url : "",
        text: typeof props.caption === "string" ? props.caption : "",
      });
      break;
    case "paragraph":
    default:
      block = text || children.length === 0 ? newBlock("paragraph", { text }) : null;
  }
  return block ? [block, ...children] : children;
}
