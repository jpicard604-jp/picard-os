// Types for ChatGPT export ingestion pipeline.
// Shape mirrors the public ChatGPT data-export format (subject to drift).

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export interface RawMessage {
  id?: string;
  author?: { role?: Role; name?: string | null; metadata?: unknown };
  create_time?: number | null;
  update_time?: number | null;
  content?: {
    content_type?: string;
    parts?: unknown[];
    text?: string;
  };
  metadata?: Record<string, unknown>;
  recipient?: string;
}

export interface RawMappingNode {
  id: string;
  message: RawMessage | null;
  parent: string | null;
  children: string[];
}

export interface RawConversation {
  title?: string;
  create_time?: number;
  update_time?: number;
  mapping?: Record<string, RawMappingNode>;
  current_node?: string;
  conversation_id?: string;
  id?: string;
}

// Flattened, privacy-aware excerpt that downstream stages process.
export interface Excerpt {
  conversationId: string;
  conversationTitle: string;
  conversationCreatedISO: string | null;
  messageId: string;
  role: Role;
  createdISO: string | null;
  text: string;            // already trimmed/normalised
  matchedKeywords: string[];
  categories: Category[];
  shard: string;           // source shard filename
}

export type Category =
  | "profile"
  | "goals"
  | "projects_active"
  | "projects_paused"
  | "fitness"
  | "preferences"
  | "people"
  | "work_career"
  | "picard_os"
  | "xodus"
  | "obsidian_claude_os"
  | "porsche_cars"
  | "play_graton"
  | "kimble"
  | "school"
  | "design_dev"
  | "outdated"
  | "conflict"
  | "workflow"
  | "architecture"
  | "backlog"
  | "raw_misc";

export interface ArchiveEntryInfo {
  path: string;
  size: number;
  compressedSize: number;
  isJsonShard: boolean;
  isMedia: boolean;
  ext: string;
}
