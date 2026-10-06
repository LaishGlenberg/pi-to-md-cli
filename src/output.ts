import { accessSync, constants, mkdirSync, writeFileSync } from "node:fs";
import { basename, delimiter, dirname, isAbsolute, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

/** Find an executable on `PATH` (or at an explicit path) and return it. */
export function findExecutable(command: string): string | null {
  if (command.includes("/")) {
    try {
      accessSync(command, constants.X_OK);
      return command;
    } catch {
      return null;
    }
  }

  const pathEnv = process.env.PATH ?? "";
  for (const dir of pathEnv.split(delimiter)) {
    if (dir === "") continue;
    const candidate = join(dir, command);
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // keep looking
    }
  }
  return null;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Format a Date for the picker as local `YYYY-MM-DD HH:MM`. */
export function formatTimestamp(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/**
 * Build the default output filename used by the picker:
 * `<project>_<timestamp>_<short-id>.md`.
 */
export function suggestedOutputName(filePath: string, cwd: string): string {
  const base = basename(filePath).replace(/\.jsonl$/, "");
  const underscore = base.indexOf("_");

  let stamp = underscore === -1 ? base : base.slice(0, underscore);
  stamp = stamp.replace(/T/g, "_");
  const dot = stamp.indexOf(".");
  if (dot !== -1) stamp = stamp.slice(0, dot);

  const short = (underscore === -1 ? base : base.slice(base.lastIndexOf("_") + 1)).slice(0, 8);
  const project = basename(cwd).replace(/[^A-Za-z0-9._-]/g, "_");

  return `${project}_${stamp}_${short}.md`;
}

/** Write Markdown to `outputPath`, creating parent directories as needed. */
export function writeOutput(outputPath: string, markdown: string): void {
  const absolute = resolve(outputPath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, markdown, "utf-8");
}

/** Open the freshly written Markdown in an editor (VS Code by default). */
export function openOutput(outputPath: string): void {
  if ((process.env.PI_MD_OPEN ?? "1") !== "1") return;

  const opener = process.env.PI_MD_OPENER ?? "code";
  if (findExecutable(opener) === null) {
    process.stderr.write(
      `pi-to-md: '${opener}' not found, skipping auto-open (set PI_MD_OPENER or PI_MD_OPEN=0)\n`,
    );
    return;
  }

  const result = spawnSync(opener, [outputPath], { stdio: ["ignore", "inherit", "inherit"] });
  if (result.error) {
    process.stderr.write(`pi-to-md: warning: could not open '${opener}': ${result.error.message}\n`);
  } else if (result.status !== 0) {
    process.stderr.write(`pi-to-md: warning: '${opener}' exited with status ${result.status}\n`);
  }
}

/** Resolve a possibly-relative path against the current working directory. */
export function anchorToCwd(path: string): string {
  return isAbsolute(path) ? path : resolve(process.cwd(), path);
}
