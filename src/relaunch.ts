import { spawn } from "node:child_process";

import { RELAUNCH_TERMINALS } from "./constants.ts";
import { findExecutable } from "./output.ts";

export type RelaunchResult = "tty" | "relaunched" | "no-terminal";

/**
 * When the picker is launched without a TTY (for example from a hotkey), try to
 * reopen it inside a terminal window so the numbered prompt is visible.
 */
export function maybeRelaunchInTerminal(argv: string[]): RelaunchResult {
  if (process.stdin.isTTY && process.stdout.isTTY) return "tty";
  if (process.env.PI_TO_MD_RELAUNCHED === "1") return "tty";

  const script = process.argv[1];
  if (script === undefined) return "no-terminal";

  for (const terminal of RELAUNCH_TERMINALS) {
    const binary = findExecutable(terminal);
    if (binary === null) continue;

    const args =
      terminal === "gnome-terminal"
        ? ["--", process.execPath, script, ...argv]
        : ["-e", process.execPath, script, ...argv];

    const child = spawn(binary, args, {
      detached: true,
      stdio: "ignore",
      env: { ...process.env, PI_TO_MD_RELAUNCHED: "1" },
    });
    child.unref();
    return "relaunched";
  }

  return "no-terminal";
}
