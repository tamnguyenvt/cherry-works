import type { CharterRoot } from "../../models/charter/CharterRoot.js";
import type { MainContextText } from "../../models/context/MainContext.js";
import { ClaudeAgent } from "../../models/output/provider-component/claude/ClaudeAgent.js";
import { ClaudeEntryFile } from "../../models/output/provider-component/claude/ClaudeEntryFile.js";
import { ClaudeRule } from "../../models/output/provider-component/claude/ClaudeRule.js";
import { ClaudeSkill } from "../../models/output/provider-component/claude/ClaudeSkill.js";
import { compile } from "../compile/compileService.js";
import { McpPrimitive } from "../../models/charter/primitive/McpPrimitive.js";
import { ClaudeMcpConfig } from "../../models/output/provider-component/claude/ClaudeMcpConfig.js";

/**
 * How many of claude's tokens one token of the tokenizer on this machine
 * stands for: what the estimate is scaled by to come within 15% of an exact
 * count (EVAL-SC-002). Measured on 2026-10-04 against `cw context --exact`,
 * this repository's charter: 4,048 tokens counted exactly, 2,837 estimated.
 */
export const CLAUDE_TOKEN_FACTOR = 1.43;

/**
 * What claude puts into its main context of this charter, as the text it is
 * sent (EVAL-FR-001, EVAL-FR-003), read off the files a build compiles for it.
 *
 * When a session opens: the charter's section of `CLAUDE.md`, and `CHARTER.md`,
 * which that section has it read before anything else; every rule whole, the
 * compiled guide its `@` line expands to included; and the name and
 * description of each skill and subagent, all it reads of them before one is
 * called for. A rule naming `paths` is loaded when a file they match is
 * touched, so it carries the guide's globs. Settings and the MCP configuration
 * put nothing there. Of each tool `cw mcp serve` lists for an mcp, its name
 * alone, under the mcp: the host's tool search, which the build turns on,
 * sends a schema only once the agent searches for it (EVAL-FR-029).
 */
export function claudeMainContextOf(charter: CharterRoot): readonly MainContextText[] {
  const { charterMd, compiledPrimitives, mcpOrigins, providerComponents } = compile(charter, ["claude"]);
  const servedPrefixById = new Map(mcpOrigins.origins.flatMap(({ names }) => Object.entries(names)));
  const compiledDocumentById = new Map(compiledPrimitives.map((compiledPrimitive) => [compiledPrimitive.id, compiledPrimitive.projections[0]!.contents]));
  const entryFile = providerComponents.find((providerComponent) => providerComponent instanceof ClaudeEntryFile);

  return [
    ...(entryFile === undefined ? [] : [{ id: entryFile.path, kind: "charter", text: entryFile.document }]),
    { id: "CHARTER.md", kind: "charter", text: charterMd.projections[0]!.contents },
    ...charter.primitives.flatMap((primitive): MainContextText[] => {
      const claudeComponent = providerComponents.find(
        (providerComponent) =>
          (providerComponent instanceof ClaudeRule || providerComponent instanceof ClaudeSkill || providerComponent instanceof ClaudeAgent) &&
          providerComponent.name === primitive.normId,
      );
      const { id } = primitive.headers;
      if (primitive instanceof McpPrimitive) {
        const toolNames = primitive.headers.tools.map((tool) => `mcp__${ClaudeMcpConfig.cwMcpName}__${servedPrefixById.get(id)}__${tool}`);
        return [{ id, kind: primitive.kind, text: toolNames.join("\n") }];
      }
      if (claudeComponent instanceof ClaudeRule) {
        const { paths } = claudeComponent.headers;
        return [{ id, kind: primitive.kind, text: `${claudeComponent.document}${compiledDocumentById.get(id) ?? ""}`, ...(paths === undefined ? {} : { globs: paths }) }];
      }
      if (claudeComponent instanceof ClaudeSkill || claudeComponent instanceof ClaudeAgent) {
        const { name, description } = claudeComponent.headers;
        return [{ id, kind: primitive.kind, text: `${name}: ${description}` }];
      }
      return [];
    }),
  ];
}
