import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { main } from "../src/index.ts";

async function sessionFixture() {
  const dir = await mkdtemp(join(tmpdir(), "pi-to-md-cli-"));
  const input = join(dir, "2026-01-01T00-00-00-000Z_abcdef01.jsonl");
  await writeFile(
    input,
    `${[
      JSON.stringify({ type: "session", id: "s1", cwd: "/tmp", timestamp: "2026-01-01T00:00:00Z" }),
      JSON.stringify({ type: "message", id: "m1", parentId: null, message: { role: "user", content: "hello" } }),
      JSON.stringify({ type: "message", id: "m2", parentId: "m1", message: { role: "assistant", content: "hi there" } }),
    ].join("\n")}\n`,
  );
  return { dir, input };
}

test("main converts a file to an explicit output path", async () => {
  const { dir, input } = await sessionFixture();
  const output = join(dir, "out.md");

  const code = await main([input, "-o", output, "--no-thinking"]);
  assert.equal(code, 0);

  const markdown = await readFile(output, "utf-8");
  assert.match(markdown, /^# PI session \(conversation\)/);
  assert.match(markdown, /hello/);
  assert.match(markdown, /hi there/);
});

test("main reports a missing input file without throwing", async () => {
  const code = await main([join(tmpdir(), "does-not-exist-12345.jsonl")]);
  assert.equal(code, 1);
});

test("main rejects unknown options", async () => {
  assert.equal(await main(["--bogus"]), 1);
});

test("main rejects a negative cut", async () => {
  const { input } = await sessionFixture();
  assert.equal(await main([input, "--cut", "-1"]), 1);
});
