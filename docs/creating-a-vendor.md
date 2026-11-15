# Creating a vendor source

A vendor source is a git repository that publishes rules, workflows or skills
for other repositories to install with `cw vendor add`. You author the source;
each consuming repository installs a copy under `.cw/charter/vendor/` and builds it
for its own coding agent.

A source publishes charters under `charters/<name>/`, skills under `skills/`,
or both. What it keeps at its root, a `.cw/` of its own among it, is its
authors' and is never installed.

## 1. Create the source repository

Create a repository such as `your-org/charter-baseline` and clone it. In the
empty clone, run `cw vendor init` at a terminal: it asks the repository's name
and what its charters give, runs `cw init` (which asks your agent), and writes
a README with your answers, a `CHANGELOG.md`, a `.gitignore` leaving out what
`cw build` writes, an empty `charters/`, and, in the root's own charter, the
`/vendor-release` skill with the script it runs. Nothing is committed. The
folder must be empty, or a git repository with no commit yet.

```bash
git clone git@github.com:your-org/charter-baseline.git
cd charter-baseline
cw vendor init
```

Then initialize the charter it publishes in its own folder under `charters/`:

```bash
mkdir -p charters/baseline
cd charters/baseline
cw init
cw kinds guide
cw add guide baseline-explain-failures --header description="Explain failures and the next action." --header globs="src/**/*.ts"
cw edit baseline-explain-failures
```

Replace `your-org` with your organization. `cw init` asks which agent to build
for in the charter's folder. Consumers choose their own agents; they install
the authored charter, not the source repository's generated agent files.

Write the first rule in
`charters/baseline/.cw/charter/primitive/guide/baseline-explain-failures/index.md`:

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
└── charters/
    └── baseline/
        ├── README.md
        └── .cw/
            └── charter/
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

The repository's root may hold a charter of its own, set up with `cw init`
there, for the agent of whoever authors the source: a release skill, say. It
is never installed, whatever consumers pass.

## 2. Make the source usable in another repository

The rules will run against a consumer's files and tools, so write them for
that environment:

- Use globs such as `src/**/*.ts` for files in the consuming repository.
- Document required tools and commands in your README, especially commands
  used by sensors or scripts.
- Choose ids that are unlikely to collide with a consumer's own rules or
  another vendor. An id is unique across every kind and layer; there is no
  override order. A prefix such as `baseline-` can distinguish your rules.
- Keep referenced primitives in the charter you publish, or document which
  additional primitives consumers must supply. Use `[[<id>]]` in bodies and
  bare ids in headers such as `rationale` and `mixins`.
- Keep assets inside each primitive's folder. Files elsewhere in the source
  repository are not shipped as primitive assets.
- Publish no nested vendor dependencies. A charter holding files under
  `.cw/charter/vendor/` is refused: vendoring is one level deep.

`cw vendor add` installs each charter's `.cw/charter/primitive/` and the
`README.md` of its folder. It does not install the charter's
`.cw/settings.json`, tests, evaluations or generated agent files. The README
should explain what the charter provides, prerequisites, installation and
upgrade instructions.

## 3. Test and publish a version

Create `charters/baseline/.cw/charter/test/baseline.json`:

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

Check the charter from its folder, then publish a version from the
repository's root. With `cw vendor init`'s repository, ask your agent
`/vendor-release` there instead: it checks the default branch of `origin`,
builds each charter, lists how to install each one and its skills in the
README, proposes the version and the changelog entry, and once you confirm,
commits, pushes and tags. By hand:

```bash
cd charters/baseline
cw test
cw build
cw doctor
cd ../..
git add .
git commit -m "Publish the baseline charter"
git tag v1.0.0
git push origin HEAD
git push origin v1.0.0
```

Review what you stage before committing. `cw test` checks the charter's rules
without running the agent or sensor commands. For evidence that an agent follows
the instructions, add [evaluations](reference.md#evaluating-against-the-real-agent).
Evaluations run the real agent and spend tokens.

## 4. Try it as a consumer

In a separate repository:

```bash
cw init
cw vendor add git@github.com:your-org/charter-baseline.git --ref v1.0.0
cw vendor list
cw build
cw doctor
```

The installed rule is now at:

```text
.cw/charter/vendor/your-org/charter-baseline/baseline/primitive/guide/baseline-explain-failures/index.md
```

Installation leaves files unstaged and does not build. Review and commit the
vendor files and the changes produced by `cw build` in the consuming repository.
Consumers do not need to copy the source's generated files.

Before publishing, you can also test a committed source from disk:

```bash
cw vendor add /absolute/path/your-org/charter-baseline --ref v1.0.0
```

Run that in a separate consumer repository. The local path must identify both
an owner folder and a repository folder. The source is fetched through Git,
so uncommitted source changes are not installed.

## 5. Publish updates

Edit the source primitives, rerun the checks, commit and publish a new tag,
such as `v1.1.0`. Consumers opt into it by running:

```bash
cw vendor add git@github.com:your-org/charter-baseline.git --ref v1.1.0
cw build
cw doctor
```

Installing the same source again updates its vendor copy. Consumers should
review the diff and commit it. Document changes that require them to edit
configuration, supply a new tool or rename a referenced id.

Vendored primitives are read-only. If a consumer wants to start from your
content and maintain its own version, it can use:

```bash
cw vendor inject git@github.com:your-org/charter-baseline.git --ref v1.0.0
```

Injection writes into the consumer's `.cw/charter/` with no source provenance,
leaves files unstaged and does not build. Vendor commands no longer manage that
copy. An id already held by the consumer refuses the injection before writing;
use this in place of installing the same primitives as a vendor.

## Publish several charters in one repository

Add a folder under `charters/` for each charter consumers should be able to
choose on its own:

```text
charters/
├── baseline/
│   ├── README.md
│   └── .cw/charter/primitive/guide/baseline-explain-failures/index.md
└── reviews/
    ├── README.md
    └── .cw/charter/primitive/skill/reviews-review-a-change/index.md
```

Initialize and test each charter from its own folder. Keep ids unique across
charters consumers will install together. A charter folder name must not be a
primitive kind such as `guide` or `skill`, nor `root`, the folder a source's
skills are installed in. Each charter must hold its own
`.cw/charter/primitive/` and no vendored files.

Consumers take every charter, or pick some:

```bash
cw vendor add your-org/charters --ref v1.0.0
cw vendor add your-org/charters --charter baseline --charter reviews --ref v1.0.0
```

Each lands under `.cw/charter/vendor/your-org/charters/<name>/`, with that charter's
README when present. It can be removed by that full installed name, such as
`cw vendor remove your-org/charters/reviews`.

## What is installed

A source is a vendor when it holds `charters/`, `skills/` or both; one holding
neither is refused as no vendor. Its root `.cw/` is never read.

- With neither `--charter` nor `--skill`, every charter under `charters/` and
  every skill under `skills/` is installed.
- `--charter` takes only the charters named, and `--skill` only the skills
  named. Repeat either flag to select several entries, or combine both flags
  to take charters and skills together.

A requested entry or layout that does not exist refuses the install.

See the [command reference](reference.md#commands) for the rest of the CLI.
