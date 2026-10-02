import type { Primitive } from "../../models/charter/primitive/Primitive.js";
import type { CharterRoot } from "../../models/charter/CharterRoot.js";
import { AgentPrimitive } from "../../models/charter/primitive/AgentPrimitive.js";
import { GuidePrimitive } from "../../models/charter/primitive/GuidePrimitive.js";
import { PlaybookPrimitive } from "../../models/charter/primitive/PlaybookPrimitive.js";
import { SkillPrimitive } from "../../models/charter/primitive/SkillPrimitive.js";
import { McpPrimitive } from "../../models/charter/primitive/McpPrimitive.js";
import { REFERENCE, TOOL_REFERENCE } from "../../models/charter/primitive/BasePrimitive.js";
import { PosturePrimitive } from "../../models/charter/primitive/PosturePrimitive.js";
import type { ShortStrings } from "../../models/helper.js";
import { SensorPrimitive } from "../../models/charter/primitive/SensorPrimitive.js";
import type { CompiledPrimitive } from "../../models/output/common/CompiledPrimitive.js";
import type { ClaudeComponent } from "../../models/output/provider-component/claude/ClaudeComponent.js";
import { ClaudeAgent } from "../../models/output/provider-component/claude/ClaudeAgent.js";
import { ClaudeRule } from "../../models/output/provider-component/claude/ClaudeRule.js";
import { ClaudeSkill } from "../../models/output/provider-component/claude/ClaudeSkill.js";
import { ClaudeMcpConfig } from "../../models/output/provider-component/claude/ClaudeMcpConfig.js";
import { ClaudeEntryFile } from "../../models/output/provider-component/claude/ClaudeEntryFile.js";
import {
  ClaudeSettings,
  isClaudeHookEvent,
  type ClaudeHookEvent,
  type ClaudeSettingsFields,
} from "../../models/output/provider-component/claude/ClaudeSettings.js";

/**
 * Every file claude reads of this charter (FR-018).
 *
 * Two passes, because this host reads two kinds of file. What lands in its
 * settings lands in one file whatever asked for it, so every primitive that asks
 * is read together and compiles to one fragment; everything else is a document
 * of its own, one per primitive.
 *
 * Not one for one, either way. A `skill` and a `playbook` are two things in a
 * charter and one thing here, because this host has one mechanism for a body
 * loaded when the request calls for it; a `guide` is a rule, brought up by the
 * files it names or carried on every turn where it names none. What the charter kept apart, the listing
 * keeps apart (FR-011); what the host cannot tell apart, it is not told.
 *
 * Three kinds project nothing of their own. A `corpus` is cited rather than
 * loaded, a `mixin` has no life of its own — its body is written into each host
 * that pulls it in, which `toMarkdown` does when `compile` hands it the mixins — and an `mcp` is reached through
 * `cw mcp serve` rather than read: the one entry of the host's MCP
 * configuration that starts it, written whether the charter holds a place yet or
 * not, since the server reads which places there are when it starts (FR-146).
 */
export function claudeComponentsOf(
  charter: CharterRoot,
  compiledPrimitiveByPrimitive: ReadonlyMap<Primitive, CompiledPrimitive>,
  shortMcpIds: ShortStrings,
): readonly ClaudeComponent[] {
  // Does this primitive ask something of the settings this host runs on, rather
  // than compile to a file of its own? A posture says what may be run, a sensor
  // what runs when an event fires, and this host reads both out of one file.
  const isSettingComponent = (one: Primitive) =>
    one.kind === PosturePrimitive.kind || one.kind === SensorPrimitive.kind;
  const asSettings = charter.primitives.filter(isSettingComponent);
  const asDocuments = charter.primitives.filter((one) => !isSettingComponent(one));

  // A subagent holds the tools it lists and nothing else. A place it lists,
  // `[[<id>]]` whole or `[[<id>]]:<tool>` one tool, is written as this host is
  // given each of its tools, `mcp__cw__<served name>__<tool>` (FR-156); the
  // charter has refused a place or tool it does not hold.
  const toolsByMcpId = new Map(
    charter.primitives.flatMap((primitive) => (primitive instanceof McpPrimitive ? [[primitive.headers.id, primitive.headers.tools] as const] : [])),
  );
  const agentToolsOf = (agent: AgentPrimitive) =>
    agent.headers.tools.flatMap((tool) => {
      const [, mcpId, mcpTool] = tool.match(TOOL_REFERENCE) ?? [];
      if (mcpId === undefined) return [tool];
      return (mcpTool === undefined ? (toolsByMcpId.get(mcpId) ?? []) : [mcpTool]).map(
        (oneTool) => `mcp__${ClaudeMcpConfig.cwMcpName}__${shortMcpIds[mcpId]}__${oneTool}`,
      );
    });

  return [
    // The section of `CLAUDE.md` that sends this host to the charter at all
    // (FR-051).
    ClaudeEntryFile.of(),
    ...(asSettings.length === 0 ? [] : [ClaudeSettings.of(claudeSettingsOf(charter, compiledPrimitiveByPrimitive, asSettings))]),
    ClaudeMcpConfig.of(),
    ...asDocuments.flatMap(
      (one) =>
        claudeDocumentComponentOf(
          one,
          // Its document is the first file it puts down.
          compiledPrimitiveByPrimitive.get(one)!.projections[0]!.file,
          one instanceof AgentPrimitive ? agentToolsOf(one) : undefined,
        ) ?? [],
    ),
  ];
}

