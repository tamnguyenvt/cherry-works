import type { InMemoryFileReaders } from "../../../shared/infra.js";
import type {
  ForRunningPromptfoo,
  PromptfooLog,
  PromptfooTest,
  PromptfooTestResult,
} from "../../app/port/out/running-promptfoo.port.js";

/**
 * promptfoo held in memory: installed or not, as a test says, and each test
 * answered with the result a test set for its prompt, or one that passed with
 * no token where none was. Every test it was handed is kept, in order, with
 * every file under its working folder at the time where `workingFolderFileReaders` was set.
 */
export class InMemoryPromptfoo implements ForRunningPromptfoo {
  readonly installFolderPath = "~/.cherry-works/promptfoo/test";
  /** How many times it was installed. */
  installCount = 0;
  readonly savedLogs: PromptfooLog[] = [];
  readonly resultByPrompt = new Map<string, PromptfooTestResult>();
  readonly evaluatedTests: (PromptfooTest & { readonly builtFilePaths: readonly string[] })[] = [];
  /** The files a test's working folder is read from, set by a test asking
   *  what was in it. */
  workingFolderFileReaders: InMemoryFileReaders | undefined;

  constructor(private isPromptfooInstalled: boolean = true) {}

  async isInstalled(): Promise<boolean> {
    return this.isPromptfooInstalled;
  }

  async installPromptfoo(): Promise<void> {
    this.installCount++;
    this.isPromptfooInstalled = true;
  }

  async readLogs(logFilePath?: string): Promise<readonly PromptfooLog[]> {
    return this.savedLogs.filter((savedLog) => logFilePath === undefined || savedLog.logPath === logFilePath);
  }

  async evaluateTest(promptfooTest: PromptfooTest): Promise<PromptfooTestResult> {
    const folderReadFiles =
      this.workingFolderFileReaders === undefined
        ? []
        : await this.workingFolderFileReaders.readFilesRecursively(promptfooTest.workingPath);
    this.evaluatedTests.push({ ...promptfooTest, builtFilePaths: folderReadFiles.map(({ path }) => path) });
    return this.resultByPrompt.get(promptfooTest.prompt) ?? { success: true, totalTokens: 0, componentResults: [] };
  }
}
