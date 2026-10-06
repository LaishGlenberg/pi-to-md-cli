import { statSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";

import { ArgumentError, parseArguments, type ParsedArguments } from "./arguments.ts";
import {
  DEFAULT_CRON_MINUTES,
  DEFAULT_DIR_LIMIT,
  DEFAULT_SESSIONS_DIR,
  DEFAULT_SESSION_LIMIT,
  DEFAULT_SNIPPET_LENGTH,
} from "./constants.ts";
import { generateMarkdown } from "./converter.ts";
import { scheduleDelete } from "./cron.ts";
import { HELP_TEXT, VERSION } from "./help.ts";
import { openOutput, suggestedOutputName, writeOutput } from "./output.ts";
import { runSessionPicker } from "./picker.ts";
import { maybeRelaunchInTerminal } from "./relaunch.ts";
import { expandHome } from "./sessions.ts";

function fail(message: string): number {
  process.stderr.write(`pi-to-md: ${message}\n`);
  return 1;
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Read an integer from the environment. `min` of 0 allows zero ("no limit");
 * anything below `min` falls back to the default with a warning.
 */
function intEnv(name: string, fallback: number, min: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  if (!/^\d+$/.test(raw.trim()) || Number(raw) < min) {
    process.stderr.write(`pi-to-md: ignoring invalid ${name}='${raw}' (using ${fallback})\n`);
    return fallback;
  }
  return Number(raw);
}

function buildRenderOptions(args: ParsedArguments) {
  return {
    mode: args.mode,
    leafId: args.leaf,
    thinkingStyle: args.noThinking ? ("omit" as const) : ("details" as const),
    includeBash: args.includeBash,
    includeTimestamps: args.timestamps,
    groupTurns: args.groupTurns,
    cut: args.cut,
  };
}

function convertFile(args: ParsedArguments): number {
  const markdown = generateMarkdown({
    inputJsonl: args.input ?? "",
    ...buildRenderOptions(args),
  });

  if (args.output === null || args.output === "-") {
    process.stdout.write(markdown);
  } else {
    writeOutput(args.output, markdown);
  }
  return 0;
}

function exportSelection(
  args: ParsedArguments,
  selection: { filePath: string; cwd: string },
): number {
  const markdown = generateMarkdown({
    inputJsonl: selection.filePath,
    ...buildRenderOptions(args),
  });

  const stdoutMode = (process.env.PI_MD_STDOUT ?? "0") === "1" || args.output === "-";
  if (stdoutMode) {
    process.stdout.write(markdown);
    if (args.time.enabled) {
      process.stderr.write("pi-to-md: --time ignored (no file written)\n");
    }
    return 0;
  }

  const outdir = process.env.PI_MD_OUTDIR ?? process.cwd();
  const outputPath = args.output ?? join(outdir, suggestedOutputName(selection.filePath, selection.cwd));

  writeOutput(outputPath, markdown);
  process.stdout.write(`\nWrote: ${outputPath}\n`);
  openOutput(outputPath);
  if (args.time.enabled && args.time.minutes !== null) {
    scheduleDelete(outputPath, args.time.minutes);
  }
  return 0;
}

async function runPicker(args: ParsedArguments, argv: readonly string[]): Promise<number> {
  const relaunch = maybeRelaunchInTerminal([...argv]);
  if (relaunch === "relaunched") return 0;
  if (relaunch === "no-terminal") return fail("no terminal emulator found");

  const sessionsDir = expandHome(process.env.PI_SESSIONS_DIR ?? DEFAULT_SESSIONS_DIR);
  if (!isDirectory(sessionsDir)) return fail(`session directory not found: ${sessionsDir}`);

  const controller = new AbortController();
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const onClose = (): void => controller.abort();
  rl.once("close", onClose);

  try {
    const selection = await runSessionPicker(
      rl,
      sessionsDir,
      {
        dirLimit: intEnv("PI_DIR_LIMIT", DEFAULT_DIR_LIMIT, 0),
        sessionLimit: intEnv("PI_SESSION_LIMIT", DEFAULT_SESSION_LIMIT, 0),
        snippetLength: intEnv("PI_MD_SNIPPET", DEFAULT_SNIPPET_LENGTH, 0),
      },
      controller.signal,
    );
    if (selection === null) return 1;
    return exportSelection(args, selection);
  } finally {
    rl.close();
  }
}

/** CLI entry point. Returns the process exit code. */
export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  let args: ParsedArguments;
  try {
    args = parseArguments(argv);
  } catch (error) {
    const message = error instanceof ArgumentError ? error.message : String(error);
    return fail(message);
  }

  if (args.help) {
    process.stdout.write(HELP_TEXT);
    return 0;
  }
  if (args.version) {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }

  if (args.cut !== null && args.cut < 0) {
    return fail(`--cut expects a non-negative integer (got ${args.cut})`);
  }
  if (args.time.enabled) {
    const minutes = args.time.minutes ?? intEnv("PI_MD_CRON_MINUTES", DEFAULT_CRON_MINUTES, 1);
    if (minutes < 1) {
      return fail(`--time expects a positive number of minutes (got '${minutes}')`);
    }
    args.time.minutes = minutes;
  }

  try {
    if (args.input !== null) return convertFile(args);
    return await runPicker(args, argv);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}
