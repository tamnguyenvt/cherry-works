import { PrimitiveLayer } from "../models/primitive/primitive-layer.value-object.js";
import { type SkillHeaders, SkillPrimitive } from "../models/primitive/skill-primitive.js";

/** How a repository releases the charters it authored, brought by the engine
 *  to every repository (VENDOR-FR-005 – VENDOR-FR-008, VENDOR-FR-027). Only
 *  the user asks for it. */
export class CharterReleaseSkill extends SkillPrimitive {
  static readonly id = "charter-release";

  constructor() {
    const skillHeaders: SkillHeaders = {
      id: CharterReleaseSkill.id,
      description:
        "For publishing a new version of the charters this repository authored, so other repositories can install or update them, with nothing pushed before you confirm.",
      triggers: ["release", "release a version", "cut a release"],
      "disable-model-invocation": true,
    };
    super(
      skillHeaders,
      `This skill is cw's own. It comes with the engine to every repository, is
not authored in this repository, and cannot be changed here.

Release the charters this repository authored the way [[charter-release-action]]
says. Each step below runs its \`charter-release-action.mjs\`, the file laid
beside it, with \`node\` by that file's path. Nothing is committed, pushed or
tagged before the user confirms at the gate.

1. **Check** — run \`charter-release-action.mjs check\`. Where it stops, quote what it
   says and stop: a branch other than \`origin\`'s default branch, a working
   tree that is not clean, no \`origin\`, the branch behind or diverged from
   \`origin\`, or a charter that does not build with the charters it includes
   alone, named with why. Where it says it is unsure which branch to release
   from, ask the user which branch releases are made from, offering the branch
   it names as the default, and run
   \`charter-release-action.mjs check --branch <name>\` with their answer; pass
   that same \`--branch\` to publish.
2. **Draft** — run \`charter-release-action.mjs draft\`, which writes nothing. Where it
   says there is nothing to release, say so and stop; where the last tag and
   the changelog's top heading differ, quote both and stop.
   - **Version**: \`0.1.0\` where there is no tag. Otherwise the patch bump,
     or the minor bump where what landed breaks a repository already
     installing a charter of it — a charter or a primitive removed or
     renamed, an id changed, a skill or a command a user types gone — said
     with its reason. Where the user named a version, take it, and say so
     only where it is not what the changes call for.
   - **Entry**: one bullet per change a user of a charter notices, from the
     commits it lists, in the voice of the changelog's earlier entries: what a
     user can now do, or what changed for them. Leave out what changes only
     this repository's tooling.
3. **README** — only once nothing above stopped, run
   \`charter-release-action.mjs readme\`. Where it stops, quote what it says and
   stop. It rewrites only the install and charters section of \`README.md\`,
   writing \`README.md\` holding that section alone where there is none; the
   rest is the authors' and is never touched.
4. **Gate** — show the version with its reason, the date, the entry as it
   will read under \`## <version> — <date>\`, and whether the README's charters
   section changed. Ask one question: confirm, or correct the version, the
   date or the entry. On a correction, show it again and ask again, until
   they confirm.
5. **Release** — once they confirm, write the entry to a temporary file
   outside the repository, and run
   \`charter-release-action.mjs publish <version> <entry-file> --date <date>\`,
   with the \`--branch\` the user confirmed at Check, if any. Where it
   stops, quote its lines as they are — the step that failed, the steps that
   ran, the command that finishes the rest — and do nothing more: never
   force-push, never move or delete a tag.
6. **Report** — the version released, and the tag \`v<version>\` on \`origin\`.`,
      [],
      PrimitiveLayer.BUILTIN,
    );
  }
}
