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

export interface PlanSummary {
  id: string;
  title: string;
  kind: "roadmap" | "checklist";
  description: string;
  position: number;
  total_steps: number;
  done_steps: number;
  created_at: string;
  updated_at: string;
}

export interface PlanStep {
  id: string;
  plan_id: string;
  title: string;
  status: "todo" | "doing" | "done";
  note: string;
  position: number;
  due_at: string | null;
  topic_id: string | null;
  topic_title?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Plan extends PlanSummary {
  steps: PlanStep[];
}

export interface AgendaItem {
  step_id: string;
  plan_id: string;
  plan_title: string;
  title: string;
  status: "todo" | "doing";
  due_at: string;
}

export interface FileAsset {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  created_at: string;
  url: string;
}
