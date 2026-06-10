// Tiny dependency-free syntax highlighter. Scans the source once and emits
// HTML with token classes (.tok-kw, .tok-str, .tok-num, .tok-cm, .tok-fn).
// Not a full grammar — keywords, strings, comments, numbers and call-sites
// cover the ChatGPT-style look we want for study snippets.

interface LangDef {
  keywords: Set<string>;
  lineComment?: string;
  blockComment?: [string, string];
  hashComment?: boolean;
}

const JS_KEYWORDS =
  "const let var function return if else for while do switch case break continue new class extends implements interface type enum import export from default async await try catch finally throw this super in of instanceof typeof void delete yield static get set public private protected readonly abstract as satisfies keyof namespace declare null undefined true false";
const PY_KEYWORDS =
  "def return if elif else for while import from as class try except finally raise with lambda pass break continue global nonlocal yield async await in is not and or del assert match case True False None self";
const C_KEYWORDS =
  "int long double float char bool boolean void public private protected static final class struct enum union if else for while do switch case default break continue return new delete this super try catch finally throw throws import package using namespace include define ifdef ifndef endif true false null nullptr const unsigned signed short auto template typename virtual override sizeof goto volatile extern inline friend operator var string record sealed readonly async await";
const GO_KEYWORDS =
  "func package import return if else for range switch case default break continue var const type struct interface map chan go defer select fallthrough goto nil true false iota make new len cap append copy delete panic recover";
const RUST_KEYWORDS =
  "fn let mut pub struct enum impl trait for in if else while loop match return use mod crate self super as where async await move ref dyn box static const unsafe extern type true false None Some Ok Err String Vec";
const SQL_KEYWORDS =
  "select from where insert into values update set delete create table alter drop index view join left right inner outer full cross on group by order having limit offset as and or not null primary key foreign references distinct union all exists between like in is asc desc count sum avg min max case when then else end begin commit rollback transaction";
const BASH_KEYWORDS =
  "if then else elif fi for in do done while until case esac function echo export local return exit source set unset readonly shift trap true false";

const LANGS: Record<string, LangDef> = {
  javascript: { keywords: new Set(JS_KEYWORDS.split(" ")), lineComment: "//", blockComment: ["/*", "*/"] },
  python: { keywords: new Set(PY_KEYWORDS.split(" ")), hashComment: true },
  java: { keywords: new Set(C_KEYWORDS.split(" ")), lineComment: "//", blockComment: ["/*", "*/"] },
  c: { keywords: new Set(C_KEYWORDS.split(" ")), lineComment: "//", blockComment: ["/*", "*/"] },
  go: { keywords: new Set(GO_KEYWORDS.split(" ")), lineComment: "//", blockComment: ["/*", "*/"] },
  rust: { keywords: new Set(RUST_KEYWORDS.split(" ")), lineComment: "//", blockComment: ["/*", "*/"] },
  sql: { keywords: new Set(SQL_KEYWORDS.split(" ")), lineComment: "--", blockComment: ["/*", "*/"] },
  bash: { keywords: new Set(BASH_KEYWORDS.split(" ")), hashComment: true },
  css: { keywords: new Set<string>(), blockComment: ["/*", "*/"] },
  json: { keywords: new Set(["true", "false", "null"]) },
  yaml: { keywords: new Set(["true", "false", "null"]), hashComment: true },
  html: { keywords: new Set<string>(), blockComment: ["<!--", "-->"] },
  text: { keywords: new Set<string>() },
};

const ALIASES: Record<string, string> = {
  js: "javascript", jsx: "javascript", ts: "javascript", tsx: "javascript", typescript: "javascript",
  py: "python", rb: "python", kotlin: "java", kt: "java", csharp: "java", cs: "java",
  cpp: "c", "c++": "c", h: "c", swift: "java", php: "javascript",
  shell: "bash", sh: "bash", shellscript: "bash", zsh: "bash",
  postgres: "sql", mysql: "sql", xml: "html", scss: "css", less: "css", md: "text", markdown: "text",
  yml: "yaml", plaintext: "text", plain: "text",
};

