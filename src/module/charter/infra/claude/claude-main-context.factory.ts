import { McpPrimitive, type CharterOutput, type CharterRoot, type MainContextText } from "../../app/port/out/managing-local-agent-output.port.js";
import { laidTextOf } from "../helper.js";
import { ClaudeComponents } from "./claude-component.js";
import { ClaudeComponentFactory } from "./claude-component.factory.js";
import { ClaudeAgent } from "./claude-agent.js";
import { ClaudeEntryFile } from "./claude-entry-file.js";
import { ClaudeRule } from "./claude-rule.js";
import { ClaudeSkill } from "./claude-skill.js";
import { ClaudeMcpConfig } from "./claude-mcp-config.js";

/** Makes what claude's main context holds of a charter. */
export class ClaudeMainContextFactory {
  /**
   * What claude puts into its main context of this charter, as the text it is
   * sent (EVAL-FR-001, EVAL-FR-003), read off the files a build lays for it,
   * each laid at `placeOf` its file.
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
  static create(charter: CharterRoot, charterOutput: CharterOutput, placeOf: (claudeComponent: ClaudeEntryFile | ClaudeRule) => string): readonly MainContextText[] {
    const { charterMd, compiledPrimitives, mcpOrigins } = charterOutput;
    const claudeComponents = ClaudeComponentFactory.create(charter, charterOutput);
    const servedPrefixById = new Map(mcpOrigins.origins.flatMap(({ names }) => Object.entries(names)));
    const compiledPrimitiveById = new Map(compiledPrimitives.map((compiledPrimitive) => [compiledPrimitive.id, compiledPrimitive]));
    const entryFile = claudeComponents.find((claudeComponent) => claudeComponent instanceof ClaudeEntryFile);

    return [
      ...(entryFile === undefined ? [] : [{ id: placeOf(entryFile), kind: "charter", text: laidTextOf(entryFile.text, placeOf(entryFile)) }]),
      { id: "CHARTER.md", kind: "charter", text: charterMd.text },
      ...charter.primitives.filter((primitive) => primitive.supportsAgent(ClaudeComponents.agentProvider)).flatMap((primitive): MainContextText[] => {
        const claudeComponent = claudeComponents.find(
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
          const compiledPrimitive = compiledPrimitiveById.get(id);
          return [{ id, kind: primitive.kind, text: `${laidTextOf(claudeComponent.text, placeOf(claudeComponent))}${compiledPrimitive?.text ?? ""}`, ...(paths === undefined ? {} : { globs: paths }) }];
        }
        if (claudeComponent instanceof ClaudeSkill || claudeComponent instanceof ClaudeAgent) {
          const { name, description } = claudeComponent.headers;
          return [{ id, kind: primitive.kind, text: `${name}: ${description}` }];
        }
        return [];
      }),
    ];
  }

  private constructor() {}
}
