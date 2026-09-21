import { AGENT_PROVIDERS, isAgentProvider } from "../domain/models/AgentProvider.js";
import { SettingsFault } from "../domain/models/Fault.js";
import { SETTINGS, WorkspaceSettings } from "../domain/models/Settings.js";
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

  const read = SETTINGS.safeParse(written);
  if (!read.success) throw whatIsWrongWith(written);

  return new WorkspaceSettings(read.data.agents);
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

  const agents = (written as { agents?: unknown }).agents;
  if (!Array.isArray(agents))
    return new SettingsFault(
      `"agents" is what this repository compiles its charter for, and it is not a list of names here.`,
      `Write it as a list of names, as in { "agents": ["claude"] }.`,
    );

  return new SettingsFault(
    `This says it compiles for ${agents
      .filter((one) => !isAgentProvider(one))
      .map((one) => `"${String(one)}"`)
      .join(", ")}, and this engine compiles for no such agent.`,
    `Name any of ${AGENT_PROVIDERS.join(", ")}, or drop what is left.`,
  );
}
