import type { ExportMode } from "./types.ts";

export interface TimeOption {
  enabled: boolean;
  /** Explicit minutes from the CLI; null means use the environment default. */
  minutes: number | null;
}

export interface ParsedArguments {
  input: string | null;
  output: string | null;
  mode: ExportMode;
  leaf: string | null;
  noThinking: boolean;
  includeBash: boolean;
  timestamps: boolean;
  groupTurns: boolean;
  cut: number | null;
  time: TimeOption;
  help: boolean;
  version: boolean;
}

/** Raised for malformed command-line arguments. */
export class ArgumentError extends Error {}

function parseIntValue(value: string, flag: string): number {
  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    throw new ArgumentError(`${flag} expects an integer (got '${value}')`);
  }
  return Number(trimmed);
}

function parseMode(value: string, flag: string): ExportMode {
  if (value === "all" || value === "branch") return value;
  throw new ArgumentError(`${flag} must be 'all' or 'branch' (got '${value}')`);
}

/**
 * Parse the CLI arguments shared by the converter and the interactive picker.
 * Unknown options are rejected rather than forwarded.
 */
export function parseArguments(argv: readonly string[]): ParsedArguments {
  const result: ParsedArguments = {
    input: null,
    output: null,
    mode: "all",
    leaf: null,
    noThinking: false,
    includeBash: false,
    timestamps: false,
    groupTurns: true,
    cut: null,
    time: { enabled: false, minutes: null },
    help: false,
    version: false,
  };

  const positionals: string[] = [];
  let optionsEnded = false;
  let index = 0;

  const takeValue = (flag: string): string => {
    const next = argv[index + 1];
    if (next === undefined) throw new ArgumentError(`option ${flag} requires a value`);
    index += 1;
    return next;
  };

  while (index < argv.length) {
    const arg = argv[index];
    if (arg === undefined) {
      index += 1;
      continue;
    }

    if (optionsEnded) {
      positionals.push(arg);
      index += 1;
      continue;
    }

    if (arg === "--") {
      optionsEnded = true;
      index += 1;
      continue;
    }
    if (arg === "-h" || arg === "--help") {
      result.help = true;
      index += 1;
      continue;
    }
    if (arg === "-V" || arg === "--version") {
      result.version = true;
      index += 1;
      continue;
    }

    if (arg === "-o" || arg === "--output") {
      result.output = takeValue(arg);
      index += 1;
      continue;
    }
    if (arg.startsWith("--output=")) {
      result.output = arg.slice("--output=".length);
      index += 1;
      continue;
    }
    if (arg.startsWith("-o") && arg.length > 2) {
      result.output = arg.slice(2);
      index += 1;
      continue;
    }

    if (arg === "--mode") {
      result.mode = parseMode(takeValue(arg), arg);
      index += 1;
      continue;
    }
    if (arg.startsWith("--mode=")) {
      result.mode = parseMode(arg.slice("--mode=".length), arg);
      index += 1;
      continue;
    }

    if (arg === "--leaf") {
      result.leaf = takeValue(arg);
      index += 1;
      continue;
    }
    if (arg.startsWith("--leaf=")) {
      result.leaf = arg.slice("--leaf=".length);
      index += 1;
      continue;
    }

    if (arg === "--no-thinking") {
      result.noThinking = true;
      index += 1;
      continue;
    }
    if (arg === "--include-bash") {
      result.includeBash = true;
      index += 1;
      continue;
    }
    if (arg === "--timestamps") {
      result.timestamps = true;
      index += 1;
      continue;
    }
    if (arg === "--no-group-turns") {
      result.groupTurns = false;
      index += 1;
      continue;
    }

    if (arg === "-c" || arg === "--cut") {
      result.cut = parseIntValue(takeValue(arg), arg);
      index += 1;
      continue;
    }
    if (arg.startsWith("--cut=")) {
      result.cut = parseIntValue(arg.slice("--cut=".length), arg);
      index += 1;
      continue;
    }
    if (arg.startsWith("-c") && arg.length > 2) {
      result.cut = parseIntValue(arg.slice(2), arg);
      index += 1;
      continue;
    }

    if (arg === "-t" || arg === "--time") {
      result.time.enabled = true;
      const next = argv[index + 1];
      if (next !== undefined && !next.startsWith("-")) {
        result.time.minutes = parseIntValue(next, arg);
        index += 1;
      }
      index += 1;
      continue;
    }
    if (arg.startsWith("--time=")) {
      result.time.enabled = true;
      result.time.minutes = parseIntValue(arg.slice("--time=".length), arg);
      index += 1;
      continue;
    }
    if (arg.startsWith("-t") && arg.length > 2) {
      result.time.enabled = true;
      result.time.minutes = parseIntValue(arg.slice(2), arg);
      index += 1;
      continue;
    }

    if (arg.startsWith("-") && arg !== "-") {
      throw new ArgumentError(`unknown option: ${arg}`);
    }
    positionals.push(arg);
    index += 1;
  }

  if (positionals.length > 1) {
    throw new ArgumentError(`unexpected extra argument: ${positionals[1]}`);
  }
  if (positionals.length === 1) result.input = positionals[0] ?? null;

  return result;
}
