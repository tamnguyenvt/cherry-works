---
kind: guide
id: name-like-the-files-before-it
description: A file of a pattern the repository already has follows the files before it — their shape and their names — rather than inventing names of its own.
---

Before writing a file that does what other files here already do — a command,
a route, a migration, an adapter, a test — open two or three of them and
follow them: the same file name pattern, the same exported names, the same
constant and option names, the same order. A name that is the same job in
every file is the same word in every file.

For example, if every command declares its options in a constant named
`OPTIONS`, a new command does too — never `BUILDING`, `LISTING` or
`SESSIONS_COMMAND_OPTIONS`, and no type alias of its own:

```ts
const OPTIONS = {
  since: { type: "string", describe: "…" },
} as const satisfies OptionSpec;

export class SessionsCommand implements Command<typeof OPTIONS> {
  readonly options = OPTIONS;
}
```

Where the files before it disagree, follow the most recent ones and say so.
Rename the others only when asked.

**Why:** the file already says whose things they are; a name invented per file
says nothing more, and makes every file read differently, so a reader can no
longer move from one to the next by the same names.
