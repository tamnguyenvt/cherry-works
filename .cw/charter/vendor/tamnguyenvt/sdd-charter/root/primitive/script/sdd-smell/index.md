---
kind: script
id: sdd-smell
description: Keep the code smell record — take a read-only scan of what is left to assess, write a file's result; changes no other file.
executionPath: ./smell.mjs
---

The record /sdd-code-smell keeps, `code-smell.json` in the spec folder
`.sdd/settings.json` names (`"specFolder"`, `specs` when there is none). Node
20 or later, nothing else; run from the repository's root.

## Command order

1. Run `scan` to list files that need assessment and their hashes. It
   never creates or writes a record, folder or temporary file. Use
   `--again` only when the developer explicitly requests it.
2. Judge which files need assessment; explain any exclusions in the report
   without saving them. Read each remaining file against the coding rules
   and run `record` immediately. A good file needs no findings input; a file with problems supplies its findings
   on stdin. `record` saves the assessment, not the developer's approval.
3. Run `findings` to show waiting findings grouped by rule and file, then
   wait for the developer's review. With none waiting, stop; do not plan.
4. Run `findings <id> skip [reason]` for each finding the developer chooses not to fix. Run `findings`
   again; with none waiting, stop without planning.
5. Once the developer agrees to plan the remaining findings, follow
   [[sdd-plan]]: one story per rule gathering its files, splitting a rule
   too large for one reviewable change. Each story must preserve the
   product's existing behavior. Follow that walk's approval gates.
6. Only after the developer accepts the planned stories, run `findings <id> agree [reason]` for
   the findings those stories cover. Until then, they remain waiting.
   `findings <id> agree` marks accepted planning; it does not fix the code.
7. Run `findings` again to confirm what remains. Fixing the code happens
   later, when the planned stories are implemented.

On the next run, start with `scan` again. Unchanged files need no new
assessment; skipped and agreed marks stay, including on an explicit repeat scan
when `record` receives the same hash, rule and line. Changed files need a
fresh assessment and review.

## Commands

```bash
node .cw/out/script/sdd-smell/smell.mjs scan                 # "<hash>  <path>" of each file to assess
node .cw/out/script/sdd-smell/smell.mjs scan --again        # ignore the old record; list every assessable file
node .cw/out/script/sdd-smell/smell.mjs record '<path>' <hash>   # write the result of a good file
node .cw/out/script/sdd-smell/smell.mjs record '<path>' <hash> - <<'FINDINGS'   # and of one with findings
[{ "rule": "<rule id>", "line": 3, "says": "<what is wrong>" }]
FINDINGS
node .cw/out/script/sdd-smell/smell.mjs findings                # waiting findings grouped by rule and file
node .cw/out/script/sdd-smell/smell.mjs findings '<id>' skip ['<reason>']    # skip exactly one finding after the developer chooses
node .cw/out/script/sdd-smell/smell.mjs findings '<id>' agree ['<reason>']  # only after the planned stories are accepted
```

## Example with concrete arguments

Suppose the repository has `src/limits.mjs` and `src/flags.mjs`. The rule ids
below are examples; use the rules of your charter and the actual lines you
assessed. Run each step when its review or planning gate has been met.

```bash
# List files needing assessment; this command saves nothing.
node .cw/out/script/sdd-smell/smell.mjs scan
```

Example output:

```text
db1242f0e836edaa9533cb367264cc3624520f3576b72d407ed0d1677545c26a  src/flags.mjs
045558e61e6ecd802fe4f807947f7673c42a60b1339ae8ffb70fee7d7f83988b  src/limits.mjs
```

Copy the hash printed for each file. These variables hold the example
hashes above; replace them with your actual scan output. Read and assess a
file before recording its result; `record` does not assess code for you.

```bash
# After assessing src/limits.mjs, save its two findings.
smell_limits_hash='045558e61e6ecd802fe4f807947f7673c42a60b1339ae8ffb70fee7d7f83988b'
node .cw/out/script/sdd-smell/smell.mjs record 'src/limits.mjs' "$smell_limits_hash" - <<'FINDINGS'
[
  { "rule": "no-magic-number", "line": 1, "says": "42 has no name" },
  { "rule": "named-limits", "line": 1, "says": "The limit needs a domain-specific name" }
]
FINDINGS

# After assessing src/flags.mjs and finding no issue, save a good result.
smell_flags_hash='db1242f0e836edaa9533cb367264cc3624520f3576b72d407ed0d1677545c26a'
node .cw/out/script/sdd-smell/smell.mjs record 'src/flags.mjs' "$smell_flags_hash"

# Show findings for the developer's review.
node .cw/out/script/sdd-smell/smell.mjs findings

# Copy the no-magic-number finding's id from the findings output.
# This id matches the sample path, hash, rule and line above.
# Only if the developer chooses to skip that finding:
smell_finding_id='a5c6288aa9990ebceb693f0b393d2bec7778e305c7b41af7b97e23b739aed5f6'
node .cw/out/script/sdd-smell/smell.mjs findings "$smell_finding_id" skip 'Accepted trade-off; keep the existing value'
node .cw/out/script/sdd-smell/smell.mjs findings
```

