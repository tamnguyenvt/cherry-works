import { pathFromCheckout } from "#module/shared/module.js";
import { WritePlan, StampedDocument, mergedTomlText, type CharterOutput, type CharterRoot, type MainContextText, type ProviderComponent } from "../../app/port/out/managing-local-agent-output.port.js";
import { mergedEntryFileText } from "../helper.js";
import { AgentProjection } from "../agent-projection.base.js";
import { CodexComponentFactory } from "./codex-component.factory.js";
import { CodexMainContextFactory } from "./codex-main-context.factory.js";
import { CodexRules } from "./codex-rules.js";

/** The file Codex reads before anything else, at the repository's root or
 *  in a folder of it. */
const CODEX_ENTRY_FILE = "AGENTS.md";

/** Where each of Codex's files lands, by its kind there and its id. */
const CODEX_PLACE_BY_KIND: Readonly<Record<string, (id: string) => string>> = {
  "entry-file": (folder) => (folder === "" ? CODEX_ENTRY_FILE : `${folder}/${CODEX_ENTRY_FILE}`),
  config: () => ".codex/config.toml",
  rules: () => CodexRules.path,
  agent: (name) => `.codex/agents/${name}.toml`,
  skill: (name) => `.agents/skills/${name}/SKILL.md`,
  "skill-policy": (name) => `.agents/skills/${name}/agents/openai.yaml`,
};

/** Folders no nested entry file is looked for in: the repository's own
 *  machinery and every host's. */
const UNSEARCHED_FOLDERS = [".git", ".cw", ".claude", ".codex", ".agents", "node_modules"];

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

  protected componentsOf(charter: CharterRoot, charterOutput: CharterOutput): readonly ProviderComponent[] {
    return CodexComponentFactory.create(charter, charterOutput);
  }

  protected placeOf(component: ProviderComponent): string {
    return CODEX_PLACE_BY_KIND[component.kind]!(component.id);
  }

  protected override contentsOf(component: ProviderComponent, laidText: string, currentText: string | undefined, place: string): string {
    switch (component.kind) {
      case "config":
        return mergedTomlText(currentText, laidText, place);
      case "entry-file":
        return mergedEntryFileText(currentText, laidText);
      default:
        return laidText;
    }
  }

  /** Every nested entry file carrying the stamp, each with the text that is
   *  the repository's own where some is: a stamped section does not make the
   *  text around it the build's (FR-020). Only folders are walked, not every
   *  file of the repository read. */
  protected override async planOtherCleanup(checkoutPath: string): Promise<readonly WritePlan[]> {
    const entryCleanupPlan: WritePlan[] = [];
    let entryFolderPaths = await this.fileReader.listFolders(checkoutPath);
    while (entryFolderPaths.length > 0) {
      const nextEntryFolderPaths: string[] = [];
      for (const entryFolderPath of entryFolderPaths) {
        const folderName = entryFolderPath.split("/").at(-1) ?? "";
        if (UNSEARCHED_FOLDERS.includes(folderName)) continue;
        const filePath = `${entryFolderPath}/${CODEX_ENTRY_FILE}`;
        const contents = await this.fileReader.readIfThere(filePath);
        if (contents !== undefined && StampedDocument.isStamped(contents)) {
          const userText = contents.replace(SECTION_PATTERN, "");
          entryCleanupPlan.push(
            new WritePlan(pathFromCheckout(checkoutPath, filePath), filePath, contents.includes("<!-- CHERRYWORKS START -->") && userText.trim() !== "" ? userText : undefined, contents),
          );
        }
        nextEntryFolderPaths.push(...(await this.fileReader.listFolders(entryFolderPath)));
      }
      entryFolderPaths = nextEntryFolderPaths;
    }
    return entryCleanupPlan;
  }

  mainContextTextsOf(charter: CharterRoot, charterOutput: CharterOutput): readonly MainContextText[] {
    return CodexMainContextFactory.create(charter, charterOutput, (codexEntryFile) => this.placeOf(codexEntryFile));
  }
}
