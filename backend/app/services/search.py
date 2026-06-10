from typing import Any


def extract_search_text(blocks: Any) -> str:
    """Flatten a BlockNote document into a single searchable string.

    Recursively collects every ``text`` value (paragraphs, headings, code blocks)
    and every ``href``/``url`` value (links) found anywhere in the document.
    """
    parts: list[str] = []

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                if key in ("text", "href", "url") and isinstance(value, str):
                    parts.append(value)
                else:
                    walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(blocks)
    return " ".join(p for p in parts if p).strip()


def make_snippet(text: str, query: str, radius: int = 60) -> str:
    """Return a short window of ``text`` around the first match of ``query``."""
    if not text:
        return ""
    idx = text.lower().find(query.lower())
    if idx == -1:
        return text[: radius * 2].strip()
    start = max(0, idx - radius)
    end = min(len(text), idx + len(query) + radius)
    prefix = "…" if start > 0 else ""
    suffix = "…" if end < len(text) else ""
    return f"{prefix}{text[start:end].strip()}{suffix}"
