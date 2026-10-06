import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { extractTextAndThinking, isoformat, parseIso, parseJsonl } from "./parse.ts";
import type {
  GenerateOptions,
  PiRecord,
  RenderOptions,
  SessionMeta,
  ThinkingStyle,
} from "./types.ts";

function rstrip(text: string): string {
  return text.replace(/\s+$/, "");
}

interface IdIndex {
  meta: SessionMeta;
  order: string[];
  byId: Map<string, PiRecord>;
}

/** Index records by id and collect the `type: "session"` header metadata. */
export function buildIdIndex(records: readonly PiRecord[]): IdIndex {
  const meta: SessionMeta = { sessionId: "", startedAt: null, cwd: "" };
  const order: string[] = [];
  const byId = new Map<string, PiRecord>();

  for (const record of records) {
    if (record.type === "session") {
      if (typeof record.id === "string") meta.sessionId = record.id;
      meta.startedAt = parseIso(record.timestamp) ?? meta.startedAt;
      if (typeof record.cwd === "string") meta.cwd = record.cwd;
    }

    const id = record.id;
    if (typeof id === "string" && id !== "") {
      order.push(id);
      byId.set(id, record);
    }
  }

  return { meta, order, byId };
}

/** Resolve the leaf id used by branch mode. */
export function resolveLeafId(
  order: readonly string[],
  byId: ReadonlyMap<string, PiRecord>,
  leaf: string | null,
): string | null {
  if (leaf) return byId.has(leaf) ? leaf : null;

  for (let index = order.length - 1; index >= 0; index -= 1) {
    const id = order[index];
    if (id === undefined) continue;
    if (byId.get(id)?.type === "message") return id;
  }

  return order.length > 0 ? (order[order.length - 1] ?? null) : null;
}

/** Follow `parentId` links from a leaf back to the root and return them root-first. */
export function collectBranchChain(
  leafId: string,
  byId: ReadonlyMap<string, PiRecord>,
): string[] {
  const chain: string[] = [];
  const seen = new Set<string>();

  let current: string | null | undefined = leafId;
  while (current && !seen.has(current)) {
    seen.add(current);
    chain.push(current);
    const parent: unknown = byId.get(current)?.parentId;
    current = typeof parent === "string" && parent !== "" ? parent : null;
  }

  chain.reverse();
  return chain;
}

/** True when a record is a user/assistant message that produces visible output. */
export function isRenderableMessage(record: PiRecord): boolean {
  if (record.type !== "message") return false;
  const message = record.message;
  if (message === null || typeof message !== "object") return false;
  const role = message.role;
  if (role !== "user" && role !== "assistant") return false;
  const { text, thinking } = extractTextAndThinking(message.content);
  if (role === "user") return text.trim() !== "";
  return text.trim() !== "" || thinking.trim() !== "";
}

/**
 * Keep only the last `cut` renderable conversation messages. Non-message
 * records (e.g. bashExecution) at or after the first kept message are preserved
 * so the window stays intact.
 */
export function applyCut(records: readonly PiRecord[], cut: number): PiRecord[] {
  if (cut <= 0) return [];
  const positions: number[] = [];
  records.forEach((record, index) => {
    if (isRenderableMessage(record)) positions.push(index);
  });
  if (positions.length <= cut) return [...records];
  const start = positions[positions.length - cut];
  return start === undefined ? [] : records.slice(start);
}

function blockquote(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => (line.trim() === "" ? ">" : `> ${line}`))
    .join("\n");
}

interface FormatGroupArgs {
  role: "user" | "assistant";
  text: string;
  thinkingBlocks: string[];
  thinkingStyle: ThinkingStyle;
  includeTimestamps: boolean;
  tsFirst: Date | null;
  tsLast: Date | null;
}

function formatGroup(args: FormatGroupArgs): string {
  const roleLabel = args.role === "user" ? "USER" : "ASSISTANT";
  const lines: string[] = [`### ${roleLabel}`, ""];

  if (args.includeTimestamps && args.tsFirst) {
    if (args.tsLast && args.tsLast.getTime() !== args.tsFirst.getTime()) {
      lines.push(`_timestamps: ${isoformat(args.tsFirst)} … ${isoformat(args.tsLast)}_`);
    } else {
      lines.push(`_timestamp: ${isoformat(args.tsFirst)}_`);
    }
    lines.push("");
  }

  if (args.text.trim() !== "") {
    lines.push(rstrip(args.text));
  } else if (args.thinkingBlocks.length === 0) {
    lines.push("(no content)");
  }

  if (args.role === "assistant" && args.thinkingStyle === "details") {
    const parts = args.thinkingBlocks
      .filter((block) => block.trim() !== "")
      .map((block) => blockquote(rstrip(block)));
    if (parts.length > 0) {
      lines.push(
        ["<details>", "<summary>thinking</summary>", "", parts.join("\n\n"), "", "</details>"].join(
          "\n",
        ),
      );
      lines.push("");
    }
  }

  lines.push("");
  return lines.join("\n");
}