export const LANGUAGE_CHOICES = [
  "text", "typescript", "javascript", "python", "java", "c", "cpp", "csharp", "go",
  "rust", "sql", "bash", "html", "css", "json", "yaml",
];

/* Heuristic language detection for pasted code with no declared language. */
const DETECTORS: Array<[string, RegExp]> = [
  ["typescript", /\b(interface |type \w+ =|: (string|number|boolean)\b|=> |console\.log|import .+ from|export )/g],
  ["javascript", /\b(function |const |let |=> |console\.log|require\(|document\.)/g],
  ["python", /\b(def |import |elif |self\.|print\(|lambda |None\b|__init__)/g],
  ["java", /\b(public |private |static |void |new \w+\(|System\.out)/g],
  ["c", /(#include|printf\(|int main\(|->\w)/g],
  ["go", /\b(func |package |fmt\.|:=)/g],
  ["rust", /\b(fn |let mut |println!|impl |\w+::\w+)/g],
  ["sql", /\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE)\b/gi],
  ["bash", /(^#!|\becho |\bfi\b|\bdone\b|\$\{|\bsudo )/gm],
  ["html", /<\/?[a-z][\w-]*[ >]/g],
  ["json", /"[\w-]+"\s*:\s*("|\d|true|false|null|\[|\{)/g],
  ["css", /[\w-]+\s*:\s*[^;{}]+;/g],
];

export function detectLanguage(code: string): string {
  let best = "text";
  let bestScore = 1; // require at least 2 matches before claiming a language
  for (const [lang, re] of DETECTORS) {
    const score = (code.match(re) ?? []).length;
    if (score > bestScore) {
      bestScore = score;
      best = lang;
    }
  }
  return best;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const isIdentStart = (c: string) => /[A-Za-z_$]/.test(c);
const isIdent = (c: string) => /[A-Za-z0-9_$]/.test(c);

export function highlight(source: string, language: string): string {
  const lang = LANGS[ALIASES[language] ?? language] ?? LANGS.text;
  let out = "";
  let i = 0;
  const n = source.length;

  const push = (cls: string | null, text: string) => {
    out += cls ? `<span class="tok-${cls}">${esc(text)}</span>` : esc(text);
  };

  while (i < n) {
    const c = source[i];

    // Comments
    if (lang.lineComment && source.startsWith(lang.lineComment, i)) {
      const end = source.indexOf("\n", i);
      const stop = end === -1 ? n : end;
      push("cm", source.slice(i, stop));
      i = stop;
      continue;
    }
    if (lang.hashComment && c === "#") {
      const end = source.indexOf("\n", i);
      const stop = end === -1 ? n : end;
      push("cm", source.slice(i, stop));
      i = stop;
      continue;
    }
    if (lang.blockComment && source.startsWith(lang.blockComment[0], i)) {
      const close = source.indexOf(lang.blockComment[1], i + lang.blockComment[0].length);
      const stop = close === -1 ? n : close + lang.blockComment[1].length;
      push("cm", source.slice(i, stop));
      i = stop;
      continue;
    }

    // Strings
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < n) {
        if (source[j] === "\\") j += 2;
        else if (source[j] === c) { j += 1; break; }
        else if (c !== "`" && source[j] === "\n") break; // unterminated line string
        else j += 1;
      }
      push("str", source.slice(i, Math.min(j, n)));
      i = Math.min(j, n);
      continue;
    }

    // Numbers
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(source[i + 1] ?? ""))) {
      let j = i;
      while (j < n && /[0-9a-fA-FxXoObB._]/.test(source[j])) j += 1;
      push("num", source.slice(i, j));
      i = j;
      continue;
    }

    // Identifiers / keywords / call-sites
    if (isIdentStart(c)) {
      let j = i;
      while (j < n && isIdent(source[j])) j += 1;
      const word = source.slice(i, j);
      let k = j;
      while (k < n && source[k] === " ") k += 1;
      if (lang.keywords.has(word)) push("kw", word);
      else if (source[k] === "(") push("fn", word);
      else push(null, word);
      i = j;
      continue;
    }

    push(null, c);
    i += 1;
  }

  return out;
}
