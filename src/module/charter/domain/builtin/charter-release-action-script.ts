import { AssetFile } from "../models/primitive/asset-file.js";
import { PrimitiveLayer } from "../models/primitive/primitive-layer.value-object.js";
import { type ScriptHeaders, ScriptPrimitive } from "../models/primitive/script-primitive.js";
// Its text, not the module: it runs on the author's machine when they ask
// /charter-release, never here.
import charterReleaseActionMjs from "./scripts/charter-release-action.script.mjs";

/** The steps of `/charter-release` that must not depend on the agent's
 *  judgement, brought by the engine to every repository (VENDOR-FR-005 –
 *  VENDOR-FR-008, VENDOR-FR-027). */
export class CharterReleaseActionScript extends ScriptPrimitive {
  static readonly id = "charter-release-action";

  constructor() {
    const scriptHeaders: ScriptHeaders = {
      id: CharterReleaseActionScript.id,
      description:
        "For releasing the charters this repository authored the same way every time — the steps of /charter-release that must not depend on the agent's judgement.",
      executionPath: "./charter-release-action.mjs",
    };
    super(
      scriptHeaders,
      `This script is cw's own. It comes with the engine to every repository, is
not authored in this repository, and cannot be changed here.

The steps of \`/charter-release\` that a script takes. It is
\`charter-release-action.mjs\`, the file laid beside this one: run it with Node 20
or later and nothing else, by that file's path, from anywhere in the
repository, since it runs at the repository's root. Which version, and what
the changelog says, are never its to decide.

\`\`\`bash
node <the path of charter-release-action.mjs> check [--branch <name>]
node <the path of charter-release-action.mjs> readme
node <the path of charter-release-action.mjs> draft
node <the path of charter-release-action.mjs> publish <version> <entry-file> [--date yyyy-mm-dd] [--branch <name>]
\`\`\`

The release branch is \`origin\`'s default branch, the one its \`HEAD\` names,
whatever it is called: \`main\`, \`develop\` or another. With no \`origin\`, or an
\`origin\` holding no commit yet, it is never guessed: **check** and **publish**
stop, naming the branch stood on, until the branch the user confirms is passed
as \`--branch <name>\`. A \`--branch\` other than \`origin\`'s default branch is
refused.

A charter the repository authored is a folder under \`.cw/charter/\` that git
holds, holding no \`cw-package.json\`; one holding it was installed, and is not
released here.

- **check** stops, writing nothing, unless the branch stood on is the release
  branch, the working tree is clean, the branch has an \`origin\` and is neither
  behind nor diverged from it there, and git ignores no file under
  \`.cw/charter/\`, which no install would hold; then it runs \`cw build\` at the root, and
  stops naming each charter that does not build, with what the build said. No
  primitive may hold or name what cw builds into every repository to release
  charters, so a
  charter building here builds with the charters it includes alone.
- **readme** rewrites the section of \`README.md\` between
  \`<!-- charter-release-action: charters -->\` and \`<!-- /charter-release-action: charters -->\`
  from the charters as built: the \`cw charter pull <owner>/<repository>\` that
  installs every charter, the owner and repository read off \`origin\`, then for
  each charter the repository authored, the \`--charter=<name>\` that installs it
  alone and a table of its skills with their descriptions. A skill is listed
  when it is kept under the charter's \`primitive/skill/\`; cw's own skills, such
  as \`cw-author\`, are left out. The rest of \`README.md\` is left as it is;
  where there is no \`README.md\`, it is written holding that section alone.
- **draft** reads the last release, the highest \`v<version>\` tag, and stops
  unless the top \`## <version> — <date>\` heading of \`CHANGELOG.md\` names
  it. It prints \`0.1.0\` with no tag, else the patch and the minor bump after
  it, what was removed or renamed under \`.cw/charter/\`, today's date and every
  commit since; with none, it says there is nothing to release.
- **publish** writes the entry the file holds as \`## <version> — <date>\`
  under \`# Changelog\`, writing \`CHANGELOG.md\` where there is none, commits
  it with what \`readme\` changed as \`release v<version>\`, pushes the release branch, makes the annotated tag \`v<version>\`
  and pushes it, in that order. It stops, writing nothing, where anything
  but \`README.md\` and \`CHANGELOG.md\` changed since check. It
  stops at the first step that fails, quoting its decisive line, saying which
  steps ran and the command that finishes the rest. It never force-pushes, and
  never moves or deletes a tag.`,
      [new AssetFile("charter-release-action.mjs", new TextEncoder().encode(charterReleaseActionMjs))],
      PrimitiveLayer.BUILTIN,
    );
  }
}
