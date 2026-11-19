# Creating a vendor source

A vendor source is a git repository that publishes charters — rules,
workflows or skills — for other repositories to install with `cw vendor add`.
You author the source; each consuming repository installs a copy of a charter
under `.cw/charter/<charter>/` and builds it for its own coding agent.

Every primitive belongs to a charter its author names, kept at
`.cw/charter/<charter>/primitive/<kind>/<id>/`, its test cases under
`.cw/charter/<charter>/test/` and its eval cases under
`.cw/charter/<charter>/eval/`. A source publishes the charters it authored: the
ones holding no `cw-vendor.json`. A charter it installed itself is published
only where one of its own includes it. What a build writes is never
installed.

## 1. Create the source repository

Create a repository such as `your-org/charter-baseline` and clone it. In the
empty clone, run `cw vendor init` at a terminal: it asks the repository's name
and what its charters give, runs `cw init` (which asks your agent), marks the
repository a vendor's in `.cw/settings.json` (`"vendor": true`), and writes a
README with your answers, a `CHANGELOG.md` and a `.gitignore` leaving out what
`cw build` writes. Its build lays `/vendor-release` and the script it runs,
which cw brings itself. It makes no charter, and nothing is committed. The
folder must be empty, or a git repository with no commit yet.

```bash
git clone git@github.com:your-org/charter-baseline.git
cd charter-baseline
cw vendor init
```

Then write the charter it publishes, at the root:

```bash
cw kinds guide
cw add guide baseline-explain-failures --charter=baseline --header description="Explain failures and the next action." --header globs="src/**/*.ts"
cw edit baseline-explain-failures
```

Replace `your-org` with your organization. Consumers choose their own agents;
they install the authored charter, not the source repository's generated
agent files.

Write the first rule in
`.cw/charter/baseline/primitive/guide/baseline-explain-failures/index.md`:

```markdown
---
kind: guide
id: baseline-explain-failures
description: Explain failures and the next action.
globs: ["src/**/*.ts"]
---

When reporting a failed operation, state what failed and what the user can
change or retry. Never return only "Something went wrong" for a failure the
user can resolve.
```

Your published source has this shape:

```text
charter-baseline/
├── README.md
├── CHANGELOG.md
└── .cw/
    ├── settings.json
    └── charter/
        └── baseline/
            ├── primitive/
            │   └── guide/
            │       └── baseline-explain-failures/
            │           └── index.md
            └── test/
                └── baseline.json
```

Add skills, playbooks, templates or other primitives under their respective
kind folders. Run `cw kinds <kind>` to see the fields each kind accepts.
Supporting files belong beside their primitive's `index.md` and are installed
with it.

## 2. Make the source usable in another repository

The rules will run against a consumer's files and tools, so write them for
that environment:

- Use globs such as `src/**/*.ts` for files in the consuming repository.
- Document required tools and commands in your README, especially commands
  used by sensors or scripts.
- Choose ids that are unlikely to collide with a consumer's own rules or
  another vendor. An id is unique across every kind and charter; there is no
  override order. A prefix such as `baseline-` can distinguish your rules.
- A charter may name what another charter of the source holds, with `[[<id>]]`
  in bodies and bare ids in headers such as `rationale` and `mixins`: that
  other charter is installed with it. Document which primitives consumers must
  supply for anything else it names.
- Never hold or name `vendor-release` or `vendor-release-action`: cw brings
  them to a repository `cw vendor init` set up alone, so a charter naming one
  would not build where it is installed, and every build refuses it.
- Keep assets inside each primitive's folder. Files elsewhere in the source
  repository are not shipped as primitive assets.

`cw vendor add` installs a charter whole: its primitives, its test cases and
its eval cases. It does not install the source's `.cw/settings.json` or
generated agent files. The README should explain what each charter provides,
prerequisites, installation and upgrade instructions.

## 3. Test and publish a version

Create `.cw/charter/baseline/test/baseline.json`:

```json
{
  "description": "The baseline failure guide applies to TypeScript source.",
  "cases": [
    {
      "do": { "touchFile": "src/import.ts" },
      "expect": { "activate": "baseline-explain-failures" }
    }
  ]
}
```

