// A BlockNote block. We keep it loosely typed here and let BlockNote's own types
// take over inside the editor component.
export type Block = Record<string, unknown>;

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface TopicNode {
  id: string;
  parent_id: string | null;
  title: string;
  position: number;
  is_pinned: boolean;
  children: TopicNode[];
}

export interface Topic {
  id: string;
  owner_id: string;
  parent_id: string | null;
  title: string;
  position: number;
  content: Block[];
  tags: string[];
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface TopicCard {
  id: string;
  parent_id: string | null;
  title: string;
  position: number;
  is_pinned: boolean;
  tags: string[];
  child_count: number;
  preview: string;
  updated_at: string;
}

export interface SearchResult {
  id: string;
  parent_id: string | null;
  title: string;
  snippet: string;
  matched_in: "title" | "content";
  tags: string[];
  is_pinned: boolean;
}

export interface VersionSummary {
  id: string;
  topic_id: string;
  title_snapshot: string;
  label: string | null;
  is_checkpoint: boolean;
  created_at: string;
}

export interface Version extends VersionSummary {
  content_snapshot: Block[];
}

export interface FileAsset {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  created_at: string;
  url: string;
}
