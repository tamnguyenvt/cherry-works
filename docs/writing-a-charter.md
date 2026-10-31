# Writing a charter

A charter tells a coding agent how your team works: which rules apply to a
file, how to carry out a request, and which checks the host runs automatically.
Write the sources under `.cw/charter/`, then run `cw build` to generate what the
agent reads. This guide walks through a first rule and a reusable workflow.

## Start with one rule

Inside the git repository you want to govern:

```bash
cw init
cw kinds guide
cw add guide explain-failures --header description="Explain failures and the next action." --header globs="src/**/*.ts"
cw edit explain-failures
```

`cw init` asks which agent to compile for and builds the initial charter. If
the repository is already initialized, start with `cw kinds guide`.
`cw add` writes the primitive; it does not build it. `cw edit` opens the source
in `$VISUAL` or `$EDITOR`.

The guide lives at `.cw/charter/guide/explain-failures/index.md`. Give it a body
that says exactly what the agent should do:

```markdown
---
kind: guide
id: explain-failures
description: Explain failures and the next action.
globs: ["src/**/*.ts"]
---

When reporting a failed operation, state what failed and what the user can
change or retry. Never return only "Something went wrong" for a failure the
user can resolve.

For example: "The import contains no email column. Add an email column and
upload the file again."
```

Then check and compile it:

```bash
cw build --preview
cw build
cw doctor
```

Review and commit the source together with the generated changes. Edit the
source again whenever the rule changes, and rebuild. Generated files such as
`.cw/out/`, `CLAUDE.md`, `AGENTS.md` and host settings are build outputs; keep
your charter instructions in `.cw/charter/`.

## Choose the kind by its job

A primitive is one folder holding `index.md` and any supporting files. Pick
its kind before writing the body:

| You need | Kind | How it is used |
|---|---|---|
| A standard for files or for every turn | `guide` | File globs select it; omitting globs makes it apply every turn |
| Instructions for carrying out a request | `skill` | Its triggers match the request, or the user invokes it |
| A workflow made of several skills | `playbook` | The agent follows its sequence when requested |
| A command run automatically on an event | `sensor` | The host fires its signal and runs its command |
| Permissions for files or commands | `posture` | Compiled into the host's supported permission controls |
| A delegated role | `agent` | Spawned by its id |
| Reasoning behind a rule | `corpus` | Read when a primitive cites it as its rationale |
| Instructions or headers shared by several primitives | `mixin` | Included by the primitives that name it |
| An external MCP server | `mcp` | Reached through `cw mcp serve` when referenced |
| Executable files shipped with the charter | `script` | Referenced by another primitive or run by a sensor |
| A document to fill in or copy | `template` | Read when another primitive references it |

Run `cw kinds <kind>` for the fields and example of the kind you chose. Use
that contract rather than borrowing headers from a host's native skill format.

## Name and scope each primitive

Every primitive declares `kind`, `id` and `description` in YAML front matter.
Its path follows `.cw/charter/<kind>/<id>/index.md`.

- Choose an id that describes one rule or workflow, such as `explain-failures`.
  Use lowercase letters, digits and inner hyphens; `/` can group segments, as
  in `review/security`. The whole id is at most 40 characters.
- An id is unique across every kind and layer, including vendors and built-ins.
  A second primitive with the same id is a collision, not an override.
- Write a description that tells the agent when the primitive is relevant.
- For a guide about a subset of files, set `globs`. Leave them out only when
  the instruction should apply on every turn.
- Keep supporting files beside `index.md` and link to them as `./example.md`.
  They are copied beside the compiled primitive.

Write the body as instructions someone can check: the trigger, the required
behavior, and an example where ambiguity remains. State exceptions explicitly.
Keep reasoning in a corpus when several rules share it, and keep commands in a
sensor when they must run automatically. A prose instruction alone does not
install a hook or grant a permission.

## Add a workflow

Create a skill for a request that needs several steps:

```bash
cw kinds skill
cw add skill review-a-change --header description="Review a change for correctness and security." --header triggers="review this change" --header triggers="review implementation"
cw edit review-a-change
```

For example, `.cw/charter/skill/review-a-change/index.md` can hold:

```markdown
---
kind: skill
id: review-a-change
description: Review a change for correctness and security.
triggers: ["review this change", "review implementation"]
---

1. Read the changed files and the behavior the change must provide.
2. Check each changed path for incorrect behavior, missing validation and
   exposed secrets.
3. Report each finding with its file, location, consequence and concrete fix.
4. State whether the review passed. Never claim tests passed unless you ran
   them and read their results.
```

A playbook sequences skills by referring to their ids in its body. Use a
playbook when those steps are already useful skills of their own.

A skill or playbook used only as a step can declare
`disable-user-invocation: true`. One that must be started explicitly by the user
can declare `disable-model-invocation: true`. Do not set both to true. See the
[host mappings](reference.md#charter--agent-outputs) for how each agent supports
these controls.

## Reuse instructions and explain why

Reference another primitive by id, not by its source path:

```yaml
rationale: useful-failure-messages
mixins: [review-reporting]
```

Here, `useful-failure-messages` must be a corpus and `review-reporting` a mixin
that your charter holds. A mixin lends its headers and body to its hosts; it
cannot pull in another mixin. In a markdown body, write `[[review-a-change]]`
to reference that skill. The build resolves these references and reports names
that do not exist.

Use `cw explain <id>` to see where a primitive comes from, what it pulls in,
and which tests name it.

## Start from a published charter or skill

To copy a published skill into your own editable charter:

```bash
cw vendor inject mattpocock/skills --skill=grill-me
```

To copy a charter selected from a source's `charters/` folder:

```bash
cw vendor inject acme/charters --charter=baseline --ref=v1.2.0
```

The source and ref must exist. Injection uses the same source selection as
`cw vendor add`, but writes primitives and their assets into `.cw/charter/`.
They are yours to edit and delete, with no vendor provenance recorded.
Injection leaves the files unstaged and does not build. An id collision
refuses the whole injection before anything is written.

Use `cw vendor add` instead when you want a read-only vendor copy that you
update from its source. See [vendor sources](reference.md#vendor-sources).

## Test the scope, then inspect the output

Add a file such as `.cw/test/authoring.json` to pin down when your guide is
selected:

```json
{
  "description": "Failure reporting applies to TypeScript source files.",
  "cases": [
    {
      "do": { "touchFile": "src/import.ts" },
      "expect": { "activate": "explain-failures" }
    }
  ]
}
```

Run the checks after editing:

```bash
cw test
cw build
cw doctor
cw context
```

`cw test` checks the charter's activation and permission rules without running
an agent or the sensor commands. It does not prove that an agent obeys the
body. For that, use [evaluations](reference.md#evaluating-against-the-real-agent)
with a few representative requests; they run the real agent and spend tokens.

Open `.cw/out/guide/explain-failures/index.md` to read the compiled guide,
including any mixins and assets. Review the generated host changes too.
`cw context` helps you spot instructions that make every session unnecessarily
large.

To remove a rule you authored, run `cw remove <id>`, then rebuild, run your
tests and review the diff. Update or remove any primitive or test that still
references the deleted id.