At this point the `named-limits` finding is still waiting. Follow
[[sdd-plan]] for the remaining finding only after the developer agrees to
planning. Once the developer accepts the resulting story:

```bash
# Mark the finding covered by the accepted story; this does not fix code.
smell_agreed_id='7bbd750b44d67cd3cc3686a6c946b61eaf0207b0a2f6491cb3370c2ffcf416bf'
node .cw/out/script/sdd-smell/smell.mjs findings "$smell_agreed_id" agree 'Story accepted; preserve existing behavior'
node .cw/out/script/sdd-smell/smell.mjs findings
```

The final report is:

```text
0 waiting, 1 skipped, 1 agreed
No finding left to agree.
```

Both actions select exactly one finding by id. Repeat agreement without a
reason to keep an existing agreement reason:

```bash
node .cw/out/script/sdd-smell/smell.mjs findings "$smell_agreed_id" agree
```

On a later run, list new or changed files normally. Only when the developer
explicitly asks to assess everything again, use `--again`:

```bash
node .cw/out/script/sdd-smell/smell.mjs scan
node .cw/out/script/sdd-smell/smell.mjs scan --again
```

**scan** prints only the file list with hashes on stdout; successful runs
print nothing on stderr. It lists what git tracks or would add; what git ignores is not in it. It excludes the record itself, a link
or a submodule, and a name that is not UTF-8 or holds a line break. It omits
an assessment whose hash matches. With `--again`, it does not read the old
record at all, even if unreadable, and lists every assessable file. It only
reads: running it again, even after files change or disappear, never creates
or rewrites the record. Exclusions are not saved; files the agent chose not
to assess return on every scan. Entries for files that are gone are
removed on the next explicit write (`record` or `findings <id> skip|agree [reason]`).
**record** takes the hash the scan printed. Findings come on stdin, never on the command line: they quote text
from the file assessed, which a shell must not read. A path is
repository text too: it goes in single quotes, a `'` in it written `'\''`.
Each write replaces the record whole. The spec folder must lie inside the
repository.

```json
{
  "files": {
    "src/a.mjs": { "hash": "<sha-256>", "assessed": "yyyy-mm-dd", "good": false,
      "findings": [{ "id": "<finding id>", "rule": "<rule id>", "line": 3, "says": "<what is wrong>" }] }
  }
}
```

Exit 0, or 2 on a request that cannot be met or a record that cannot be read,
the record left as it was.

Its tests, beside it:

```bash
node --test .cw/out/script/sdd-smell/smell.test.mjs
```

**findings** without arguments reads without writing: waiting findings grouped
by rule, each printed as `[id] path:line: description`, then counts waiting,
skipped and agreed. With none waiting it prints `No finding left to agree.`.
`record` automatically assigns each finding an id; no id is needed on stdin.
Ids are unique across files and repeated findings at the same location, and
stable for the same path, assessed hash, rule, line and occurrence. Records
written before ids existed get ids when read, without changing the file;
the next explicit write saves them.

**findings <id> skip|agree [reason]** marks exactly one finding skipped or
agreed. Copy its id from `findings`. The optional reason is one quoted
argument, saved verbatim as `"reason"` on that finding. Repeating the same
action without a reason keeps its existing reason, or leaves it absent;
supplying a reason replaces it. Changing the status clears a previous reason
unless a new reason is supplied. Agreement refuses a skipped finding, so a
skipped decision cannot be overwritten by agreement.

An unknown id, invalid action or changed source file is refused without
writing. There are no standalone `skip` or `agree` commands. Mark a finding
agreed only after the developer accepts the story covering it. A marked
finding carries `"status": "skipped"` or `"status": "agreed"`; waiting ones
have no status. Unchanged assessments preserve status and reason; changed
content clears both.
**record** preserves these marks for the same rule and line only while the
assessed hash is unchanged, including a repeat scan. Input cannot supply review
marks. Mark findings agreed only after the developer accepts their planned
stories; skipped findings go into no story.

Only assessed files are saved. Legacy records with `leftOut` can still be
read, but those exclusions are ignored and removed on the next explicit
write. There is no `leave` command.

For example, a finding skipped with a reason contains:

```json
{ "id": "<finding id>", "rule": "no-magic-number", "line": 1,
  "says": "42 has no name", "status": "skipped",
  "reason": "Accepted trade-off; keep the existing value" }
```
