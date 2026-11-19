import { PrimitiveLayer } from "../models/primitive/primitive-layer.value-object.js";
import { type SkillHeaders, SkillPrimitive } from "../models/primitive/skill-primitive.js";

/** How a primitive of this charter is authored, brought by the engine to every
 *  repository it governs (FR-022). Its triggers are the requests to write one
 *  (FR-026). */
export class CwAuthorSkill extends SkillPrimitive {
  constructor() {
    const skillHeaders: SkillHeaders = {
      id: "cw-author",
      description: "Author a new primitive of this repository's charter, asking cw what its kind requires.",
      triggers: ["write a rule", "add a standard", "write a skill", "author a primitive of the charter"],
    };
    super(
      skillHeaders,
      `# Authoring a primitive of this charter

This skill is cw's own. It comes with the engine, is not authored in this
repository, and cannot be changed here. A repository that wants another way of
authoring writes a primitive of its own, under an id of its own.

It covers writing a new primitive. Changing or removing one that already exists
is not what it covers.

Do not write a primitive from memory, or copy the headers of another one. What a
kind requires is asked of cw, which answers from the same contract a file is
refused against.

1. If the kind is not settled, run \`cw kinds\`. It names every kind and when a
   primitive of each comes up; take the one whose line matches what is being
   asked for.
2. Run \`cw kinds <kind>\`. It names every header that kind requires, the shape
   each takes — one line, or a list — the values one drawn from a closed set
   may hold, and a sample written in full.
3. Run \`cw add <kind> <id> --charter=<charter> --header <name>=<value>\`, one
   \`--header\` for each header step 2 named, and for any other the sample
   shows this primitive needs. \`<charter>\` is one the repository authored,
   which \`cw add\` names when it is refused for want of one, or a new one the
   developer names. A header that takes a list is given once per entry, in order; one that
   takes a line is given once. Everything after the first \`=\` is the value. If
   cw refuses, it says why and shows the kind's sample: answer again with that
   in hand. Nothing is written until the headers hold.
4. Write the body into the file cw named. The headers decide when the primitive
   comes up; the body is what an agent reads once it has. Name another
   primitive by its id alone: bare in a header, and as \`[[<id>]]\` in the
   body, which the build turns into a link to it. An id names one primitive
   whatever its kind.
5. Run \`cw build\`. If it refuses, \`cw doctor\` names each file with a problem
   and how to fix it.

## Moving a charter laid out the old way

When cw refuses a command because the repository is laid out the old way, ask
the developer which charter the repository's own primitives go in: a name
written as an id is, and never a kind's, \`primitive\`, \`test\`, \`eval\`,
\`vendor\` or \`root\`. Then, before anything else, move every
file below, keeping its contents as they are, \`<charter>\` being the name
answered. First, a \`.cw/eval/.worktrees/\` an evaluation left is not moved:
delete it, then run \`git worktree prune\`. Then move:

- \`.cw/charter/<kind>/\` → \`.cw/charter/<charter>/primitive/<kind>/\`, for each kind's folder right under \`.cw/charter/\`
- \`.cw/charter/primitive/<kind>/\` → \`.cw/charter/<charter>/primitive/<kind>/\`, for each kind's folder right under \`.cw/charter/primitive/\`
- \`.cw/test/\` → \`.cw/charter/<charter>/test/\`
- \`.cw/charter/test/\` → \`.cw/charter/<charter>/test/\`
- \`.cw/eval/\` → \`.cw/charter/<charter>/eval/\`
- \`.cw/charter/eval/\` → \`.cw/charter/<charter>/eval/\`

An installed charter under \`.cw/vendor/\` or \`.cw/charter/vendor/\` is never moved: name
each to the developer, and ask them to delete the folder; never delete it
yourself. Once the repository builds, each
is installed again with the latest cw, \`cw charter pull <source>\`, from a
source laid out as that cw reads one.

A skill \`vendor-release\` and a script \`vendor-release-action\` that an
earlier cw wrote are not moved: name them to the developer, and ask them to
delete them, since \`/charter-release\` comes with cw and replaces them.

\`.cw/settings.json\` and what a build put out stay where they are. In
\`.cw/.gitignore\`, the line \`eval/.worktrees/\`
becomes \`log/\`. Then run \`cw build\`: it builds what it built before the
move, but for the installed charters deleted.`,
      [],
      PrimitiveLayer.BUILTIN,
    );
  }
}
