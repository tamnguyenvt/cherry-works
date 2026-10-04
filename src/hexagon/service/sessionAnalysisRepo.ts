import { SessionAnalysis } from "../domain/models/session/SessionAnalysis.js";
import { SessionAnalysisLineSchema } from "../domain/models/session/SessionAnalysisLine.js";
import type { SessionSpan } from "../domain/models/session/SessionSpan.js";
import { SESSION_LOG_FILE, sessionsFolderOf } from "../domain/path.js";
import type { ForReadingFiles } from "../port/zdriven/ForReadingFiles.js";
import { loadSettings } from "./settingsRepo.js";

/** How far a log's last write may sit outside a span's days and still hold a
 *  stop within them: a day each side, for this machine's clock against UTC. */
const SPAN_MARGIN_MS = 24 * 60 * 60 * 1000;

/**
 * The stops of the sessions kept for one repository on this machine that may
 * fall within the span, read off the folder `session-tokens-counter` keeps
 * them in (EVAL-FR-009), as a `SessionAnalysis`. A session's log is last written at
 * its last stop, so one last written outside the span is never read
 * (EVAL-SC-007). A folder that is not there is no stops; a line that does not
 * read as a stop is left out, as one the counter never finished writing.
 */
export async function loadSessionAnalysis(
  repo: URL,
  home: URL,
  fileReaders: ForReadingFiles,
  span: SessionSpan,
): Promise<SessionAnalysis> {
  const { sessionAnalysisFolder } = await loadSettings(repo, fileReaders);
  const sessionsFolder = sessionsFolderOf(repo, home, sessionAnalysisFolder);
  const spanStartMs = Date.parse(span.since) - SPAN_MARGIN_MS;
  // The span's last day ends a day after it starts.
  const spanEndMs = Date.parse(span.until) + 2 * SPAN_MARGIN_MS;
  // Each session keeps one folder of its own, its log directly in it: only
  // those are looked in, whatever else the folder holds.
  const listedLogFiles = (await Promise.all((await fileReaders.listFolders(sessionsFolder)).map((sessionFolder) => fileReaders.listFiles(sessionFolder)))).flat();
  const logTexts = await Promise.all(
    listedLogFiles
      .filter(({ file, modifiedAt }) => file.href.endsWith(`/${SESSION_LOG_FILE}`) && modifiedAt.getTime() >= spanStartMs && modifiedAt.getTime() <= spanEndMs)
      .map(({ file }) => fileReaders.readIfThere(file)),
  );
  const sessionAnalysisLines = logTexts.flatMap((logText) =>
    (logText ?? "").split("\n").flatMap((line) => {
      try {
        const sessionAnalysisLineParse = SessionAnalysisLineSchema.safeParse(JSON.parse(line));
        return sessionAnalysisLineParse.success ? [sessionAnalysisLineParse.data] : [];
      } catch {
        return [];
      }
    }),
  );
  return new SessionAnalysis(sessionsFolder, sessionAnalysisLines);
}
