import { spawnSync } from "node:child_process";

import { anchorToCwd, findExecutable } from "./output.ts";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Quote a string for `/bin/sh`, escaping embedded single quotes. */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

/**
 * Install a one-shot cron entry that deletes `outputPath` after `minutes` and
 * then removes its own crontab line. Best-effort: warns instead of failing.
 */
export function scheduleDelete(outputPath: string, minutes: number): void {
  const path = anchorToCwd(outputPath);

  if (findExecutable("crontab") === null) {
    process.stderr.write(
      `pi-to-md: warning: crontab not found; '${path}' will not be auto-deleted\n`,
    );
    return;
  }

  const target = new Date(Date.now() + minutes * 60_000);
  const minute = pad(target.getMinutes());
  const hour = pad(target.getHours());
  const dayOfMonth = pad(target.getDate());
  const month = pad(target.getMonth() + 1);

  const tag = `pi-to-md-expire-${process.pid}-${Math.floor(Date.now() / 1000)}`;
  const quotedPath = shellQuote(path);
  const command =
    `rm -f -- ${quotedPath}; t=$(mktemp) && crontab -l >"$t" 2>/dev/null && ` +
    `grep -vF '${tag}' "$t" | crontab -; rm -f "$t"`;
  const line = `${minute} ${hour} ${dayOfMonth} ${month} * ${command} # ${tag}`;

  const existing = spawnSync("crontab", ["-l"], { encoding: "utf-8" });
  const current = existing.status === 0 ? (existing.stdout ?? "") : "";
  const payload = current.endsWith("\n") || current === "" ? `${current}${line}\n` : `${current}\n${line}\n`;

  const install = spawnSync("crontab", ["-"], { input: payload, encoding: "utf-8" });
  if (install.status !== 0) {
    process.stderr.write(
      `pi-to-md: warning: could not install cron entry; '${path}' will not be auto-deleted\n`,
    );
    return;
  }

  process.stdout.write(
    `Auto-delete: ${path} in ${minutes}m (cron ${minute} ${hour} ${dayOfMonth}/${month})\n`,
  );
}
