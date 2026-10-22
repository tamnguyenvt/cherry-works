import type { Primitive } from "../../models/charter/primitive/Primitive.js";
import type { CharterRoot } from "../../models/charter/CharterRoot.js";
import { AgentPrimitive } from "../../models/charter/primitive/AgentPrimitive.js";
import { GuidePrimitive } from "../../models/charter/primitive/GuidePrimitive.js";
import { PlaybookPrimitive } from "../../models/charter/primitive/PlaybookPrimitive.js";
import { SkillPrimitive } from "../../models/charter/primitive/SkillPrimitive.js";
import { McpPrimitive } from "../../models/charter/primitive/McpPrimitive.js";
import { TOOL_REFERENCE } from "../../models/charter/primitive/BasePrimitive.js";
import { PosturePrimitive } from "../../models/charter/primitive/PosturePrimitive.js";
import type { ShortStrings } from "../../models/helper.js";
import { SensorPrimitive } from "../../models/charter/primitive/SensorPrimitive.js";
import type { CompiledPrimitive } from "../../models/output/common/CompiledPrimitive.js";
import { sensorRunCommandOf, type BuiltSensors } from "../../models/output/common/BuiltSensor.js";
import type { ClaudeComponent } from "../../models/output/provider-component/claude/ClaudeComponent.js";
import { ClaudeAgent } from "../../models/output/provider-component/claude/ClaudeAgent.js";
import { ClaudeRule } from "../../models/output/provider-component/claude/ClaudeRule.js";
import { ClaudeSkill } from "../../models/output/provider-component/claude/ClaudeSkill.js";
import { ClaudeMcpConfig } from "../../models/output/provider-component/claude/ClaudeMcpConfig.js";
import { ClaudeEntryFile } from "../../models/output/provider-component/claude/ClaudeEntryFile.js";
import {
  CLAUDE_TOOL_SEARCH_ENV,
  ClaudeSettings,
  isClaudeHookEvent,
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
 * configuration that starts it, written whether the charter holds an mcp origin yet or
 * not, since the server reads which mcp origins there are when it starts (FR-146).
 */
export function claudeComponentsOf(
  charter: CharterRoot,
  compiledPrimitiveByPrimitive: ReadonlyMap<Primitive, CompiledPrimitive>,
  shortMcpIds: ShortStrings,
  builtSensors: BuiltSensors,
): readonly ClaudeComponent[] {
  // Does this primitive ask something of the settings this host runs on, rather
  // than compile to a file of its own? A posture says what may be run, a sensor
  // what runs when an event fires, and this host reads both out of one file.
  const isSettingComponent = (one: Primitive) =>
    one.kind === PosturePrimitive.kind || one.kind === SensorPrimitive.kind;
  const asSettings = charter.primitives.filter(isSettingComponent);
  const asDocuments = charter.primitives.filter((one) => !isSettingComponent(one));

  // A subagent holds the tools it lists and nothing else. An mcp origin it lists,
  // `[[<id>]]` whole or `[[<id>]]:<tool>` one tool, is written as this host is
  // given each of its tools, `mcp__cw__<served name>__<tool>` (FR-156); the
  // charter has refused an mcp origin or tool it does not hold.
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
    ...(asSettings.length === 0 && toolsByMcpId.size === 0
      ? []
      : [ClaudeSettings.of(claudeSettingsOf(charter, builtSensors, asSettings))]),
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
 * posture's permissions are the permissions, each thing once, and every event a
 * sensor fires on is one hook, `cw sensor run <event>`, which runs that event's
 * sensors as the last build wrote them (FR-175). A charter reaching a mcp origin
 * turns the host's own tool search on (EVAL-FR-016).
 *
 * What the repository set for itself is not here at all: that is on disk, and
 * reading it together with this is the projection's (FR-020).
 */
function claudeSettingsOf(charter: CharterRoot, builtSensors: BuiltSensors, settingPrimitives: readonly Primitive[]): ClaudeSettingsFields {
  const allowedPermissions = new Set<string>();
  const deniedPermissions = new Set<string>();

  for (const settingPrimitive of settingPrimitives) {
    if (settingPrimitive.kind === PosturePrimitive.kind) {
      for (const permission of settingPrimitive.headers.allow) allowedPermissions.add(permission);
      for (const permission of settingPrimitive.headers.deny) deniedPermissions.add(permission);
    }
  }
  // A signal this host raises nothing for compiles to nothing: writing it would
  // be a hook that never fires, and the charter still names the event for
  // whichever host does raise it. In the order the events' names sort in, so the
  // same charter writes the same file (SC-007).
  const hookEvents = builtSensors.signals.filter(isClaudeHookEvent).sort();

  return {
    ...(allowedPermissions.size === 0 && deniedPermissions.size === 0 ? {} : { permissions: { allow: [...allowedPermissions], deny: [...deniedPermissions] } }),
    ...(hookEvents.length === 0
      ? {}
      : { hooks: Object.fromEntries(hookEvents.map((hookEvent) => [hookEvent, [{ hooks: [{ type: "command", command: sensorRunCommandOf(hookEvent) }] }]])) }),
    // A charter reaching an mcp origin has its tools' schemas deferred by the host
    // itself, the one server listing every tool (EVAL-FR-016).
    ...(charter.primitives.some((primitive) => primitive instanceof McpPrimitive) && { env: CLAUDE_TOOL_SEARCH_ENV }),
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
 * A rule's `@` is expanded when the session opens; for the other kinds claude
 * documents no such expansion, so the line says to read the file. A subagent
 * is handed `agentTools`: its tools as this host names them, each mcp origin it
 * holds written as that mcp origin's tools (FR-156).
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
      // An `@` is expanded when the session opens, paths or not, so a guide
      // naming files is pointed to from the repository's root instead, and
      // read only once one of them is touched.
      const { globs = [] } = sc.headers;
      if (globs.length === 0) return ClaudeRule.of(name, {}, `@${compiledFromClaudeFolder}\n`);
      return ClaudeRule.of(name, { paths: globs }, `Read and follow ${compiledFile}.\n`);
    }
    case AgentPrimitive.kind: {
      const { tools } = sc.headers;
      const claudeModel = sc.modelOf("claude");
      return ClaudeAgent.of(
        name,
        { description: sc.description(), tools: (agentTools ?? tools).join(", "), ...(claudeModel === undefined ? {} : { model: claudeModel }) },
        pointerTo(compiledFromClaudeFolder),
      );
    }
    // One kind of this host for the two the charter loads when the request calls
    // for them: what decides that the body is worth opening is the description,
    // because that line is all this host reads before deciding (FR-013), and
    // composing it is the primitive's. One that is a step of another is kept
    // out of the user's commands (CORE-FR-174).
    case SkillPrimitive.kind:
    case PlaybookPrimitive.kind:
      return ClaudeSkill.of(
        name,
        { description: sc.description(), ...(sc.headers["disable-user-invocation"] === true ? { "user-invocable": false } : {}) },
        pointerTo(`../${compiledFromClaudeFolder}`),
      );
    default:
      return undefined;
  }
}
