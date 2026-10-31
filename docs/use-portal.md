# Using the portal

The portal lets you manage a repository's charter in your browser: write
primitives, inspect vendors, run charter tests and preview a build. Changes
are saved to the same files the CLI uses.

## Open the portal

From the repository you want to manage:

```bash
cw portal
```

If the repository has no charter yet, run `cw init` first.

Open the full address printed in the terminal, including `?t=…`, for example
`http://127.0.0.1:9927/?t=…`. Keep the terminal running while you use the portal.
The default port is 9927; if it is busy, the server tries the next free port.
To choose a starting port:

```bash
cw portal --port 8080
```

The portal serves only on your machine at `127.0.0.1`. The token in the
printed URL authorizes access; use that URL when opening another browser tab.
Press **Ctrl+C** in the terminal to stop the server.

## Find your way around

![The Repo Charter tab showing primitives grouped by kind](images/portal-charter.png)

| Tab | Use it to |
|---|---|
| **Repo Charter** | Create and edit your repository's primitives |
| **Vendor** | Install sources and inspect their read-only primitives |
| **Test** | Edit test files and run their cases |
| **Context** | See how much charter context each configured agent loads |

The header also has search, **Build** and **Doctor**. Search finds primitives
across the repository, vendor and built-in layers.

## Write or edit a primitive

1. Open **Repo Charter** and select a kind, such as `guide` or `skill`.
2. Click **New guide**, **New skill**, or the corresponding button for that kind.
3. Enter an id, description and the fields the form asks for. For a guide,
   use `globs` to limit it to relevant files. For a skill, supply its triggers.
4. Write the instructions in the Markdown body and click **Create primitive**.
5. Open the primitive again to edit its fields or body, then click **Save**.

![Editing a primitive's headers and Markdown body](images/portal-edit.png)

A primitive id must be unique across all layers and kinds. For advice on
choosing a kind, scoping a rule and writing its body, see
[Writing a charter](writing-a-charter.md).

Saving edits the source under `.cw/charter/`; it does not compile the agent's
files. Run **Build** after your edits are ready.

To remove a primitive you authored, open it and click **Delete**. Update any
references or tests that still name it, then build again.

## Understand a primitive

Click the **?** button on a primitive's row to see why it is relevant, what it
pulls in, which primitives cite it and which tests name it. This is useful
before changing a rule that other instructions depend on.

![Explaining a primitive and its references](images/portal-explain.png)

Vendor and built-in primitives can be inspected but are read-only.

## Manage vendor sources

Open **Vendor**, then click **Add vendor source**:

1. Enter the source's git address, such as
   `git@github.com:your-org/charter-baseline.git`.
2. Enter a tag, branch or commit in **version**, such as `v1.0.0`. Leaving it
   empty uses the source's default.
3. Click **Add source** and inspect the installed primitives.
4. Run **Build** to compile what was added.

To update a source, add the same address with the version you want. To remove
it, use its **Remove** button, then build again. Removal uses Git and requires
a clean working tree; commit or stash your work first.

The form provides source and version fields. Use the CLI when you need
`--charter` or `--skill` selection flags, or `cw vendor inject` to create your
own editable copy. See [vendor sources](reference.md#vendor-sources) and
[Creating a vendor source](creating-a-vendor.md).

## Run charter tests

Open **Test** to see the files under `.cw/test/` and their cases. Create a test
file or open an existing file to edit its JSON, then click **Save**.

Click **Run all tests**. The portal shows how many cases passed and the
outcome of each case. A failing case explains what happened instead of the
expected result; the first file with a failure opens automatically. Click a
referenced primitive id to inspect the rule involved.

![Test results with a failing case and its explanation](images/portal-tests.png)

These tests check activation and permission rules. They run no coding agent
or sensor command. To test whether a real agent follows the instructions,
use [evaluations](reference.md#evaluating-against-the-real-agent) from the CLI.

## Preview and build

Click **Build** in the header to open the preview. It lists files that would
be created, updated, deleted or left unchanged. **Nothing was written** means
you are still looking at the plan.

Review it, then click **Build** inside the dialog to apply it. The result
lists what was written or deleted. If the charter has errors, the dialog
names the files and faults to fix before building.

Building updates `.cw/out/` and the generated files for the configured agents.
Review those changes in Git together with the source changes.

## Check health and context

Click **Doctor** to check the charter, configured agents, vendor changes and
whether generated output is behind. Follow the reported fix for each issue;
when output needs rebuilding, the report offers a build.

Open **Context** to see the estimated tokens each configured agent loads when
a session opens, broken down by primitive. Guides loaded for matching files
are listed separately and are not included in the session-opening total.
The page also compares the total with the configured context ceiling.

A large total is a reason to review always-on instructions and use file scopes
where appropriate. See [context costs](reference.md#what-the-charter-costs).

## Finish a change

A typical session is: edit a primitive → run the tests → preview and build →
check Doctor → review the Git diff and commit.

The portal saves to your working tree. Building does not commit your charter
changes; review and commit them yourself. Stop the server with **Ctrl+C** when
you finish.
