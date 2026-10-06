import assert from "node:assert/strict";
import { mkdir, mkdtemp, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  cwdFromDirName,
  listSessionDirs,
  listSessionFiles,
  prettySize,
  previewSession,
  suggestedOutputName,
} from "../src/index.ts";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "pi-sessions-"));
  const foo = join(root, "--home-lg-foo--");
  const bar = join(root, "--home-lg-bar--");
  const empty = join(root, "--home-lg-empty--");
  await mkdir(foo, { recursive: true });
  await mkdir(bar, { recursive: true });
  await mkdir(empty, { recursive: true });

  const fooNew = join(foo, "2026-05-02T00-00-00-000Z_bbbbbbbb.jsonl");
  await writeFile(
    fooNew,
    `${[
      JSON.stringify({ type: "session", id: "s2", cwd: "/real/foo" }),
      JSON.stringify({
        type: "message",
        id: "m1",
        message: { role: "user", content: [{ type: "text", text: "  hello   world from foo  " }] },
      }),
    ].join("\n")}\n`,
  );

  const fooOld = join(foo, "2026-05-01T00-00-00-000Z_aaaaaaaa.jsonl");
  await writeFile(
    fooOld,
    `${JSON.stringify({ type: "message", id: "m1", message: { role: "user", content: "older" } })}\n`,
  );

  const barFile = join(bar, "2026-04-01T00-00-00-000Z_cccccccc.jsonl");
  await writeFile(
    barFile,
    `${JSON.stringify({ type: "message", id: "m1", message: { role: "user", content: "bar" } })}\n`,
  );

  await writeFile(join(empty, "notes.txt"), "x");

  await utimes(fooNew, new Date(2026, 4, 2), new Date(2026, 4, 2));
  await utimes(fooOld, new Date(2026, 4, 1), new Date(2026, 4, 1));
  await utimes(barFile, new Date(2026, 3, 1), new Date(2026, 3, 1));

  return { root, fooNew, fooOld, barFile };
}

test("listSessionDirs finds projects with jsonl files, newest first", async () => {
  const dirs = await fixture().then(({ root }) => listSessionDirs(root));
  assert.equal(dirs.length, 2);
  assert.equal(dirs[0]?.cwd, "/real/foo");
  assert.equal(dirs[0]?.sessionCount, 2);
  assert.equal(dirs[1]?.cwd, "/home/lg/bar");
  assert.equal(dirs[1]?.sessionCount, 1);
});

test("cwdFromDirName reconstructs the project path", () => {
  assert.equal(cwdFromDirName("/root/--home-lg-scripts--"), "/home/lg/scripts");
  assert.equal(cwdFromDirName("/root/--home-lg-.pi-agent--"), "/home/lg/.pi/agent");
});

test("previewSession collapses whitespace and honours the snippet length", async () => {
  const { fooNew } = await fixture();
  assert.equal(previewSession(fooNew, 60), "hello world from foo");
  assert.equal(previewSession(fooNew, 5), "hello");
  assert.equal(previewSession(fooNew, 0), "");
});

test("listSessionFiles returns newest first with size and preview", async () => {
  const { root, fooNew } = await fixture();
  const files = listSessionFiles(join(root, "--home-lg-foo--"), 60);
  assert.equal(files.length, 2);
  assert.equal(files[0]?.path, fooNew);
  assert.equal(files[0]?.preview, "hello world from foo");
  assert.ok((files[0]?.size ?? 0) > 0);
});

test("prettySize matches the shell picker formatting", () => {
  assert.equal(prettySize(0), "0B");
  assert.equal(prettySize(512), "512B");
  assert.equal(prettySize(1024), "1.0K");
  assert.equal(prettySize(1536), "1.5K");
  assert.equal(prettySize(1024 * 1024), "1.0M");
  assert.equal(prettySize(1024 * 1024 * 1024), "1.0G");
});

test("suggestedOutputName builds project_timestamp_shortid.md", () => {
  const file = "/sessions/--home-lg-vaultnel-firebase--/2026-09-21T10-32-43-739Z_01a0c386-deadbeef.jsonl";
  assert.equal(
    suggestedOutputName(file, "/home/lg/vaultnel-firebase"),
    "vaultnel-firebase_2026-09-21_10-32-43-739Z_01a0c386.md",
  );
  assert.equal(
    suggestedOutputName(file, "/home/lg/my proj!"),
    "my_proj__2026-09-21_10-32-43-739Z_01a0c386.md",
  );
});
