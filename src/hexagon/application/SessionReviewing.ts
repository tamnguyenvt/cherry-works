import { sessionSpanOf } from "../domain/models/session/SessionSpan.js";
import type { OutcomeDTOs } from "../port/driver/dtos/index.js";
import type { ForReviewingSessions } from "../port/driver/ForReviewingSessions.js";
import type { ForReadingFiles } from "../port/zdriven/ForReadingFiles.js";
import type { ForTellingTime } from "../port/zdriven/ForTellingTime.js";
import { loadSessionAnalysis } from "../service/sessionAnalysisRepo.js";
import { sessionReviewOutcomeDTO } from "./dtos.js";

/**
 * APPLICATION SERVICE — the sessions kept on this machine for one repository,
 * read back (EVAL-FR-012, EVAL-FR-013).
 *
 * Reads and says: it is handed no writing port (FR-041). Where the log is
 * kept is `sessionAnalysisRepo`'s; how it is summed up is `SessionAnalysis`'s.
 */
export class SessionReviewing implements ForReviewingSessions {
  readonly #repoPath: URL;
  readonly #homePath: URL;
  readonly #fileReader: ForReadingFiles;
  readonly #clock: ForTellingTime;

  constructor(
    /** The repository whose sessions are read back. */
    repoPath: URL,
    /** The developer's home folder, which the sessions are kept under unless
     *  the repository names a folder of its own. */
    homePath: URL,
    fileReader: ForReadingFiles,
    /** What today is, which the span is the last 31 days to when none is
     *  named (EVAL-FR-030). */
    clock: ForTellingTime,
  ) {
    this.#repoPath = repoPath;
    this.#homePath = homePath;
    this.#fileReader = fileReader;
    this.#clock = clock;
  }

  async sessionSummary(since?: string, until?: string): Promise<OutcomeDTOs.SessionReviewOutcome> {
    const sessionSpan = sessionSpanOf(this.#clock.now(), since, until);
    const sessionAnalysis = await loadSessionAnalysis(this.#repoPath, this.#homePath, this.#fileReader, sessionSpan);
    return sessionReviewOutcomeDTO(sessionAnalysis, sessionAnalysis.summarize(sessionSpan), sessionAnalysis.summarizeByDay(sessionSpan));
  }
}
