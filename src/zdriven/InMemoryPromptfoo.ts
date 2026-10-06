import type { ForRunningPromptfoo, PromptfooTest, PromptfooTestResult } from "#hexagon/port/zdriven/ForRunningPromptfoo.js";
import type { InMemoryFileReaders } from "./InMemoryFileReaders.js";

/**
 * promptfoo held in memory: installed or not, as a test says, and each test
 * answered with the result a test set for its prompt, or one that passed with
 * no token where none was. Every test it was handed is kept, in order, with
 * every file under its working folder at the time where `folderFiles` was set.
 */
export class InMemoryPromptfoo implements ForRunningPromptfoo {
  readonly installFolderPath = "~/.cherry-works/promptfoo/test";
  /** How many times it was installed. */
  installCount = 0;
  readonly resultByPrompt = new Map<string, PromptfooTestResult>();
  readonly evaluatedTests: (PromptfooTest & { readonly builtFiles: readonly string[] })[] = [];
  /** The files a test's working folder is read from, set by a test asking
   *  what was in it. */
  folderFiles: InMemoryFileReaders | undefined;

  constructor(private installed: boolean = true) {}

  async isInstalled(): Promise<boolean> {
    return this.installed;
  }

  async install(): Promise<void> {
    this.installCount++;
    this.installed = true;
  }

  async evaluate(promptfooTest: PromptfooTest): Promise<PromptfooTestResult> {
    const folderReadFiles = this.folderFiles === undefined ? [] : await this.folderFiles.readFilesRecursively(promptfooTest.workingFolder);
    this.evaluatedTests.push({ ...promptfooTest, builtFiles: folderReadFiles.map(({ file }) => file.href) });
    return this.resultByPrompt.get(promptfooTest.prompt) ?? { success: true, totalTokens: 0, componentResults: [] };
  }
}
