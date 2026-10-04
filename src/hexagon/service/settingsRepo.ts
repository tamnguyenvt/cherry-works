import { AGENT_PROVIDERS, isAgentProvider } from "../domain/models/AgentProvider.js";
import { SettingsFault } from "../domain/models/DomainFault.js";
import { WorkspaceSettingsSchema, WorkspaceSettings } from "../domain/models/WorkspaceSettings.js";
import { settingsFileIn } from "../domain/path.js";
import type { ForReadingFiles } from "../port/zdriven/ForReadingFiles.js";

/**
 * The one way a repository's settings are read: every use case comes through
 * here, so they are parsed in one place and one way.
 *
 * Takes the repository, the way a charter is loaded from one (FR-008): a
 * repository keeps one workspace, at `.cw/`, and a caller that had to name that
 * file could name the wrong one.
 *
 * Raises rather than collects. There is no half of these worth having — a build
 * compiles for whatever they name — so settings that are not JSON, hold the
 * wrong thing, or name an agent this engine cannot compile for are a
 * `SettingsFault`, and whoever asked files it under the settings file (FR-009).
 */
export async function loadSettings(repo: URL, fileReaders: ForReadingFiles): Promise<WorkspaceSettings> {
  const text = await fileReaders.readIfThere(settingsFileIn(repo));

  // No settings file at all is a repository that was never set up, and it still
  // has a charter: it compiles for no agent, which is the neutral surface every
  // reader gets whether a host is named or not (FR-019). A file that is there
  // and does not read is a different thing, and is refused below.
  if (text === undefined) return new WorkspaceSettings([]);

  let written: unknown;
  try {
    written = JSON.parse(text);
  } catch {
    throw new SettingsFault(
      `These are this repository's own settings and this is not JSON.`,
      `Correct it, or delete it and run "cw init" to write it again.`,
    );
  }

  const read = WorkspaceSettingsSchema.safeParse(written);
  if (!read.success) throw whatIsWrongWith(written);

  return new WorkspaceSettings(read.data.agents, read.data.mainContextCeiling, read.data.sessionAnalysisFolder);
}

/**
 * Why these settings did not read, said to whoever has to correct the file.
 *
 * Asked of the value rather than of the parser's issues: what an author needs
 * is which of the three things went wrong and what to write instead, and the
 * unknown names all at once so a correction takes one pass (FR-009). Only ever
 * called on a value the schema already refused.
 */
function whatIsWrongWith(written: unknown): SettingsFault {
  if (typeof written !== "object" || written === null || Array.isArray(written))
    return new SettingsFault(
      `These are this repository's own settings and this holds something other than a set of fields.`,
      `Write it as an object, as in { "agents": ["claude"] }.`,
    );

  const { agents, mainContextCeiling, sessionContextMark, sessionAnalysisFolder } = written as {
    agents?: unknown;
    mainContextCeiling?: unknown;
    sessionContextMark?: unknown;
    sessionAnalysisFolder?: unknown;
  };
  if (!Array.isArray(agents))
    return new SettingsFault(
      `"agents" is what this repository compiles its charter for, and it is not a list of names here.`,
      `Write it as a list of names, as in { "agents": ["claude"] }.`,
    );

  if (agents.every(isAgentProvider) && !WorkspaceSettingsSchema.shape.sessionAnalysisFolder.safeParse(sessionAnalysisFolder).success)
    return new SettingsFault(
      `"sessionAnalysisFolder" is where each session's tokens are kept on this machine, and ${JSON.stringify(sessionAnalysisFolder)} is no absolute path or path under "~/".`,
      `Write it as one, as in { "agents": ["claude"], "sessionAnalysisFolder": "~/.cherry-works/sessions" }, or drop it for a folder of this repository's own under ~/.cherry-works.`,
    );

  if (agents.every(isAgentProvider) && !WorkspaceSettingsSchema.shape.sessionContextMark.safeParse(sessionContextMark).success)
    return new SettingsFault(
      `"sessionContextMark" is every how many tokens a session says what it has used, and ${JSON.stringify(sessionContextMark)} is no whole number above 0.`,
      `Write it as one, as in { "agents": ["claude"], "sessionContextMark": 100000 }, or drop it for 100000.`,
    );

  if (agents.every(isAgentProvider))
    return new SettingsFault(
      `"mainContextCeiling" is the tokens past which the health check warns of the main context, and ${JSON.stringify(mainContextCeiling)} is no whole number above 0.`,
      `Write it as one, as in { "agents": ["claude"], "mainContextCeiling": 20000 }, or drop it for 20000.`,
    );

  return new SettingsFault(
    `This says it compiles for ${agents
      .filter((one) => !isAgentProvider(one))
      .map((one) => `"${String(one)}"`)
      .join(", ")}, and this engine compiles for no such agent.`,
    `Name any of ${AGENT_PROVIDERS.join(", ")}, or drop what is left.`,
  );
}
