import { readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

import { collapseWhitespace, extractTextAndThinking } from "./parse.ts";
import type { PiRecord, SessionDirEntry, SessionFileEntry } from "./types.ts";

/** Expand a leading `~` to the user's home directory. */
export function expandHome(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return join(homedir(), path.slice(2));
  return path;
}

function jsonlFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  return entries
    .filter((name) => name.endsWith(".jsonl"))
    .map((name) => join(dir, name))
    .filter((path) => {
      try {
        return statSync(path).isFile();
      } catch {
        return false;
      }
    });
}

function mtimeMs(path: string): number {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return 0;
  }
}

function sortByMtimeDesc(paths: string[]): string[] {
  return [...paths].sort((a, b) => mtimeMs(b) - mtimeMs(a));
}

/** Read the real cwd from the first `type: "session"` record in a file. */
function sessionCwdFromFile(path: string): string {
  let text: string;
  try {
    text = readFileSync(path, "utf-8");
  } catch {
    return "";
  }

  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    let record: PiRecord;
    try {
      record = JSON.parse(line) as PiRecord;
    } catch {
      continue;
    }
    if (record.type === "session" && typeof record.cwd === "string" && record.cwd !== "") {
      return record.cwd;
    }
  }
  return "";
}

/** Derive a best-effort cwd from a mangled project directory name. */
export function cwdFromDirName(dir: string): string {
  const base = basename(dir).replace(/^-+/, "").replace(/-+$/, "").replace(/-/g, "/");
  return `/${base}`;
}

/** List session project directories, newest activity first. */
export function listSessionDirs(sessionsDir: string): SessionDirEntry[] {
  const root = expandHome(sessionsDir);

  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return [];
  }

  const rows: SessionDirEntry[] = [];
  for (const name of entries) {
    const dir = join(root, name);
    try {
      if (!statSync(dir).isDirectory()) continue;
    } catch {
      continue;
    }

    const files = sortByMtimeDesc(jsonlFiles(dir));
    const newest = files[0];
    if (newest === undefined) continue;

    const cwd = sessionCwdFromFile(newest) || cwdFromDirName(dir);
    rows.push({ path: dir, mtime: new Date(mtimeMs(newest)), sessionCount: files.length, cwd });
  }

  rows.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  return rows;
}

/** Build the first-user-message preview for a session file. */
export function previewSession(path: string, snippetLength: number): string {
  if (snippetLength <= 0) return "";

  let text: string;
  try {
    text = readFileSync(path, "utf-8");
  } catch {
    return "";
  }

  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    let record: PiRecord;
    try {
      record = JSON.parse(line) as PiRecord;
    } catch {
      continue;
    }
    if (record.type !== "message") continue;
    const message = record.message;
    if (message === null || typeof message !== "object") continue;
    if (message.role !== "user") continue;

    const { text: content } = extractTextAndThinking(message.content);
    const preview = collapseWhitespace(content);
    return preview === "" ? "" : preview.slice(0, snippetLength);
  }

  return "";
}

/** Format a byte count the way the shell picker does (B/K/M/G). */
export function prettySize(bytes: number): string {
  let value = bytes;
  const units = ["B", "K", "M", "G"] as const;
  for (const unit of units) {
    if (value < 1024 || unit === "G") {
      return unit === "B" ? `${Math.round(value)}${unit}` : `${value.toFixed(1)}${unit}`;
    }
    value /= 1024;
  }
  return `${Math.round(value)}G`;
}

/** List session files in a directory, newest first, with size and preview. */
export function listSessionFiles(dir: string, snippetLength: number): SessionFileEntry[] {
  return sortByMtimeDesc(jsonlFiles(dir)).map((path) => {
    let size = 0;
    try {
      size = statSync(path).size;
    } catch {
      size = 0;
    }
    return {
      path,
      mtime: new Date(mtimeMs(path)),
      size,
      preview: previewSession(path, snippetLength),
    };
  });
}