Check the charters at the root, commit and push, then ask your agent
`/vendor-release` there: it checks the default branch of `origin`, clean and
level with it, builds the charters at the root, lists how to install each one
and its skills in the README, proposes the version and the changelog entry,
and once you confirm, commits, pushes and tags.

```bash
cw test --charter=baseline
cw build
cw doctor
git add .
git commit -m "Publish the baseline charter"
git push origin HEAD
```

Review what you stage before committing. `cw test` checks the charter's rules
without running the agent or sensor commands; with no `--charter`, it runs
every charter's cases. For evidence that an agent follows the instructions,
add [evaluations](reference.md#evaluating-against-the-real-agent). Evaluations
run the real agent and spend tokens.

## 4. Try it as a consumer

In a separate repository:

```bash
cw init
cw vendor add git@github.com:your-org/charter-baseline.git --charter=baseline --ref v0.1.0
cw vendor list
cw build
cw doctor
```

The installed rule is now at:

```text
.cw/charter/baseline/primitive/guide/baseline-explain-failures/index.md
```

beside `.cw/charter/baseline/cw-vendor.json`, which names the charter, the
source and the version installed, and makes the charter read-only.

Installation leaves files unstaged and does not build. Review and commit the
installed charter and the changes produced by `cw build` in the consuming
repository. Consumers do not need to copy the source's generated files.

Before publishing, you can also test a committed source from disk:

```bash
cw vendor add /absolute/path/your-org/charter-baseline --charter=baseline
```

Run that in a separate consumer repository. The local path must identify both
an owner folder and a repository folder. The source is fetched through Git,
so uncommitted source changes are not installed.

## 5. Publish updates

Edit the source primitives, rerun the checks, commit, push, and ask
`/vendor-release` again; it proposes the next version, such as `v0.2.0`.
Consumers opt into it by running:

```bash
cw vendor add git@github.com:your-org/charter-baseline.git --charter=baseline --ref v0.2.0
cw build
cw doctor
```

Installing the same charter from the same source again replaces it whole.
Consumers should review the diff and commit it. Document changes that require
them to edit configuration, supply a new tool or rename a referenced id.

Installed charters are read-only. If a consumer wants to start from your
content and maintain its own version, it can use:

```bash
cw vendor inject git@github.com:your-org/charter-baseline.git --charter=baseline --ref v0.1.0
```

Injection writes the charter, and the charters it includes, into the
consumer's `.cw/charter/` with no `cw-vendor.json`, leaves files unstaged and
does not build. Vendor commands no longer manage that copy. A charter name or
an id already held by the consumer refuses the injection before writing.

## Publish several charters in one repository

Write each charter consumers should be able to choose on its own under a name
of its own:

```text
.cw/charter/
├── baseline/
│   └── primitive/guide/baseline-explain-failures/index.md
└── reviews/
    └── primitive/skill/reviews-review-a-change/index.md
```

Keep ids unique across every charter: one id names one primitive in the whole
charter root. A charter's name must not be a primitive kind such as `guide` or
`skill`, nor `primitive`, `test`, `eval`, `vendor` or `root`.

Consumers take every charter, or pick some:

```bash
cw vendor add your-org/charters --ref v1.0.0
cw vendor add your-org/charters --charter=baseline --charter=reviews --ref v1.0.0
cw vendor add your-org/charters --charter=reviews --as=team-reviews --ref v1.0.0
```

Each lands under `.cw/charter/<charter>/`, or the name `--as` gives it, and
can be removed by that name, such as `cw vendor remove reviews`.

## What is installed

- With no `--charter`, every charter the source authored is installed.
- `--charter` takes only the charters named; repeat it to select several.
- A charter the source names that another charter includes comes with it, and
  so on for what that one includes.
- A charter the source itself installed is taken only where one installed
  includes it, copied as it stands; no other source is reached.

A charter named that the source does not author refuses the install, naming
the charters it does author.

See the [command reference](reference.md#commands) for the rest of the CLI.
