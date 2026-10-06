import { homedir } from "node:os";
import { join } from "node:path";

/** Root directory holding all Pi session project folders. */
export const DEFAULT_SESSIONS_DIR = join(homedir(), ".pi", "agent", "sessions");

/** Default number of project directories to list (0 = no limit). */
export const DEFAULT_DIR_LIMIT = 5;

/** Default number of session files to list (0 = no limit). */
export const DEFAULT_SESSION_LIMIT = 5;

/** Default preview length in characters (0 = disabled). */
export const DEFAULT_SNIPPET_LENGTH = 60;

/** Default minutes used by `-t` / `--time`. */
export const DEFAULT_CRON_MINUTES = 10;

/** Terminal emulators tried when the picker is launched without a TTY. */
export const RELAUNCH_TERMINALS = [
  "gnome-terminal",
  "x-terminal-emulator",
  "xfce4-terminal",
  "mate-terminal",
  "konsole",
  "kitty",
  "alacritty",
  "xterm",
] as const;
