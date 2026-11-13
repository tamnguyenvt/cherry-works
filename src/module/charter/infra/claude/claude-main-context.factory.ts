import {
  CharterMd,
  type CharterOutput,
  type CharterRoot,
  CompiledPrimitive,
  MainContextText,
  McpOrigins,
  McpPrimitive,
} from "../../app/port/out/managing-local-agent-output.port.js";
import { resolveLaidText } from "../helper.js";
import { ClaudeAgent } from "./claude-agent.js";
import { ClaudeComponentFactory } from "./claude-component.factory.js";
import { ClaudeComponents } from "./claude-component.js";
import { ClaudeEntryFile } from "./claude-entry-file.js";
import { ClaudeMcpConfig } from "./claude-mcp-config.js";
import { ClaudeRule } from "./claude-rule.js";
import { ClaudeSkill } from "./claude-skill.js";

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
   * alone, under the mcp: the agent's tool search, which the build turns on,
   * sends a schema only once the agent searches for it (EVAL-FR-029).
   */
  static create(
    charter: CharterRoot,
    charterOutput: CharterOutput,
    placeOf: (claudeComponent: ClaudeEntryFile | ClaudeRule) => string,
  ): readonly MainContextText[] {
    const charterMd = charterOutput.findCharterOutputItem(CharterMd);
    const compiledPrimitives = charterOutput.charterOutputItems.filter(
      (charterOutputItem): charterOutputItem is CompiledPrimitive => charterOutputItem instanceof CompiledPrimitive,
    );
    const mcpOrigins = charterOutput.findCharterOutputItem(McpOrigins);
    const claudeComponents = ClaudeComponentFactory.create(charter, charterOutput);
    const servedPrefixById = new Map(mcpOrigins.origins.flatMap(({ names }) => Object.entries(names)));
    const compiledPrimitiveById = new Map(
      compiledPrimitives.map((compiledPrimitive) => [compiledPrimitive.id, compiledPrimitive]),
    );
    const entryFile = claudeComponents.find((claudeComponent) => claudeComponent instanceof ClaudeEntryFile);

    return [
      ...(entryFile === undefined
        ? []
        : [new MainContextText(placeOf(entryFile), "charter", resolveLaidText(entryFile.text, placeOf(entryFile)))]),
      new MainContextText("CHARTER.md", "charter", charterMd.text),
      ...charter.primitives
        .filter((primitive) => primitive.supportsAgent(ClaudeComponents.agentProvider))
        .flatMap((primitive): MainContextText[] => {
          const claudeComponent = claudeComponents.find(
            (providerComponent) =>
              (providerComponent instanceof ClaudeRule ||
                providerComponent instanceof ClaudeSkill ||
                providerComponent instanceof ClaudeAgent) &&
              providerComponent.name === primitive.normId,
          );
          const { id } = primitive.headers;
          if (primitive instanceof McpPrimitive) {
            const toolNames = primitive.headers.tools.map(
              (tool) => `mcp__${ClaudeMcpConfig.cwMcpName}__${servedPrefixById.get(id)}__${tool}`,
            );
            return [new MainContextText(id, primitive.kind, toolNames.join("\n"))];
          }
          if (claudeComponent instanceof ClaudeRule) {
            const { paths } = claudeComponent.headers;
            const compiledPrimitive = compiledPrimitiveById.get(id);
            return [
              new MainContextText(
                id,
                primitive.kind,
                `${resolveLaidText(claudeComponent.text, placeOf(claudeComponent))}${compiledPrimitive?.text ?? ""}`,
                paths,
              ),
            ];
          }
          if (claudeComponent instanceof ClaudeSkill || claudeComponent instanceof ClaudeAgent) {
            const { name, description } = claudeComponent.headers;
            return [new MainContextText(id, primitive.kind, `${name}: ${description}`)];
          }
          return [];
        }),
    ];
  }

  private constructor() {}
}