/**
 * Everything this charter asks of the settings this host runs on, read together
 * (FR-018).
 *
 * One fragment for the whole charter, because the host keeps one such file: every
 * posture's permissions are the permissions, each thing once, and every sensor's
 * command is a hook under the event that fires it. Two sensors on one event are
 * two commands under it, in the order their files sort in (SC-007). A script a
 * command names is written as the file that runs (FR-169).
 *
 * What the repository set for itself is not here at all: that is on disk, and
 * reading it together with this is the projection's (FR-020).
 */
function claudeSettingsOf(
  charter: CharterRoot,
  compiledPrimitiveByPrimitive: ReadonlyMap<Primitive, CompiledPrimitive>,
  ones: readonly Primitive[],
): ClaudeSettingsFields {
  const allow = new Set<string>();
  const deny = new Set<string>();
  const hooks: Partial<Record<ClaudeHookEvent, { hooks: { type: "command"; command: string }[] }[]>> = {};

  for (const one of ones) {
    if (one.kind === PosturePrimitive.kind) {
      const headers = one.headers;
      for (const permission of headers.allow) allow.add(permission);
      for (const permission of headers.deny) deny.add(permission);
    }
    if (one.kind === SensorPrimitive.kind) {
      const { signal, run } = one.headers;
      // A signal this host raises nothing for compiles to nothing: writing it
      // would be a hook that never fires, and the charter still names the event
      // for whichever host does raise it.
      // A harness runs the command and looks nothing up, so a script named in
      // it is written as the file a build put down, from the repository's
      // root; the charter has refused a script it does not hold (FR-169).
      const command = run.replace(REFERENCE, (reference, referencedId: string) => {
        const scriptPrimitive = charter.primitiveById.get(referencedId);
        const executionFile = scriptPrimitive && compiledPrimitiveByPrimitive.get(scriptPrimitive)?.projections.find((projection) => projection.executable)?.file;
        return executionFile ?? reference;
      });
      if (isClaudeHookEvent(signal))
        hooks[signal] = [...(hooks[signal] ?? []), { hooks: [{ type: "command", command }] }];
    }
  }

  return {
    ...(allow.size === 0 && deny.size === 0 ? {} : { permissions: { allow: [...allow], deny: [...deny] } }),
    ...(Object.keys(hooks).length === 0 ? {} : { hooks }),
  };
}

/**
 * Which document of this host a charter primitive becomes, or nothing where this
 * host has no kind for it.
 *
 * What the primitive says is kept once, in its compiled document: this holds
 * what the host reads before it opens a body, and one line pointing there
 * (FR-139). The path is from this document's own folder, as claude resolves an
 * `@` import: `.claude/<kind>/` two folders down, a skill's `SKILL.md` three.
 * A rule's `@` is expanded when the rule loads; for the other kinds claude
 * documents no such expansion, so the line says to read the file. A subagent
 * is handed `agentTools`: its tools as this host names them, each place it
 * holds written as that place's tools (FR-156).
 */
function claudeDocumentComponentOf(sc: Primitive, compiledFile: string, agentTools?: readonly string[]): ClaudeComponent | undefined {
  // The id alone, so a skill is invoked as `/<id>` rather than
  // `/skill-<id>`; one id names one primitive whatever its kind, so no two
  // land on one name here (FR-015, FR-171).
  const name = sc.normId;
  // From `.claude/<kind>/`, two folders down; a skill's `SKILL.md` sits one
  // further, in a folder of its own.
  const compiledFromClaudeFolder = `../../${compiledFile}`;
  const pointerTo = (path: string) => `Read and follow @${path}.\n`;

  switch (sc.kind) {
    // A guide is a rule this host loads into context whole: when a file it names
    // is touched, which is what `paths` on a rule does, and at the start of every
    // session where it names none (FR-013). Under the id it is changed by,
    // so a reader who wants it changed is sent to the primitive rather than
    // editing what the next build overwrites (FR-017, FR-020).
    case GuidePrimitive.kind: {
      const { globs = [] } = sc.headers;
      return ClaudeRule.of(name, globs.length === 0 ? {} : { paths: globs }, `@${compiledFromClaudeFolder}\n`);
    }
    case AgentPrimitive.kind: {
      const { tools } = sc.headers;
      return ClaudeAgent.of(name, { description: sc.description(), tools: (agentTools ?? tools).join(", ") }, pointerTo(compiledFromClaudeFolder));
    }
    // One kind of this host for the two the charter loads when the request calls
    // for them: what decides that the body is worth opening is the description,
    // because that line is all this host reads before deciding (FR-013), and
    // composing it is the primitive's.
    case SkillPrimitive.kind:
    case PlaybookPrimitive.kind:
      return ClaudeSkill.of(name, { description: sc.description() }, pointerTo(`../${compiledFromClaudeFolder}`));
    default:
      return undefined;
  }
}
