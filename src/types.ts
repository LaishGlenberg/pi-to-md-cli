/** A single newline-delimited record from a Pi session `.jsonl` file. */
export interface PiRecord {
  type?: string;
  id?: string;
  parentId?: string | null;
  timestamp?: string;
  cwd?: string;
  message?: PiMessage;
  [key: string]: unknown;
}

/** The `message` payload carried by a `type: "message"` record. */
export interface PiMessage {
  role?: string;
  content?: unknown;
  command?: unknown;
  output?: unknown;
  [key: string]: unknown;
}

export type ExportMode = "all" | "branch";
export type ThinkingStyle = "details" | "omit";

/** Header metadata pulled from the `type: "session"` record. */
export interface SessionMeta {
  sessionId: string;
  startedAt: Date | null;
  cwd: string;
}

/** A discovered session project directory. */
export interface SessionDirEntry {
  path: string;
  mtime: Date;
  sessionCount: number;
  cwd: string;
}

/** A discovered session file within a project directory. */
export interface SessionFileEntry {
  path: string;
  mtime: Date;
  size: number;
  preview: string;
}

/** Options shared by {@link renderMarkdown} and {@link generateMarkdown}. */
export interface RenderOptions {
  mode: ExportMode;
  leafId: string | null;
  thinkingStyle: ThinkingStyle;
  includeBash: boolean;
  includeTimestamps: boolean;
  groupTurns: boolean;
  cut: number | null;
}

/** Options for {@link generateMarkdown}, which also reads the input file. */
export interface GenerateOptions extends RenderOptions {
  inputJsonl: string;
}
