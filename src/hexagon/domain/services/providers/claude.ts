import type { CharterRoot, ScopedPrimitive } from "../../models/charter/CharterRoot.js";
import { AgentPrimitive } from "../../models/charter/primitive/AgentPrimitive.js";
import { MCP_TOOL_REFERENCE, McpPrimitive } from "../../models/charter/primitive/McpPrimitive.js";
import { PosturePrimitive } from "../../models/charter/primitive/PosturePrimitive.js";
import type { ShortStrings } from "../../models/helper.js";
import { SensorPrimitive } from "../../models/charter/primitive/SensorPrimitive.js";
import type { CompiledPrimitive } from "../../models/output/common/CompiledPrimitive.js";
import type { Projection } from "../../models/output/ProjectionPolicy.js";
import { claudeDocumentComponentOf, type ClaudeComponent } from "../../models/output/providers/claude/ClaudeComponent.js";
import { ClaudeMcpConfigComponent } from "../../models/output/providers/claude/ClaudeMcpConfigComponent.js";
import {
  ClaudeSettingsComponent,
  isClaudeHookEvent,
  type ClaudeHookEvent,
  type ClaudeSettings,
} from "../../models/output/providers/claude/ClaudeSettingsComponent.js";
import { ClaudeAgentComponent } from "../../models/output/providers/claude/document-based-components/ClaudeAgentComponent.js";
import { ClaudeCommandComponent } from "../../models/output/providers/claude/document-based-components/ClaudeCommandComponent.js";
import { ClaudeRuleComponent } from "../../models/output/providers/claude/document-based-components/ClaudeRuleComponent.js";
import { ClaudeSkillComponent } from "../../models/output/providers/claude/document-based-components/ClaudeSkillComponent.js";
import { CLAUDE_DIRECTORY, CLAUDE_MCP_CONFIG_FILE } from "../../path.js";

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
export function compileForClaude(
  charter: CharterRoot,
  compiledPrimitives: readonly CompiledPrimitive[],
  shortStrings: ShortStrings,
): readonly ClaudeComponent[] {
  // Does this primitive ask something of the settings this host runs on, rather
  // than compile to a file of its own? A posture says what may be run, a sensor
  // what runs when an event fires, and this host reads both out of one file.
  const isSettingComponent = (one: ScopedPrimitive) =>
    one.primitive.kind === PosturePrimitive.kind || one.primitive.kind === SensorPrimitive.kind;
  const asSettings = charter.primitives.filter(isSettingComponent);
  const asDocuments = charter.primitives.filter((one) => !isSettingComponent(one));

  // A subagent holds the tools it lists and nothing else. A place it lists,
  // `mcp:<id>` whole or `mcp:<id>:<tool>` one tool, is written as this host is
  // given each of its tools, `mcp__cw__<served name>__<tool>` (FR-156); the
  // charter has refused a place or tool it does not hold.
  const toolsByMcpIdentity = new Map(
    charter.primitives.flatMap(({ identity, primitive }) => (primitive instanceof McpPrimitive ? [[identity, primitive.headers.tools] as const] : [])),
  );
  const agentToolsOf = (agent: AgentPrimitive) =>
    agent.headers.tools.flatMap((tool) => {
      const [, mcpIdentity, mcpTool] = tool.match(MCP_TOOL_REFERENCE) ?? [];
      if (mcpIdentity === undefined) return [tool];
      return (mcpTool === undefined ? (toolsByMcpIdentity.get(mcpIdentity) ?? []) : [mcpTool]).map(
        (oneTool) => `mcp__${ClaudeMcpConfigComponent.cwMcpName}__${shortStrings[mcpIdentity]}__${oneTool}`,
      );
    });

  return [
    ...(asSettings.length === 0 ? [] : [ClaudeSettingsComponent.of(claudeSettingsOf(asSettings))]),
    ClaudeMcpConfigComponent.of(),
    ...asDocuments.flatMap(
      (one) =>
        claudeDocumentComponentOf(
          one,
          compiledPrimitives.find((compiled) => compiled.identity === one.identity)!.file,
          one.primitive instanceof AgentPrimitive ? agentToolsOf(one.primitive) : undefined,
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
 * two commands under it, in the order their files sort in (SC-007).
 *
 * What the repository set for itself is not here at all: that is on disk, and
 * reading it together with this is the projection's (FR-020).
 */
function claudeSettingsOf(ones: readonly ScopedPrimitive[]): ClaudeSettings {
  const allow = new Set<string>();
  const deny = new Set<string>();
  const hooks: Partial<Record<ClaudeHookEvent, { hooks: { type: "command"; command: string }[] }[]>> = {};

  for (const one of ones) {
    if (one.primitive.kind === PosturePrimitive.kind) {
      const headers = one.primitive.headers;
      for (const permission of headers.allow) allow.add(permission);
      for (const permission of headers.deny) deny.add(permission);
    }
    if (one.primitive.kind === SensorPrimitive.kind) {
      const { signal, run } = one.primitive.headers;
      // A signal this host raises nothing for compiles to nothing: writing it
      // would be a hook that never fires, and the charter still names the event
      // for whichever host does raise it.
      if (isClaudeHookEvent(signal))
        hooks[signal] = [...(hooks[signal] ?? []), { hooks: [{ type: "command", command: run }] }];
    }
  }

  return {
    ...(allow.size === 0 && deny.size === 0 ? {} : { permissions: { allow: [...allow], deny: [...deny] } }),
    ...(Object.keys(hooks).length === 0 ? {} : { hooks }),
  };
}

/**
 * Where one of a host's own kinds lands, and what that file holds.
 *
 * One arm per kind, and the set is closed: a kind with nowhere to go is a
 * compile error, which is what keeps this and the kinds in step (FR-018).
 */
export function claudeComponentProjection(one: ClaudeComponent): Projection {
  const projectionPolicy = one.projection;

  switch (one.kind) {
    case ClaudeCommandComponent.kind:
      return { path: `${CLAUDE_DIRECTORY}/commands/${one.name}.md`, contents: one.toStampedDocument(), projectionPolicy };
    case ClaudeAgentComponent.kind:
      return { path: `${CLAUDE_DIRECTORY}/agents/${one.name}.md`, contents: one.toStampedDocument(), projectionPolicy };
    // A skill is a directory holding one file of that name, which is where this
    // host looks for it.
    case ClaudeSkillComponent.kind:
      return {
        path: `${CLAUDE_DIRECTORY}/skills/${one.name}/SKILL.md`,
        contents: one.toStampedDocument(),
        projectionPolicy,
      };
    // A rule of its own file, under the directory this host loads every one of:
    // at the start of a session where it declares no `paths`, and when one of
    // them is touched where it does.
    case ClaudeRuleComponent.kind:
      return { path: `${CLAUDE_DIRECTORY}/rules/${one.name}.md`, contents: one.toStampedDocument(), projectionPolicy };
    // Every posture and every sensor of the charter lands in the one file this
    // host reads its settings from.
    case ClaudeSettingsComponent.kind:
      return {
        path: `${CLAUDE_DIRECTORY}/settings.json`,
        contents: `${JSON.stringify(one.settings, undefined, 2)}\n`,
        projectionPolicy,
      };
    // The one server reaching every place, in the file this host starts a
    // project's servers from (FR-146).
    case ClaudeMcpConfigComponent.kind:
      return {
        path: CLAUDE_MCP_CONFIG_FILE,
        contents: `${JSON.stringify({ mcpServers: one.mcpServers }, undefined, 2)}\n`,
        projectionPolicy,
      };
  }
}
