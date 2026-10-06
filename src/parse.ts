import type { PiRecord } from "./types.ts";

/** Parse an ISO timestamp into a Date, or return null when it is unusable. */
export function parseIso(timestamp: unknown): Date | null {
  if (typeof timestamp !== "string" || timestamp.length === 0) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

/**
 * Format a Date the way Python's `datetime.isoformat()` does for Pi
 * timestamps: `Z` inputs render as `+00:00`, and a fractional part (when
 * present) is written with six digits.
 */
export function isoformat(date: Date): string {
  const base = [
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`,
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`,
  ].join("T");
  const milliseconds = date.getUTCMilliseconds();
  const fraction = milliseconds !== 0 ? `.${pad(milliseconds, 3)}000` : "";
  return `${base}${fraction}+00:00`;
}

/**
 * Parse newline-delimited JSON text into records. Blank lines are skipped and
 * a malformed line reports its 1-based line number.
 */
export function parseJsonl(text: string): PiRecord[] {
  const records: PiRecord[] = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.trim() === "") continue;
    try {
      const parsed: unknown = JSON.parse(line);
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        records.push(parsed as PiRecord);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid JSON on line ${index + 1}: ${message}`);
    }
  }
  return records;
}

/** Extracted text and thinking payloads from a Pi message `content` field. */
export interface ExtractedContent {
  text: string;
  thinking: string;
}

/**
 * Pull visible text and assistant thinking out of a Pi message content field.
 * Content may be a plain string or an array of typed parts; tool calls and
 * other part types are ignored.
 */
export function extractTextAndThinking(content: unknown): ExtractedContent {
  const textParts: string[] = [];
  const thinkingParts: string[] = [];

  if (typeof content === "string") {
    const text = content.trim();
    return { text: text, thinking: "" };
  }
  if (!Array.isArray(content)) return { text: "", thinking: "" };

  for (const item of content) {
    if (item === null || typeof item !== "object") continue;
    const part = item as Record<string, unknown>;
    if (part.type === "text") {
      const text = part.text;
      if (typeof text === "string" && text.trim() !== "") textParts.push(text.trim());
    } else if (part.type === "thinking") {
      const thinking = part.thinking;
      if (typeof thinking === "string" && thinking.trim() !== "") {
        thinkingParts.push(thinking.trim());
      }
    }
  }

  return {
    text: textParts.join("\n\n").trim(),
    thinking: thinkingParts.join("\n\n").trim(),
  };
}

/** Collapse runs of whitespace into single spaces and trim the result. */
export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
