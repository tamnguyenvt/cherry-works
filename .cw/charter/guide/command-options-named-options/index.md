---
kind: guide
id: command-options-named-options
description: Name the options a command takes OPTIONS, and nothing else.
globs: ["src/driver/cli/commands/**"]
---

The options a command takes are declared in one constant named `OPTIONS`,
in every command file. Never a name of its own — not `BUILDING`, `COUNTING`,
`LISTING`, `SPAN` or `SESSIONS_COMMAND_OPTIONS` — and no type alias for it:
the command reads its type as `typeof OPTIONS`.

```ts
const OPTIONS = {
  since: { type: "string", describe: "…" },
} as const satisfies OptionSpec;

export class SessionsCommand implements Command<typeof OPTIONS> {
  readonly options = OPTIONS;

  async run(context: Context, { since }: Options<typeof OPTIONS>): Promise<Outcome> { … }
}
```

**Why:** each command file holds one set of options, so the file already says
whose they are; a name invented per command says nothing more and makes every
file read differently.
