import { resolveCheckoutPath } from "#module/shared/module.js";
import {
  type CharterOutput,
  type CharterRoot,
  type MainContextText,
  type ProviderComponent,
  StampedDocumentSpec,
  TomlLib,
  UnbuiltCheckoutAdapterFault,
  WritePlan,
} from "../../app/port/out/managing-local-agent-output.port.js";
import { AgentProjection } from "../agent-projection.base.js";
import { mergeEntryFileText, rewriteDeprecatedSensorHooks } from "../helper.js";
import { CodexComponentFactory } from "./codex-component.factory.js";
import { CodexMainContextFactory } from "./codex-main-context.factory.js";
import { CodexRules } from "./codex-rules.js";

/** The file Codex reads before anything else, at the repository's root or
 *  in a folder of it. */
const CODEX_ENTRY_FILE_NAME = "AGENTS.md";

/** Where each of Codex's files lands, by its kind there and its id. */
const CODEX_PLACE_BY_KIND: Readonly<Record<string, (id: string) => string>> = {
  "entry-file": (folderPath) => (folderPath === "" ? CODEX_ENTRY_FILE_NAME : `${folderPath}/${CODEX_ENTRY_FILE_NAME}`),
  config: () => ".codex/config.toml",
  rules: () => CodexRules.path,
  agent: (componentId) => `.codex/agents/${componentId}.toml`,
  skill: (componentId) => `.agents/skills/${componentId}/SKILL.md`,
  "skill-policy": (componentId) => `.agents/skills/${componentId}/agents/openai.yaml`,
};

/** Folders no nested entry file is looked for in: the repository's own
 *  machinery and every agent's. */
const UNSEARCHED_FOLDER_NAMES = [".git", ".cw", ".claude", ".codex", ".agents", "node_modules"];

/** The configuration's tables whose every entry the charter gives is the
 *  charter's whole: the hook groups under each signal its sensors name
 *  (CORE-FR-039). */
const CHARTER_WHOLE_TABLE_PATHS = ["hooks"];

/** What starts and ends the charter's section of an entry file. */
const SECTION_PATTERN = /<!-- CHERRYWORKS START -->[\s\S]*?<!-- CHERRYWORKS END -->\n?/g;

/**
 * DRIVEN ADAPTER: a charter projected onto Codex — its skills, subagents,
 * command rules and configuration under the folders it reads, and the
 * charter's section of `AGENTS.md`, at the repository's root and in each
 * folder a guide's globs name (FR-018, FR-051, CORE-FR-221).
 *
 * How a file goes over what is there is decided by its kind. A file the
 * charter owns is replaced; the configuration, which the charter shares with
 * the repository, is merged into, every table the charter does not speak for
 * left as it was (FR-018); and an entry file, which is the repository's, has
 * the charter's section written in place (FR-051).
 */
export class CodexProjection extends AgentProjection {
  readonly tokenFactor = 1;

  protected readonly ownedFolders = [".codex", ".agents/skills"];

  /** This projection over a checkout. A class extending it is refused, never
   *  built as this one: it builds itself over the checkout, by its own
   *  constructor (EVAL-FR-021). */
  createCheckoutProjection(checkoutFolder: string): CodexProjection {
    if (this.constructor !== CodexProjection)
      throw new UnbuiltCheckoutAdapterFault(
        `${this.constructor.name} extends CodexProjection and builds no copy of itself over the checkout "${checkoutFolder}".`,
        `Override createCheckoutProjection in ${this.constructor.name} to build it over the checkout.`,
      );
    return new CodexProjection(this.fileReader, checkoutFolder);
  }

  protected listComponents(charter: CharterRoot, charterOutput: CharterOutput): readonly ProviderComponent[] {
    return CodexComponentFactory.create(charter, charterOutput);
  }

  protected findComponentPlace(component: ProviderComponent): string {
    return CODEX_PLACE_BY_KIND[component.kind]!(component.id);
  }

  protected override mergeComponentContents(
    component: ProviderComponent,
    laidText: string,
    currentText: string | undefined,
    place: string,
  ): string {
    switch (component.kind) {
      case "config":
        return rewriteDeprecatedSensorHooks(
          TomlLib.mergeTomlText(currentText, laidText, place, CHARTER_WHOLE_TABLE_PATHS),
        );
      case "entry-file":
        return mergeEntryFileText(currentText, laidText);
      default:
        return laidText;
    }
  }

  /** Every nested entry file carrying the stamp, each with the text that is
   *  the repository's own where some is: a stamped section does not make the
   *  text around it the build's (FR-020). Only folders are walked, not every
   *  file of the repository read. */
  protected override async planOtherCleanup(checkoutFolder: string): Promise<readonly WritePlan[]> {
    const entryCleanupWritePlans: WritePlan[] = [];
    let entryFolderPaths = await this.fileReader.listFolders(checkoutFolder);
    while (entryFolderPaths.length > 0) {
      const nextEntryFolderPaths: string[] = [];
      for (const entryFolderPath of entryFolderPaths) {
        const folderName = entryFolderPath.split("/").at(-1) ?? "";
        if (UNSEARCHED_FOLDER_NAMES.includes(folderName)) continue;
        const filePath = `${entryFolderPath}/${CODEX_ENTRY_FILE_NAME}`;
        const contents = await this.fileReader.readIfThere(filePath);
        if (contents !== undefined && new StampedDocumentSpec().isSatisfiedBy(contents)) {
          const userText = contents.replace(SECTION_PATTERN, "");
          entryCleanupWritePlans.push(
            new WritePlan(
              resolveCheckoutPath(checkoutFolder, filePath),
              filePath,
              contents.includes("<!-- CHERRYWORKS START -->") && userText.trim() !== "" ? userText : undefined,
              contents,
            ),
          );
        }
        nextEntryFolderPaths.push(...(await this.fileReader.listFolders(entryFolderPath)));
      }
      entryFolderPaths = nextEntryFolderPaths;
    }
    return entryCleanupWritePlans;
  }

  listMainContextTexts(charter: CharterRoot, charterOutput: CharterOutput): readonly MainContextText[] {
    return CodexMainContextFactory.create(charter, charterOutput, (codexEntryFile) =>
      this.findComponentPlace(codexEntryFile),
    );
  }
}
