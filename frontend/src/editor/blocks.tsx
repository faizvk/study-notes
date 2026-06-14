import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { Check, ChevronDown, Copy, ExternalLink, Link2, Trash2, Upload } from "lucide-react";

import { caretOffset, insertPlainText, setCaret } from "./caret";
import { highlight, LANGUAGE_CHOICES } from "./highlight";
import type { EditorBlock } from "./types";

/* ─────────────────────────── Text-like blocks ─────────────────────────── */

const TEXT_STYLES: Record<string, string> = {
  paragraph: "text-[13px] leading-[1.65] text-zinc-200",
  h1: "text-[1.9em] font-bold tracking-tight text-zinc-50 pt-4",
  h2: "text-[1.5em] font-semibold tracking-tight text-zinc-50 pt-3",
  h3: "text-[1.2em] font-semibold text-zinc-100 pt-2",
  bullet: "text-[13px] leading-[1.65] text-zinc-200",
};

interface TextBlockProps {
  block: EditorBlock;
  placeholder: string;
  /** True when this is the editor's only block — placeholder shows unfocused. */
  solo?: boolean;
  onInput: (id: string, text: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>, id: string, el: HTMLDivElement) => void;
  onPaste: (e: ClipboardEvent<HTMLDivElement>, id: string) => void;
  register: (id: string, focus: ((pos: number) => void) | null) => void;
}

export function TextBlock({ block, placeholder, solo, onInput, onKeyDown, onPaste, register }: TextBlockProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Sync programmatic text changes (slash transforms, merges, restore) into the
  // DOM. During normal typing state mirrors the DOM, so this never fires; on a
  // real mismatch the editor sets a pending focus that repositions the caret.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && el.textContent !== (block.text ?? "")) {
      el.textContent = block.text ?? "";
    }
  }, [block.text]);

  // Must be a layout effect: the editor focuses freshly created blocks in its
  // own layout effect, which runs AFTER children's — a passive effect here
  // would register too late and the caret would stay on the previous block.
  useLayoutEffect(() => {
    register(block.id, (pos) => {
      if (ref.current) setCaret(ref.current, pos);
    });
    return () => register(block.id, null);
  }, [block.id, register]);

  return (
    <div className={`flex min-w-0 flex-1 ${block.type === "bullet" ? "gap-2" : ""}`}>
      {block.type === "bullet" && (
        <span className="select-none pt-[2px] text-zinc-500">•</span>
      )}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        data-placeholder={placeholder}
        data-solo={solo ? "true" : undefined}
        onInput={(e) => {
          const text = e.currentTarget.textContent ?? "";
          // Browsers leave a stray <br> behind when all text is deleted,
          // which defeats the :empty placeholder.
          if (text === "" && e.currentTarget.innerHTML !== "") e.currentTarget.innerHTML = "";
          onInput(block.id, text);
        }}
        onKeyDown={(e) => ref.current && onKeyDown(e, block.id, ref.current)}
        onPaste={(e) => onPaste(e, block.id)}
        className={`block-text min-w-0 flex-1 whitespace-pre-wrap break-words outline-none ${TEXT_STYLES[block.type]}`}
      />
    </div>
  );
}

/* ─────────────────────────────── Code block ───────────────────────────── */

interface CodeBlockProps {
  block: EditorBlock;
  onChange: (id: string, patch: Partial<EditorBlock>) => void;
  onRemove: (id: string) => void;
  onExitDown: (id: string) => void;
  register: (id: string, focus: ((pos: number) => void) | null) => void;
}

