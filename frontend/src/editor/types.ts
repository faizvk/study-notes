// Our own block model. Kept deliberately flat and JSON-friendly — the backend
// stores it verbatim (JSONB) and its search indexer picks up `text` and `url`.

export type BlockType =
  | "paragraph"
  | "h1"
  | "h2"
  | "h3"
  | "bullet"
  | "code"
  | "image"
  | "link"
  | "divider";

export interface EditorBlock {
  id: string;
  type: BlockType;
  /** Text content for text-like blocks; code source for code blocks; link label. */
  text?: string;
  /** Code blocks: highlight language. */
  language?: string;
  /** Image src / link href. */
  url?: string;
}

export function newBlock(type: BlockType = "paragraph", partial: Partial<EditorBlock> = {}): EditorBlock {
  return { id: crypto.randomUUID(), type, text: "", ...partial };
}

export const TEXT_TYPES: BlockType[] = ["paragraph", "h1", "h2", "h3", "bullet"];

export function isTextBlock(b: EditorBlock): boolean {
  return TEXT_TYPES.includes(b.type);
}
