# How to write evaluation cases

Write JSON suites under `.cw/eval/`. Each suite has a nonempty `cases` array
and may include a `description`. Each case has a nonempty `prompt` and an
`expect` object with at least one expectation.

```json
{
  "description": "Plain requests reach the intended workflows.",
  "cases": [
    {
      "prompt": "implement the next story",
      "expect": { "invoke": "sdd-implement" }
    },
    {
      "prompt": "verify changes on this branch",
      "expect": { "read": ".cw/out/skill/sdd-verify/index.md" }
    }
  ]
}
```

## Choose what the case proves

| Expectation | Passes when |
|---|---|
| `invoke: <id>` | promptfoo records the named skill or playbook being invoked |
| `read: <path>` | tool evidence shows a successful read of the exact repository-relative file |
| `follow: <id>` | a model judge finds the agent followed the named guide |
| `maxTokens: <n>` | reported token usage is at most the positive integer supplied |

Expectations can be combined; every expectation must pass. `invoke` must
name a skill or playbook in the charter, and `follow` must name a guide.
Only add `maxTokens` when a token budget is part of what you intend to test.

## Use `read` for internal workflows in Codex

A skill with `disable-user-invocation: true` is exposed to Codex through
`AGENTS.md`, pointing to `.cw/out/skill/<id>/index.md`. The build does not
create a public `.agents/skills/<id>/SKILL.md` entry for it.

`expect.invoke` becomes promptfoo's `skill-used` assertion. Its Codex provider
recognizes skill usage from successful commands referencing a discovered
`SKILL.md` path. Reading an internal `index.md` does not produce that skill
metadata, so the assertion can fail even though the agent loaded the workflow:

```text
Missing required skill(s): sdd-verify. Actual skills: (none)
```

For a case whose purpose is to prove that those instructions were loaded,
use `read` instead:

```json
{
  "prompt": "verify changes on this branch",
  "expect": {
    "read": ".cw/out/skill/sdd-verify/index.md"
  }
}
```

Public skills keep `invoke`. Claude's invocation evidence differs from
Codex's; choose the expectation for the provider and behavior being tested.

`read` is a cw expectation implemented with a custom promptfoo JavaScript
assertion. It accepts a nonempty repository-relative path without empty,
`.` or `..` segments, backslashes, control characters or template braces.
Currently supported tool evidence is:

- A completed Codex `cat` command with exit code zero, including supported
  literal shell wrappers and commands reading multiple files.
- A successful Claude `Read` call with a returned result.

Compound commands, other readers, and missing or unsupported trace formats
fail with an explanation. Merely mentioning the file in the answer does not
count as reading it.

## Keep loading separate from completion

A passing `read` expectation proves that the agent loaded the instructions.
It does not prove that it completed the workflow or that its checks passed.
A workflow can stop at a gate or encounter a sandbox permission error after
loading the file and still pass that expectation.

Likewise, an invocation expectation does not prove successful completion.
Use separate behavioral evidence for outcomes beyond activation, and inspect
the agent trace when diagnosing a failure.

## Run and inspect

Commit the suites and charter before running: `cw eval` evaluates the last
commit, rebuilding the charter in an isolated worktree for each case. It
uses the selected provider's sign-in or configured API key and spends tokens.

```bash
cw eval --agent codex
cw eval --agent claude
```

Each case prints a retained `case.json` path. The same folder holds the
promptfoo configuration, raw `output.json` when produced, and stdout/stderr.
The case manifest includes the agent session ID and an existing local session
log path when available.

```bash
cw eval-analyze --log /path/to/run-xxx/case.json
cw eval-analyze --log /path/to/run-xxx/case.json --json
cw eval-analyze
```

Analysis runs offline. Without `--log`, it shows the latest twenty saved case
logs for the current repository. Logs live under
`~/.cherry-works/promptfoo/<version>/run-*/`; old runs whose artifacts were
not retained cannot be reconstructed.

See [the command reference](reference.md#evaluating-against-the-real-agent)
for provider selection and log retention details.
