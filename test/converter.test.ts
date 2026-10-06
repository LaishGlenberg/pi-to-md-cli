import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  extractTextAndThinking,
  generateMarkdown,
  isoformat,
  parseIso,
  parseJsonl,
  renderMarkdown,
  type PiRecord,
  type RenderOptions,
} from "../src/index.ts";

function rec(id: string, parent: string | null, role: string, text: string, ts = 0): PiRecord {
  return {
    type: "message",
    id,
    parentId: parent,
    timestamp: `2026-01-01T00:00:${String(ts).padStart(2, "0")}Z`,
    message: { role, content: text },
  };
}

function bash(id: string, parent: string | null, command: string, ts = 0): PiRecord {
  return {
    type: "message",
    id,
    parentId: parent,
    timestamp: `2026-01-01T00:00:${String(ts).padStart(2, "0")}Z`,
    message: { role: "bashExecution", command, output: "ok" },
  };
}

function md(records: readonly PiRecord[], overrides: Partial<RenderOptions> = {}): string {
  return renderMarkdown(records, "session.jsonl", {
    mode: "all",
    leafId: null,
    thinkingStyle: "omit",
    includeBash: false,
    includeTimestamps: false,
    groupTurns: false,
    cut: null,
    ...overrides,
  });
}

function headings(markdown: string): string[] {
  return markdown.split("\n").filter((line) => line.startsWith("### "));
}

const CUT_RECORDS: PiRecord[] = [
  rec("m1", null, "user", "U1", 1),
  rec("m2", "m1", "assistant", "A1", 2),
  bash("b1", "m2", "echo before", 3),
  rec("m3", "b1", "user", "U2", 4),
  rec("m4", "m3", "assistant", "A2", 5),
  bash("b2", "m4", "echo inside", 6),
  rec("m5", "b2", "user", "U3", 7),
];

test("no cut keeps every message", () => {
  assert.deepEqual(headings(md(CUT_RECORDS)), [
    "### USER",
    "### ASSISTANT",
    "### USER",
    "### ASSISTANT",
    "### USER",
  ]);
});

test("cut 2 returns the last assistant and user", () => {
  const markdown = md(CUT_RECORDS, { cut: 2 });
  assert.deepEqual(headings(markdown), ["### ASSISTANT", "### USER"]);
  assert.match(markdown, /A2/);
  assert.match(markdown, /U3/);
  assert.doesNotMatch(markdown, /U2/);
  assert.match(markdown, /- cut: `2`/);
});

test("cut 3 returns user, assistant, user", () => {
  const markdown = md(CUT_RECORDS, { cut: 3 });
  assert.deepEqual(headings(markdown), ["### USER", "### ASSISTANT", "### USER"]);
  assert.match(markdown, /U2/);
  assert.doesNotMatch(markdown, /U1/);
});

test("cut 0 returns no messages", () => {
  const markdown = md(CUT_RECORDS, { cut: 0 });
  assert.deepEqual(headings(markdown), []);
  assert.doesNotMatch(markdown, /U3/);
  assert.match(markdown, /- cut: `0`/);
});

test("cut larger than total keeps all", () => {
  assert.equal(headings(md(CUT_RECORDS, { cut: 99 })).length, 5);
});

test("cut window keeps bash inside and drops the one before", () => {
  const markdown = md(CUT_RECORDS, { cut: 2, includeBash: true });
  assert.deepEqual(headings(markdown), [
    "### ASSISTANT",
    "### SYSTEM (bashExecution)",
    "### USER",
  ]);
  assert.match(markdown, /echo inside/);
  assert.doesNotMatch(markdown, /echo before/);
});

test("cut counts messages, not groups", () => {
  const records = [rec("u1", null, "user", "first", 1), rec("u2", "u1", "user", "second", 2)];
  const markdown = md(records, { groupTurns: true, cut: 1 });
  assert.match(markdown, /second/);
  assert.doesNotMatch(markdown, /first/);
});

test("branch mode honours cut", () => {
  const markdown = md(CUT_RECORDS, { mode: "branch", leafId: "m5", cut: 2 });
  assert.deepEqual(headings(markdown), ["### ASSISTANT", "### USER"]);
});

test("grouping merges consecutive messages by role", () => {
  const records = [
    rec("u1", null, "user", "one", 1),
    rec("u2", "u1", "user", "two", 2),
    rec("a1", "u2", "assistant", "answer", 3),
  ];
  const markdown = md(records, { groupTurns: true });
  assert.deepEqual(headings(markdown), ["### USER", "### ASSISTANT"]);
  assert.match(markdown, /one\n\ntwo/);
});

test("thinking blocks render inside details unless omitted", () => {
  const records: PiRecord[] = [
    {
      type: "message",
      id: "a1",
      parentId: null,
      timestamp: "2026-01-01T00:00:01Z",
      message: {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "step one" },
          { type: "text", text: "final answer" },
        ],
      },
    },
  ];

  const withThinking = md(records, { thinkingStyle: "details" });
  assert.match(withThinking, /<summary>thinking<\/summary>/);
  assert.match(withThinking, /> step one/);
  assert.match(withThinking, /final answer/);

  const without = md(records, { thinkingStyle: "omit" });
  assert.doesNotMatch(without, /step one/);
  assert.match(without, /final answer/);
});

test("timestamps render when enabled", () => {
  const markdown = md([rec("u1", null, "user", "hi", 5)], { includeTimestamps: true });
  assert.match(markdown, /_timestamp: 2026-01-01T00:00:05\+00:00_/);
});

test("parseJsonl skips blanks and rejects malformed lines", () => {
  assert.deepEqual(parseJsonl('{"a":1}\n\n{"b":2}\n'), [{ a: 1 }, { b: 2 }]);
  assert.throws(() => parseJsonl("{oops}\n"), /Invalid JSON on line 1/);
});

test("extractTextAndThinking handles strings and parts", () => {
  assert.deepEqual(extractTextAndThinking("  hello  "), { text: "hello", thinking: "" });
  assert.deepEqual(
    extractTextAndThinking([
      { type: "thinking", thinking: " think " },
      { type: "text", text: " say " },
      { type: "toolCall", name: "x" },
    ]),
    { text: "say", thinking: "think" },
  );
});

test("timestamps round-trip through parseIso and isoformat", () => {
  const date = parseIso("2026-02-19T08:37:11.936Z");
  assert.ok(date);
  assert.equal(isoformat(date), "2026-02-19T08:37:11.936000+00:00");
  assert.equal(isoformat(new Date("2026-02-19T08:37:11Z")), "2026-02-19T08:37:11+00:00");
  assert.equal(parseIso("not a date"), null);
});

test("generateMarkdown reads a session file and writes the header", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-to-md-"));
  const path = join(dir, "2026-01-01T00-00-00-000Z_abc.jsonl");
  const records = [
    { type: "session", id: "s1", cwd: "/tmp", timestamp: "2026-01-01T00:00:00Z" },
    rec("u1", null, "user", "hello", 1),
  ];
  await writeFile(path, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`);

  const markdown = generateMarkdown({
    inputJsonl: path,
    mode: "all",
    leafId: null,
    thinkingStyle: "omit",
    includeBash: false,
    includeTimestamps: false,
    groupTurns: true,
    cut: null,
  });

  assert.match(markdown, /^# PI session \(conversation\)/);
  assert.match(markdown, /- id: `s1`/);
  assert.match(markdown, /- cwd: `\/tmp`/);
  assert.match(markdown, /hello/);
});