/** Render parsed records to conversation-first Markdown. Pure; no file I/O. */
export function renderMarkdown(
  records: readonly PiRecord[],
  inputJsonl: string,
  options: RenderOptions,
): string {
  const { mode, leafId, thinkingStyle, includeBash, includeTimestamps, groupTurns, cut } = options;

  if (mode !== "all" && mode !== "branch") throw new Error(`Invalid mode: ${mode}`);

  const { meta, order, byId } = buildIdIndex(records);

  let selectedRecords: readonly PiRecord[];
  let branchInfo = "";

  if (mode === "all") {
    selectedRecords = records;
  } else {
    const leaf = resolveLeafId(order, byId, leafId);
    if (!leaf) throw new Error("Could not resolve leaf id (empty file?)");
    selectedRecords = collectBranchChain(leaf, byId)
      .map((id) => byId.get(id))
      .filter((record): record is PiRecord => record !== undefined);
    branchInfo = `leaf: ${leaf}`;
  }

  if (cut !== null) {
    if (cut < 0) throw new Error(`cut must be a non-negative integer (got ${cut})`);
    selectedRecords = applyCut(selectedRecords, cut);
  }

  const out: string[] = [];
  out.push(`# PI session (conversation) — ${basename(inputJsonl)}`, "");
  if (meta.sessionId) out.push(`- id: \`${meta.sessionId}\``);
  if (meta.startedAt) out.push(`- started: \`${isoformat(meta.startedAt)}\``);
  if (meta.cwd) out.push(`- cwd: \`${meta.cwd}\``);
  out.push(`- source: \`${inputJsonl}\``);
  out.push(`- mode: \`${mode}\``);
  if (branchInfo) out.push(`- ${branchInfo}`);
  out.push(`- thinking: \`${thinkingStyle}\``);
  out.push(`- group_turns: \`${groupTurns ? "on" : "off"}\``);
  if (cut !== null) out.push(`- cut: \`${cut}\``);
  if (includeTimestamps) out.push("- timestamps: `on`");
  out.push("", "---", "");

  let currentRole: "user" | "assistant" | null = null;
  let textParts: string[] = [];
  let thinkingParts: string[] = [];
  let tsFirst: Date | null = null;
  let tsLast: Date | null = null;

  const flush = (): void => {
    if (!currentRole) return;

    const text = textParts
      .filter((part) => part.trim() !== "")
      .join("\n\n")
      .trim();
    const thinkingBlocks = thinkingParts.filter((part) => part.trim() !== "");

    const skip =
      (currentRole === "user" && text === "") ||
      (currentRole === "assistant" && text === "" && thinkingBlocks.length === 0);

    if (!skip) {
      out.push(
        rstrip(
          formatGroup({
            role: currentRole,
            text,
            thinkingBlocks,
            thinkingStyle,
            includeTimestamps,
            tsFirst,
            tsLast,
          }),
        ),
      );
      out.push("");
    }

    currentRole = null;
    textParts = [];
    thinkingParts = [];
    tsFirst = null;
    tsLast = null;
  };

  for (const record of selectedRecords) {
    if (record.type !== "message") continue;
    const message = record.message;
    if (message === null || typeof message !== "object") continue;

    const role = message.role;

    if (role !== "user" && role !== "assistant") {
      if (role === "bashExecution" && includeBash) {
        flush();

        const parts: string[] = ["### SYSTEM (bashExecution)", ""];
        if (includeTimestamps) {
          const ts = parseIso(record.timestamp);
          if (ts) parts.push(`_timestamp: ${isoformat(ts)}_`, "");
        }
        const command = message.command;
        if (typeof command === "string" && command.trim() !== "") {
          parts.push("Command:", "```bash", rstrip(command), "```", "");
        }
        const output = message.output;
        if (typeof output === "string" && output.trim() !== "") {
          parts.push("Output:", "```text", output.replace(/\n+$/, ""), "```", "");
        }
        out.push(rstrip(parts.join("\n")), "");
      }
      continue;
    }

    const { text, thinking } = extractTextAndThinking(message.content);

    if (role === "user" && text.trim() === "") continue;
    if (role === "assistant" && text.trim() === "" && thinking.trim() === "") continue;

    const ts = parseIso(record.timestamp);

    if (!groupTurns) {
      flush();
      out.push(
        rstrip(
          formatGroup({
            role,
            text,
            thinkingBlocks: thinking.trim() !== "" ? [thinking] : [],
            thinkingStyle,
            includeTimestamps,
            tsFirst: ts,
            tsLast: ts,
          }),
        ),
      );
      out.push("");
      continue;
    }

    if (currentRole === null) {
      currentRole = role;
    } else if (currentRole !== role) {
      flush();
      currentRole = role;
    }

    if (ts && tsFirst === null) tsFirst = ts;
    if (ts) tsLast = ts;

    if (text.trim() !== "") textParts.push(text.trim());
    if (role === "assistant" && thinking.trim() !== "") thinkingParts.push(thinking.trim());
  }

  flush();

  return `${rstrip(out.join("\n"))}\n`;
}

/** Read a session `.jsonl` file and render it to Markdown. */
export function generateMarkdown(options: GenerateOptions): string {
  const records = parseJsonl(readFileSync(options.inputJsonl, "utf-8"));
  return renderMarkdown(records, options.inputJsonl, options);
}
