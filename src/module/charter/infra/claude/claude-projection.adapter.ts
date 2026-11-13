import {
  type CharterOutput,
  type CharterRoot,
  type MainContextText,
  type ProviderComponent,
  UnbuiltCheckoutAdapterFault,
} from "../../app/port/out/managing-local-agent-output.port.js";
import { AgentProjection } from "../agent-projection.base.js";
import { mergeEntryFileText, mergeSettingsText } from "../helper.js";
import { ClaudeComponentFactory } from "./claude-component.factory.js";
import { ClaudeMainContextFactory } from "./claude-main-context.factory.js";

/** The file claude reads before anything else, at the repository's root or
 *  in a folder of it. */
const CLAUDE_ENTRY_FILE = "CLAUDE.md";

/** Where each of claude's files lands, by its kind there and its id. */
const CLAUDE_PLACE_BY_KIND: Readonly<Record<string, (id: string) => string>> = {
  "entry-file": (folderPath) => (folderPath === "" ? CLAUDE_ENTRY_FILE : `${folderPath}/${CLAUDE_ENTRY_FILE}`),
  settings: () => ".claude/settings.json",
  "mcp-config": () => ".mcp.json",
  rule: (name) => `.claude/rules/${name}.md`,
  agent: (name) => `.claude/agents/${name}.md`,
  skill: (name) => `.claude/skills/${name}/SKILL.md`,
};

/**
 * How many of claude's tokens one token of the tokenizer on this machine
 * stands for: what the estimate is scaled by to come within 15% of an exact
 * count (EVAL-SC-002). Fitted on an earlier state of this repository's
 * charter; `cw context --exact --agent=claude` checks it against the real `claude`.
 */
const CLAUDE_TOKEN_FACTOR = 1.43;

/**
 * DRIVEN ADAPTER: a charter projected onto Claude Code — its rules, skills,
 * subagents, settings and MCP configuration under the folders it reads, and
 * the charter's section of `CLAUDE.md` (FR-018, FR-051, CORE-FR-221).
 *
 * How a file goes over what is there is decided by its kind. A file the
 * charter owns is replaced. The settings and the MCP configuration, which the
 * charter shares with the repository, are merged into: the fields the charter
 * speaks for are its, and every other is left as it was (FR-018). And the
 * entry file, which is the repository's, has the charter's section written in
 * place (FR-051).
 */
export class ClaudeProjection extends AgentProjection {
  readonly tokenFactor = CLAUDE_TOKEN_FACTOR;

  protected readonly ownedFolders = [".claude"];

  /** This projection over a checkout. A class extending it is refused, never
   *  built as this one: it builds itself over the checkout, by its own
   *  constructor (EVAL-FR-021). */
  createCheckoutProjection(checkoutFolder: string): ClaudeProjection {
    if (this.constructor !== ClaudeProjection)
      throw new UnbuiltCheckoutAdapterFault(
        `${this.constructor.name} extends ClaudeProjection and builds no copy of itself over the checkout "${checkoutFolder}".`,
        `Override createCheckoutProjection in ${this.constructor.name} to build it over the checkout.`,
      );
    return new ClaudeProjection(this.fileReader, checkoutFolder);
  }

  protected listComponents(charter: CharterRoot, charterOutput: CharterOutput): readonly ProviderComponent[] {
    return ClaudeComponentFactory.create(charter, charterOutput);
  }

  protected findComponentPlace(component: ProviderComponent): string {
    return CLAUDE_PLACE_BY_KIND[component.kind]!(component.id);
  }

  protected override mergeComponentContents(
    component: ProviderComponent,
    laidText: string,
    currentText: string | undefined,
  ): string {
    switch (component.kind) {
      case "settings":
      case "mcp-config":
        return mergeSettingsText(currentText, laidText);
      case "entry-file":
        return mergeEntryFileText(currentText, laidText);
      default:
        return laidText;
    }
  }

  listMainContextTexts(charter: CharterRoot, charterOutput: CharterOutput): readonly MainContextText[] {
    return ClaudeMainContextFactory.create(charter, charterOutput, (claudeComponent) =>
      this.findComponentPlace(claudeComponent),
    );
  }
}