export function CodeBlock({ block, onChange, onRemove, onExitDown, register }: CodeBlockProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const code = block.text ?? "";
  const language = block.language || "text";

  const html = useMemo(() => highlight(code, language) + "\n", [code, language]);

  useLayoutEffect(() => {
    register(block.id, () => taRef.current?.focus());
    return () => register(block.id, null);
  }, [block.id, register]);

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget;
    if (e.key === "Tab") {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: end } = ta;
      const next = code.slice(0, s) + "  " + code.slice(end);
      onChange(block.id, { text: next });
      requestAnimationFrame(() => ta.setSelectionRange(s + 2, s + 2));
    } else if (e.key === "Backspace" && code === "") {
      e.preventDefault();
      onRemove(block.id);
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onExitDown(block.id);
    } else if (e.key === "ArrowDown" && ta.selectionEnd === code.length) {
      e.preventDefault();
      onExitDown(block.id);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="group/code my-1 w-full overflow-hidden rounded-2xl border border-white/[0.07] bg-[#1d1d1d]">
      {/* Header: language picker · copy — the ChatGPT code-block chrome. */}
      <div className="flex items-center justify-between border-b border-white/[0.06] py-1.5 pl-2 pr-2">
        <div className="relative">
          <button
            onClick={() => setLangOpen((o) => !o)}
            className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
          >
            {language}
            <ChevronDown
              size={11}
              strokeWidth={2}
              className={`transition-transform duration-150 ${langOpen ? "rotate-180" : ""}`}
            />
          </button>
          {langOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setLangOpen(false)} />
              <div className="animate-scale-in absolute left-0 top-full z-30 mt-1 max-h-64 w-44 overflow-y-auto rounded-xl border border-white/10 bg-[#1d1d1d] py-1 shadow-2xl shadow-black/60">
                {LANGUAGE_CHOICES.map((l) => (
                  <button
                    key={l}
                    onClick={() => {
                      onChange(block.id, { language: l });
                      setLangOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition-colors hover:bg-white/[0.06] ${
                      l === language ? "text-indigo-300" : "text-zinc-300"
                    }`}
                  >
                    {l}
                    {l === language && <Check size={11} strokeWidth={2.5} />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={copy}
            title="Copy code"
            className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
          >
            {copied ? <Check size={12} strokeWidth={2.5} className="text-emerald-400" /> : <Copy size={12} strokeWidth={2} />}
            <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
          </button>
          <button
            onClick={() => onRemove(block.id)}
            title="Delete block"
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 opacity-0 transition-all hover:bg-white/5 hover:text-red-400 group-hover/code:opacity-100"
          >
            <Trash2 size={12} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Editing surface: transparent textarea over the highlighted render.
          Both layers soft-wrap identically, so no horizontal scrolling. */}
      <div className="relative grid">
        <pre
          aria-hidden
          className="code-surface pointer-events-none [grid-area:1/1]"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <textarea
          ref={taRef}
          value={code}
          rows={1}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          onChange={(e) => onChange(block.id, { text: e.target.value })}
          onKeyDown={handleKey}
          placeholder="// code…"
          className="code-surface resize-none overflow-hidden bg-transparent text-transparent caret-white outline-none placeholder:text-zinc-600 [grid-area:1/1]"
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────── Image block ──────────────────────────── */

interface ImageBlockProps {
  block: EditorBlock;
  onUpload: (id: string, file: File) => void;
  onRemove: (id: string) => void;
}

export function ImageBlock({ block, onUpload, onRemove }: ImageBlockProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    // Shrink-wrap when an image is present so the hover controls anchor to the
    // image itself rather than floating at the far edge of a full-width row.
    <div className={`group/img relative my-1 max-w-full ${block.url ? "w-fit" : "w-full"}`}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(block.id, f);
          e.target.value = "";
        }}
      />
      {block.url ? (
        <>
          <img
            src={block.url}
            alt={block.text || "uploaded image"}
            className="h-auto max-h-[480px] max-w-full rounded-xl border border-white/[0.06]"
          />
          <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover/img:opacity-100">
            <button
              onClick={() => fileRef.current?.click()}
              title="Replace image"
              className="flex h-7 w-7 items-center justify-center rounded-md bg-black/70 text-zinc-300 backdrop-blur transition-colors hover:text-white"
            >
              <Upload size={12} strokeWidth={2} />
            </button>
            <button
              onClick={() => onRemove(block.id)}
              title="Remove image"
              className="flex h-7 w-7 items-center justify-center rounded-md bg-black/70 text-zinc-300 backdrop-blur transition-colors hover:text-red-400"
            >
              <Trash2 size={12} strokeWidth={2} />
            </button>
          </div>
        </>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 px-4 py-8 text-sm text-zinc-500 transition-colors hover:border-white/20 hover:text-zinc-300"
        >
          <Upload size={15} strokeWidth={1.75} />
          Click to upload an image (or paste one anywhere in the note)
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────── Link block ───────────────────────────── */

interface LinkBlockProps {
  block: EditorBlock;
  onChange: (id: string, patch: Partial<EditorBlock>) => void;
  onRemove: (id: string) => void;
}

export function LinkBlock({ block, onChange, onRemove }: LinkBlockProps) {
  const [draft, setDraft] = useState(block.url ?? "");

  function commit() {
    let url = draft.trim();
    if (!url) {
      onRemove(block.id);
      return;
    }
    if (!/^[a-z]+:\/\//i.test(url)) url = `https://${url}`;
    onChange(block.id, { url, text: block.text || url.replace(/^https?:\/\//, "") });
  }

  if (!block.url) {
    return (
      <div className="my-1 flex w-full items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 py-2">
        <Link2 size={14} strokeWidth={2} className="shrink-0 text-zinc-500" />
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") onRemove(block.id);
          }}
          onBlur={commit}
          placeholder="Paste or type a URL, then press Enter…"
          className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 outline-none"
        />
      </div>
    );
  }

  return (
    <div className="group/link my-1 flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.05] px-3 py-2.5 transition-colors hover:border-white/[0.14] hover:bg-white/[0.07]">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-zinc-400">
        <Link2 size={13} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <input
          value={block.text ?? ""}
          onChange={(e) => onChange(block.id, { text: e.target.value })}
          placeholder="Link title"
          className="block w-full bg-transparent text-sm font-medium text-zinc-100 outline-none placeholder:text-zinc-600"
        />
        <span className="block truncate text-xs text-zinc-500">{block.url}</span>
      </div>
      <a
        href={block.url}
        target="_blank"
        rel="noreferrer noopener"
        title="Open link"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
      >
        <ExternalLink size={13} strokeWidth={2} />
      </a>
      <button
        onClick={() => onRemove(block.id)}
        title="Remove link"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-600 opacity-0 transition-all hover:bg-white/5 hover:text-red-400 group-hover/link:opacity-100"
      >
        <Trash2 size={13} strokeWidth={2} />
      </button>
    </div>
  );
}

/* ─────────────────────────────── Divider ──────────────────────────────── */

export function DividerBlock({ id, onRemove }: { id: string; onRemove: (id: string) => void }) {
  return (
    <div className="group/div relative my-2 flex w-full items-center py-1">
      <hr className="w-full border-white/10" />
      <button
        onClick={() => onRemove(id)}
        title="Remove divider"
        className="absolute right-0 flex h-6 w-6 items-center justify-center rounded-md text-zinc-600 opacity-0 transition-all hover:text-red-400 group-hover/div:opacity-100"
      >
        <Trash2 size={11} strokeWidth={2} />
      </button>
    </div>
  );
}
