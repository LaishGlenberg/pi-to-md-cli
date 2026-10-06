export const HELP_TEXT = `pi-to-md - convert a pi-coding-agent session JSONL to Markdown

Usage:
  pi-to-md [session.jsonl] [options]   convert a file directly
  pi-to-md [options]                   pick a session interactively
  pi-to-md --time [MINUTES]            auto-delete the written file via cron

Options:
  -o, --output PATH     output path ("-" for stdout; direct mode defaults to stdout)
  --mode all|branch     export the full session or one parentId chain (default: all)
  --leaf ID             leaf id for branch mode (default: last message id)
  --no-thinking         omit assistant thinking blocks
  --include-bash        include bashExecution entries as SYSTEM blocks
  --timestamps          include timestamps in the output
  --no-group-turns      do not merge consecutive messages by role
  -c, --cut N           only include the last N conversation messages
  -t, --time [MINUTES]  picker mode only: delete the written file after N minutes
  -h, --help            show this help
  -V, --version         show the version

Environment:
  PI_SESSIONS_DIR       session root (default: ~/.pi/agent/sessions)
  PI_DIR_LIMIT          project dirs listed (default: 5, 0 = all)
  PI_SESSION_LIMIT      sessions listed (default: 5, 0 = all)
  PI_MD_OUTDIR          where a picker-generated .md lands (default: cwd)
  PI_MD_SNIPPET         preview length in chars (default: 60, 0 disables)
  PI_MD_STDOUT=1        stream Markdown to stdout instead of a file (picker mode)
  PI_MD_OPEN            auto-open the .md when done (default: 1, 0 = no)
  PI_MD_OPENER          editor command used to open it (default: code)
  PI_MD_CRON_MINUTES    default minutes for -t/--time (default: 10)
`;

export const VERSION = "0.1.0";
