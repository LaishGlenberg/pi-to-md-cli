# pi-to-md-cli

[![npm version](https://img.shields.io/npm/v/@lglen/pi-to-md-cli.svg?logo=npm)](https://www.npmjs.com/package/@lglen/pi-to-md-cli)
[![Downloads](https://img.shields.io/npm/dm/@lglen/pi-to-md-cli.svg?logo=npm)](https://www.npmjs.com/package/@lglen/pi-to-md-cli)
[![Build Status](https://github.com/LaishGlenberg/pi-to-md-cli/workflows/CI/badge.svg)](https://github.com/LaishGlenberg/pi-to-md-cli/actions)

Convert [`pi-coding-agent`](https://github.com/badlogic/pi-mono) session JSONL files into **conversation-first Markdown**, with an interactive picker for choosing a session.

Given a session file (`*.jsonl`), it produces readable transcripts (USER + ASSISTANT + optional THINKING) suitable for GitHub/GitLab discussions, teammate handoff, or archiving.

## Requirements

- Node.js **22.18+**

## Install

```bash
npm install -g @lglen/pi-to-md-cli
```

Or run from source:

```bash
npm install
npm run build
node dist/index.js --help
```

## Usage

### Convert a file directly

```bash
pi-to-md ~/.pi/agent/sessions/abc/session.jsonl -o session.md
pi-to-md session.jsonl -o -            # stream to stdout
```

When no `-o` is given in direct mode, Markdown is written to stdout.

### Pick a session interactively

Run without an input path to list your session projects (newest first), then the sessions within the chosen project:

```bash
pi-to-md
```

The picker writes `<project>_<timestamp>_<short-id>.md` into the current directory (override with `PI_MD_OUTDIR` or `-o`).

## Options

| Option | Description |
| --- | --- |
| `-o, --output PATH` | Output path. `-` streams to stdout. |
| `--mode all\|branch` | Export the full session or one `parentId` chain (default: `all`). |
| `--leaf ID` | Leaf id used by branch mode (default: last message id). |
| `--no-thinking` | Omit assistant thinking blocks. |
| `--include-bash` | Include `bashExecution` messages as `SYSTEM` blocks. |
| `--timestamps` | Include timestamps in the output. |
| `--no-group-turns` | Do not merge consecutive messages by role. |
| `-c, --cut N` | Only include the last N conversation messages. |
| `-t, --time [MINUTES]` | Picker mode only: auto-delete the written file after N minutes via cron. |
| `-h, --help` | Show help. |
| `-V, --version` | Show the version. |

## Environment

| Variable | Default | Description |
| --- | --- | --- |
| `PI_SESSIONS_DIR` | `~/.pi/agent/sessions` | Session root directory. |
| `PI_DIR_LIMIT` | `5` | Project directories listed (`0` = all). |
| `PI_SESSION_LIMIT` | `5` | Sessions listed (`0` = all). |
| `PI_MD_OUTDIR` | current directory | Where picker-generated files land. |
| `PI_MD_SNIPPET` | `60` | Preview length in characters (`0` disables). |
| `PI_MD_STDOUT` | `0` | Set to `1` to stream instead of writing a file. |
| `PI_MD_OPEN` | `1` | Set to `0` to skip opening the file in an editor. |
| `PI_MD_OPENER` | `code` | Editor command used to open the file. |
| `PI_MD_CRON_MINUTES` | `10` | Default minutes for `-t` / `--time`. |

## Branch mode

`--mode branch` reconstructs a single chain by following `parentId` from the selected leaf back to the root. It is a best-effort approximation and can differ from what the UI shows in some edge cases.

## License

MIT (see [LICENSE](./LICENSE)).
