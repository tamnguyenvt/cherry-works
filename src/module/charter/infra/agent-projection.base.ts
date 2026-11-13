import { type ForReadingFiles, resolveCheckoutPath, resolveRepoPath } from "#module/shared/module.js";
import {
  type CharterOutput,
  type CharterRoot,
  type ForManagingLocalAgentOutput,
  type MainContextText,
  ProjectionPlan,
  type ProviderComponent,
  StampedDocumentSpec,
  WritePlan,
} from "../app/port/out/managing-local-agent-output.port.js";
import { resolveLaidText } from "./helper.js";

/**
 * What every agent's projection onto a repository's files does the same way:
 * each of the agent's files planned at its place over what is there now, each
 * stamped file the last build left in the agent's own folders taken away
 * where this one writes it no more, and the paths into the compiled output in
 * each written from where the file lands (FR-018, FR-020, CORE-FR-221). What
 * the files are, where each lands and how it goes over what is there is each
 * agent's own.
 */
export abstract class AgentProjection implements ForManagingLocalAgentOutput {
  protected readonly fileReader: ForReadingFiles;
  /** The checkout of the repository this agent's files are laid in, such as
   *  a worktree, by its path from the repository; none for the repository's own. */
  protected readonly checkoutFolder: string;

  constructor(fileReader: ForReadingFiles, checkoutFolder = "") {
    this.fileReader = fileReader;
    this.checkoutFolder = checkoutFolder;
  }

  /** The same projection over another checkout: each agent's builds itself,
   *  and refuses to build a class extending it, which builds itself in turn
   *  (EVAL-FR-021). */
  abstract createCheckoutProjection(checkoutFolder: string): ForManagingLocalAgentOutput;

  abstract readonly tokenFactor: number;

  /** The folders only this agent's files are in: every stamped file a build
   *  left there is the build's to take away (FR-020). */
  protected abstract readonly ownedFolders: readonly string[];

  /** Every file this agent reads of the charter (FR-018). */
  protected abstract listComponents(charter: CharterRoot, charterOutput: CharterOutput): readonly ProviderComponent[];

  /** Where one of this agent's files lands, from the repository's root. */
  protected abstract findComponentPlace(component: ProviderComponent): string;

  abstract listMainContextTexts(charter: CharterRoot, charterOutput: CharterOutput): readonly MainContextText[];

  /** What a file is once this build's part is written over `currentText`,
   *  what is there now: the charter's part alone, where the file is the
   *  charter's. */
  protected mergeComponentContents(
    _component: ProviderComponent,
    laidText: string,
    _currentText: string | undefined,
    _place: string,
  ): string {
    return laidText;
  }

  /** What else the last build left for this agent outside its own folders,
   *  each with what to write back where it is the repository's too. */
  protected async planOtherCleanup(_checkoutPath: string): Promise<readonly WritePlan[]> {
    return [];
  }

  async createAgentProjectionPlan(charter: CharterRoot, charterOutput: CharterOutput): Promise<ProjectionPlan> {
    const components = this.listComponents(charter, charterOutput);
    const checkoutPath = this.checkoutFolder;
    const [cleanupPlan, layingPlan] = await Promise.all([
      // Every stamped file the last build left in this agent's own folders —
      // the stamp is what tells it from one written by hand there — and what
      // else it left for this agent (FR-020).
      (async (): Promise<readonly WritePlan[]> => {
        const folderFileLists = await Promise.all(
          this.ownedFolders.map((folderPath) =>
            this.fileReader.readFilesRecursively(resolveRepoPath(checkoutPath, folderPath)),
          ),
        );
        return [
          ...folderFileLists
            .flat()
            .filter(({ contents }) => new StampedDocumentSpec().isSatisfiedBy(contents))
            .map(
              ({ path, contents }) => new WritePlan(resolveCheckoutPath(checkoutPath, path), path, undefined, contents),
            ),
          ...(await this.planOtherCleanup(checkoutPath)),
        ];
      })(),
      // Every file of this agent the output would write, one entry to a path,
      // with what is there now read beside it (FR-018, FR-051).
      (async (): Promise<readonly WritePlan[]> => {
        const writePlanByPath = new Map<string, WritePlan>();
        for (const component of components) {
          const place = this.findComponentPlace(component);
          const filePath = resolveRepoPath(checkoutPath, place);
          const heldContents = await this.fileReader.readIfThere(filePath);
          const plannedContents = writePlanByPath.get(place)?.contents;
          const currentText = typeof plannedContents === "string" ? plannedContents : heldContents;
          const contents = this.mergeComponentContents(
            component,
            resolveLaidText(component.text, place),
            currentText,
            place,
          );
          writePlanByPath.set(place, new WritePlan(place, filePath, contents, heldContents, false));
        }
        return [...writePlanByPath.values()];
      })(),
    ]);
    // A file the last build wrote and this one takes only part of — an entry
    // file whose own text stays — is written back as that text.
    const preservedFiles = cleanupPlan.filter(
      (writePlan) =>
        writePlan.contents !== undefined && !layingPlan.some((layingFile) => layingFile.path === writePlan.path),
    );
    return new ProjectionPlan(
      components.flatMap((component) => component.warnings),
      cleanupPlan,
      [...layingPlan, ...preservedFiles],
    );
  }
}
