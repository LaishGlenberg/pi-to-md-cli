import type { Interface } from "node:readline/promises";

import { formatTimestamp } from "./output.ts";
import { listSessionDirs, listSessionFiles, prettySize } from "./sessions.ts";
import type { SessionDirEntry, SessionFileEntry } from "./types.ts";

export interface PickerConfig {
  dirLimit: number;
  sessionLimit: number;
  snippetLength: number;
}

export interface PickerSelection {
  filePath: string;
  cwd: string;
}

/**
 * Ask until a valid 1..N selection (or `q` to quit). Returns null on
 * cancel/EOF so callers can bail out.
 */
export async function promptIndex(
  rl: Interface,
  prompt: string,
  count: number,
  signal?: AbortSignal,
): Promise<number | null> {
  for (;;) {
    let answer: string;
    try {
      answer = signal
        ? await rl.question(prompt, { signal })
        : await rl.question(prompt);
    } catch {
      return null;
    }

    const value = answer.trim();
    if (/^(q|quit|exit)$/i.test(value)) {
      process.stderr.write("Cancelled.\n");
      return null;
    }
    if (/^\d+$/.test(value)) {
      const index = Number(value);
      if (index >= 1 && index <= count) return index;
    }
    process.stderr.write(`Please enter a number between 1 and ${count} (or q to quit).\n`);
  }
}

function trimToLimit<T>(rows: readonly T[], limit: number): T[] {
  return limit > 0 ? rows.slice(0, limit) : [...rows];
}

function printDirList(sessionsDir: string, dirs: readonly SessionDirEntry[], limit: number): void {
  process.stdout.write(`Pi session projects (${sessionsDir}):\n`);
  const shown = trimToLimit(dirs, limit);
  shown.forEach((dir, index) => {
    if (index === 10) process.stdout.write("\n");
    process.stdout.write(
      `  ${String(index + 1).padStart(3)}) ${dir.cwd}  ` +
        `[${dir.sessionCount} sessions, last ${formatTimestamp(dir.mtime)}]\n`,
    );
  });
  if (shown.length < dirs.length) {
    process.stdout.write(
      `  ... ${dirs.length - shown.length} more (PI_DIR_LIMIT=${limit}, use 0 for all)\n`,
    );
  }
  process.stdout.write("\n");
}

function printFileList(cwd: string, files: readonly SessionFileEntry[], limit: number): void {
  process.stdout.write(`\nSessions in ${cwd}:\n`);
  const shown = trimToLimit(files, limit);
  shown.forEach((file, index) => {
    process.stdout.write(
      `  ${String(index + 1).padStart(3)}) ${formatTimestamp(file.mtime)}  ` +
        `${prettySize(file.size).padStart(8)}  ${file.preview}\n`,
    );
  });
  if (shown.length < files.length) {
    process.stdout.write(
      `  ... ${files.length - shown.length} more (PI_SESSION_LIMIT=${limit}, use 0 for all)\n`,
    );
  }
  process.stdout.write("\n");
}

/** Run the two-step project/session picker and return the chosen file. */
export async function runSessionPicker(
  rl: Interface,
  sessionsDir: string,
  config: PickerConfig,
  signal?: AbortSignal,
): Promise<PickerSelection | null> {
  const dirs = listSessionDirs(sessionsDir);
  if (dirs.length === 0) {
    process.stderr.write("pi-to-md: no session directories with .jsonl files found\n");
    return null;
  }

  printDirList(sessionsDir, dirs, config.dirLimit);
  const shownDirs = trimToLimit(dirs, config.dirLimit);
  const dirIndex = await promptIndex(
    rl,
    "Export from which project? ",
    shownDirs.length,
    signal,
  );
  if (dirIndex === null) return null;

  const selectedDir = shownDirs[dirIndex - 1];
  if (selectedDir === undefined) return null;

  const files = listSessionFiles(selectedDir.path, config.snippetLength);
  if (files.length === 0) {
    process.stderr.write(`pi-to-md: no sessions found in ${selectedDir.path}\n`);
    return null;
  }

  printFileList(selectedDir.cwd, files, config.sessionLimit);
  const shownFiles = trimToLimit(files, config.sessionLimit);
  const fileIndex = await promptIndex(
    rl,
    "Convert which session? ",
    shownFiles.length,
    signal,
  );
  if (fileIndex === null) return null;

  const selectedFile = shownFiles[fileIndex - 1];
  if (selectedFile === undefined) return null;

  return { filePath: selectedFile.path, cwd: selectedDir.cwd };
}
