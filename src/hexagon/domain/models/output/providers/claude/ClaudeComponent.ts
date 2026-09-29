import type { ScopedPrimitive } from "../../../charter/CharterRoot.js";
import { AgentPrimitive } from "../../../charter/primitive/AgentPrimitive.js";
import { CommandPrimitive } from "../../../charter/primitive/CommandPrimitive.js";
import { GuidePrimitive } from "../../../charter/primitive/GuidePrimitive.js";
import { PlaybookPrimitive } from "../../../charter/primitive/PlaybookPrimitive.js";
import { SkillPrimitive } from "../../../charter/primitive/SkillPrimitive.js";
import { ClaudeAgentComponent } from "./document-based-components/ClaudeAgentComponent.js";
import { ClaudeCommandComponent } from "./document-based-components/ClaudeCommandComponent.js";
import { ClaudeRuleComponent } from "./document-based-components/ClaudeRuleComponent.js";
import { ClaudeMcpConfigComponent } from "./ClaudeMcpConfigComponent.js";
import { ClaudeSettingsComponent } from "./ClaudeSettingsComponent.js";
import { ClaudeSkillComponent } from "./document-based-components/ClaudeSkillComponent.js";

/** The kinds this host has, one class each. Adding a kind is a file beside them
 *  and a line here; what the kinds are is read back off this list rather than
 *  written down twice. */
export const CLAUDE_COMPONENT_CLASSES = [
  ClaudeCommandComponent,
  ClaudeAgentComponent,
  ClaudeSkillComponent,
  ClaudeSettingsComponent,
  ClaudeMcpConfigComponent,
  ClaudeRuleComponent,
] as const;

/**
 * One file as claude's own kinds have it, discriminated on `kind`.
 *
 * Read off what those classes hand back rather than listed again: a constructor
 * is private, so `of` is the only way one comes into being, and what it returns
 * is what a primitive of this host is.
 */
export type ClaudeComponent = ReturnType<(typeof CLAUDE_COMPONENT_CLASSES)[number]["of"]>;

/** The kinds, each read off the class that writes it. The set is closed:
 *  the compiler reads it to know where a file of that kind goes, and a kind
 *  with nowhere to go is a compile error. */
export const CLAUDE_COMPONENT_KINDS = Object.freeze(CLAUDE_COMPONENT_CLASSES.map((one) => one.kind));

export type ClaudeComponentKind = (typeof CLAUDE_COMPONENT_CLASSES)[number]["kind"];

/**
 * Which document of this host a charter primitive becomes, or nothing where this
 * host has no kind for it.
 *
 * What the primitive says is kept once, in its compiled document: this holds
 * what the host reads before it opens a body, and one line pointing there
 * (FR-139). The path is from this document's own folder, as claude resolves an
 * `@` import: `.claude/<kind>/` two folders down, a skill's `SKILL.md` three.
 * A rule's `@` is expanded when the rule loads; for the other kinds claude
 * documents no such expansion, so the line says to read the file.
 */
export function claudeDocumentComponentOf(sc: ScopedPrimitive, compiledFile: string): ClaudeComponent | undefined {
  // The kind stays in the name, because two charter kinds can land in one
  // directory there — `guide:no-any` and `skill:no-any` are two primitives and
  // must stay two files (FR-014).
  const name = sc.normIdentity;
  // From `.claude/<kind>/`, two folders down; a skill's `SKILL.md` sits one
  // further, in a folder of its own.
  const compiledFromClaudeFolder = `../../${compiledFile}`;
  const pointerTo = (path: string) => `Read and follow @${path}.\n`;

  switch (sc.primitive.kind) {
    // A guide is a rule this host loads into context whole: when a file it names
    // is touched, which is what `paths` on a rule does, and at the start of every
    // session where it names none (FR-013). Under the identity it is changed by,
    // so a reader who wants it changed is sent to the primitive rather than
    // editing what the next build overwrites (FR-017, FR-020).
    case GuidePrimitive.kind: {
      const { globs = [] } = sc.primitive.headers;
      return ClaudeRuleComponent.of(name, globs.length === 0 ? {} : { paths: globs }, `@${compiledFromClaudeFolder}\n`);
    }
    // for command, remove kind prefix so user just types /do-something instead of /command-do-something
    case CommandPrimitive.kind:
      return ClaudeCommandComponent.of(name.replace(`${CommandPrimitive.kind}-`, ""), { description: sc.primitive.description() }, pointerTo(compiledFromClaudeFolder));
    case AgentPrimitive.kind: {
      const { tools } = sc.primitive.headers;
      return ClaudeAgentComponent.of(name, { description: sc.primitive.description(), tools: tools.join(", ") }, pointerTo(compiledFromClaudeFolder));
    }
    // One kind of this host for the two the charter loads when the request calls
    // for them: what decides that the body is worth opening is the description,
    // because that line is all this host reads before deciding (FR-013), and
    // composing it is the primitive's.
    case SkillPrimitive.kind:
    case PlaybookPrimitive.kind:
      return ClaudeSkillComponent.of(name, { description: sc.primitive.description() }, pointerTo(`../${compiledFromClaudeFolder}`));
    default:
      return undefined;
  }
}
