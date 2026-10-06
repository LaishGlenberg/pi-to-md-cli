import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { scheduleDelete } from "../src/index.ts";

test("scheduleDelete appends a tagged one-shot cron line", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-cron-"));
  const binDir = join(dir, "bin");
  await mkdir(binDir, { recursive: true });

  const captured = join(dir, "crontab.txt");
  const fake = join(binDir, "crontab");
  await writeFile(
    fake,
    `#!/bin/sh\nif [ "$1" = "-l" ]; then echo "# existing line"; exit 0; fi\ncat > "$FAKE_CRONTAB_OUT"\n`,
  );
  await chmod(fake, 0o755);

  const originalPath = process.env.PATH;
  const originalOut = process.env.FAKE_CRONTAB_OUT;
  process.env.PATH = `${binDir}:${originalPath ?? ""}`;
  process.env.FAKE_CRONTAB_OUT = captured;

  try {
    scheduleDelete(join(dir, "out.md"), 5);
  } finally {
    process.env.PATH = originalPath;
    if (originalOut === undefined) delete process.env.FAKE_CRONTAB_OUT;
    else process.env.FAKE_CRONTAB_OUT = originalOut;
  }

  const crontab = await readFile(captured, "utf-8");
  assert.match(crontab, /# existing line/);
  assert.match(crontab, /\d+ \d+ \d+ \d+ \* rm -f -- /);
  assert.match(crontab, /# pi-to-md-expire-\d+-\d+/);
  assert.ok(crontab.includes("out.md"));
});
