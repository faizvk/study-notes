// Smart paste: convert clipboard payloads (rich HTML from ChatGPT/docs/web
// pages, or markdown-ish plain text) into native editor blocks — headings,
// bullets, numbered lines, code blocks with language, links, images, dividers.

import { detectLanguage } from "./highlight";
import { newBlock, type EditorBlock } from "./types";

const BARE_URL = /^https?:\/\/\S+$/i;

/** True when paste-parsing produced real structure worth block-inserting. */
export function isStructured(blocks: EditorBlock[]): boolean {
  if (blocks.length === 0) return false;
  if (blocks.length > 1) return true;
  return blocks[0].type !== "paragraph";
}

/* ────────────────────────── plain text / markdown ─────────────────────── */

export function parsePlainText(text: string): EditorBlock[] {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: EditorBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Fenced code block: ```lang … ```
    const fence = trimmed.match(/^```([\w+#-]*)\s*$/);
    if (fence) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1; // skip closing fence
      const source = code.join("\n");
      blocks.push(newBlock("code", { text: source, language: fence[1] || detectLanguage(source) }));
      continue;
    }

    if (trimmed === "") {
      i += 1;
      continue;
    }
    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = Math.min(heading[1].length, 3) as 1 | 2 | 3;
      blocks.push(newBlock(level === 1 ? "h1" : level === 2 ? "h2" : "h3", { text: heading[2] }));
    } else if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(newBlock("divider"));
    } else if (/^[-*•]\s+/.test(trimmed)) {
      blocks.push(newBlock("bullet", { text: trimmed.replace(/^[-*•]\s+/, "") }));
    } else if (/^\d+[.)]\s+/.test(trimmed)) {
      // Numbered lines keep their numbers as written.
      blocks.push(newBlock("paragraph", { text: trimmed }));
    } else if (BARE_URL.test(trimmed)) {
      blocks.push(newBlock("link", { url: trimmed, text: trimmed.replace(/^https?:\/\//, "") }));
    } else if (/^>\s?/.test(trimmed)) {
      blocks.push(newBlock("paragraph", { text: trimmed.replace(/^>\s?/, "") }));
    } else {
      blocks.push(newBlock("paragraph", { text: trimmed }));
    }
    i += 1;
  }
  return blocks;
}

/* ─────────────────────────────── rich HTML ────────────────────────────── */

export function parseHtml(html: string): EditorBlock[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks = blockify(doc.body);
  // Merge stray empties out.
  return blocks.filter((b) => b.type !== "paragraph" || (b.text ?? "").trim() !== "");
}

const SKIP_TAGS = new Set(["BUTTON", "SCRIPT", "STYLE", "NAV", "SVG", "SELECT", "INPUT"]);
const CONTAINER_TAGS = new Set(["DIV", "SECTION", "ARTICLE", "MAIN", "BODY", "SPAN", "FIGURE", "DETAILS"]);

function blockify(el: Element): EditorBlock[] {
  const out: EditorBlock[] = [];
  // Loose text directly inside a container becomes paragraphs.
  let pending = "";
  const flush = () => {
    const t = pending.trim();
    if (t) out.push(textToBlock(t));
    pending = "";
  };

  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      pending += node.textContent ?? "";
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const child = node as Element;
    const tag = child.tagName;

    if (SKIP_TAGS.has(tag)) continue;

    if (/^H[1-6]$/.test(tag)) {
      flush();
      const level = Math.min(Number(tag[1]), 3);
      out.push(newBlock(level === 1 ? "h1" : level === 2 ? "h2" : "h3", { text: inlineText(child) }));
    } else if (tag === "P") {
      flush();
      const t = inlineText(child).trim();
      if (t) out.push(textToBlock(t));
    } else if (tag === "UL") {
      flush();
      out.push(...listItems(child, null));
    } else if (tag === "OL") {
      flush();
      out.push(...listItems(child, Number(child.getAttribute("start")) || 1));
    } else if (tag === "PRE") {
      flush();
      const codeEl = child.querySelector("code") ?? child;
      const code = preText(codeEl);
      if (code.trim()) {
        const lang = findLanguage(child) ?? detectLanguage(code);
        out.push(newBlock("code", { text: code, language: lang }));
      }
    } else if (tag === "HR") {
      flush();
      out.push(newBlock("divider"));
    } else if (tag === "IMG") {
      flush();
      const src = child.getAttribute("src");
      if (src && !src.startsWith("data:")) {
        out.push(newBlock("image", { url: src, text: child.getAttribute("alt") ?? "" }));
      }
    } else if (tag === "BLOCKQUOTE") {
      flush();
      out.push(...blockify(child));
    } else if (tag === "TABLE") {
      flush();
      for (const row of Array.from(child.querySelectorAll("tr"))) {
        const cells = Array.from(row.querySelectorAll("th,td")).map((c) => inlineText(c).trim());
        const line = cells.filter(Boolean).join("  ·  ");
        if (line) out.push(newBlock("paragraph", { text: line }));
      }
    } else if (CONTAINER_TAGS.has(tag)) {
      // Containers either hold further blocks or are purely inline.
      if (child.querySelector("p,ul,ol,pre,h1,h2,h3,h4,h5,h6,table,blockquote,img,hr,div")) {
        flush();
        out.push(...blockify(child));
      } else {
        pending += inlineText(child);
      }
    } else {
      pending += inlineText(child);
    }
  }
  flush();
  return out;
}

function listItems(list: Element, start: number | null): EditorBlock[] {
  const out: EditorBlock[] = [];
  let n = start ?? 0;
  for (const li of Array.from(list.children)) {
    if (li.tagName !== "LI") continue;
    // Direct text of the item, excluding any nested lists / code blocks.
    const clone = li.cloneNode(true) as Element;
    clone.querySelectorAll("ul,ol,pre").forEach((x) => x.remove());
    const t = inlineText(clone).trim();
    if (t) {
      out.push(
        start !== null
          ? newBlock("paragraph", { text: `${n}. ${t}` })
          : newBlock("bullet", { text: t })
      );
      n += 1;
    }
    // Nested structures become sibling blocks below the item.
    for (const nested of Array.from(li.querySelectorAll(":scope > ul, :scope > ol"))) {
      out.push(...listItems(nested, nested.tagName === "OL" ? 1 : null));
    }
    const pre = li.querySelector(":scope > pre");
    if (pre) out.push(...blockify(li).filter((b) => b.type === "code"));
  }
  return out;
}

/** Extract code text from a <pre>/<code>, preserving line structure even when
 *  the source marks lines up as nested <div>/<p> elements (or <br>) with no
 *  literal newline characters — common in highlighted-code clipboard HTML. */
function preText(el: Element): string {
  let s = "";
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      s += node.textContent ?? "";
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const child = node as Element;
    if (SKIP_TAGS.has(child.tagName)) return;
    if (child.tagName === "BR") {
      s += "\n";
      return;
    }
    const isLine = child.tagName === "DIV" || child.tagName === "P" || child.tagName === "LI";
    const before = s.length;
    Array.from(child.childNodes).forEach(walk);
    if (isLine && s.length > before && !s.endsWith("\n")) s += "\n";
  };
  Array.from(el.childNodes).forEach(walk);
  return s.replace(/\n+$/, "");
}

/** Find a declared language anywhere on/inside the <pre> wrapper. */
function findLanguage(pre: Element): string | null {
  const fromClass = (cls: string | null) => cls?.match(/language-([\w+#-]+)/)?.[1] ?? null;
  const own = fromClass(pre.getAttribute("class"));
  if (own) return own;
  const tagged = pre.querySelector('[class*="language-"]');
  if (tagged) return fromClass(tagged.getAttribute("class"));
  const dataLang = pre.getAttribute("data-language") ?? pre.querySelector("[data-language]")?.getAttribute("data-language");
  return dataLang || null;
}

function inlineText(el: Element | Node): string {
  let s = "";
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      s += node.textContent ?? "";
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const child = node as Element;
      if (SKIP_TAGS.has(child.tagName)) continue;
      if (child.tagName === "BR") s += "\n";
      else if (child.tagName === "CODE") s += `\`${child.textContent ?? ""}\``;
      else if (child.tagName === "A") {
        const text = inlineText(child).trim();
        const href = child.getAttribute("href") ?? "";
        s += text || href;
      } else s += inlineText(child);
    }
  }
  return s.replace(/ /g, " ");
}

function textToBlock(text: string): EditorBlock {
  if (BARE_URL.test(text)) {
    return newBlock("link", { url: text, text: text.replace(/^https?:\/\//, "") });
  }
  return newBlock("paragraph", { text });
}
