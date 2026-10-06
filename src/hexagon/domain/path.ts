import type { AgentProvider } from "./models/AgentProvider.js";
import { DomainFault } from "./models/DomainFault.js";

declare const folder: unique symbol;

/**
 * A URL that names a folder rather than a file.
 *
 * A plain `URL` cannot say which it is — `file:///repo/.cw/charter` and
 * `file:///repo/.cw/charter/` are both valid, and only the second resolves
 * `guide/no-any.md` under it — so the distinction is a type the compiler can
 * hold, and `folderURL` is the only way to obtain one.
 */
export type FolderURL = URL & { readonly [folder]: true };

/** A folder URL from a URL or its text, refused unless it already ends in the
 *  separator a folder needs. Refused rather than corrected: adding the
 *  separator would make `file:///repo/.cw/charter` and a URL that really does
 *  name a file indistinguishable, and the caller is the one that knows which
 *  it meant. */
export function folderURL(at: URL | string): FolderURL {
  const url = new URL(at);
  if (!url.pathname.endsWith("/"))
    throw new DomainFault(
      `"${url.href}" names a file, and a folder is what is wanted here.`,
      `Write it with the separator a folder ends in, as in "${url.href}/".`,
    );
  return url as FolderURL;
}

/**
 * Where a repository keeps everything this engine reads and writes (plan §3).
 *
 * One directory holds all three: what the repository configured itself with,
 * the charter it authored, and what the charter compiles to. Named here and
 * nowhere else, so the directory the settings are read from, the one a charter
 * is loaded from and the one a build owns are the same string rather than three
 * that drift.
 */
export const WORKSPACE_DIRECTORY = ".cw";

/** The charter itself: a directory per kind, and the layers installed under
 *  `vendor/`. The only part of the workspace a person authors. */
export const CHARTER_DIRECTORY = `${WORKSPACE_DIRECTORY}/charter`;

/** What this repository installed from someone else, one folder per vendor
 *  (FR-023, FR-024). Beside the charter rather than inside it: what a vendor
 *  published is read-only and git-ignored, and what this repository authored is
 *  neither. */
export const VENDOR_DIRECTORY = `${WORKSPACE_DIRECTORY}/vendor`;

/** The situations this repository pins its charter down with, one file of cases
 *  each (FR-047). Beside the charter rather than inside it: a test is not a
 *  primitive, nothing compiles it and no agent is instructed by it, so it is
 *  read only when tests run. */
export const TEST_DIRECTORY = `${WORKSPACE_DIRECTORY}/test`;

/** The cases this repository evaluates its charter by against the real agent,
 *  one file of cases each (EVAL-FR-020). Beside the tests rather than inside
 *  them: a test is resolved offline, and an evaluation spends a key. */
export const EVAL_DIRECTORY = `${WORKSPACE_DIRECTORY}/eval`;

/** What one reading of the charter compiles to. Everything under it is
 *  generated, which is what makes a build's deleting safe (FR-020). */
export const OUT_DIRECTORY = `${WORKSPACE_DIRECTORY}/out`;

/** What the repository answered at setup, beside the charter rather than inside
 *  it: settings are the repository's, and the charter is what they configure
 *  (FR-037, FR-038). */
export const SETTINGS_FILE = `${WORKSPACE_DIRECTORY}/settings.json`;

/** The folder one repository keeps its own charter in. */
export function charterFolderIn(repo: URL): FolderURL {
  return folderIn(repo, CHARTER_DIRECTORY);
}

/** The folder one build writes everything it compiles into. */
export function outFolderIn(repo: URL): FolderURL {
  return folderIn(repo, OUT_DIRECTORY);
}

/** Where claude reads everything of its own from. Named here with the rest of the
 *  folders one repository holds, since that is what it is: a folder beside `.cw/`
 *  rather than inside it. */
export const CLAUDE_DIRECTORY = ".claude";

/** The file claude reads before it is asked to read anything, at the root of the
 *  repository rather than under its own folder. The charter reaches an agent
 *  through it: one section inside it says where the orientation is, and the
 *  rest of the file is the repository's (FR-051). */
export const CLAUDE_ENTRY_FILE = "CLAUDE.md";

/** The servers claude starts for a project, at the root of the repository
 *  beside its entry file. The charter keeps one entry in it, and the rest of the
 *  file is the repository's (FR-146). */
export const CLAUDE_MCP_CONFIG_FILE = ".mcp.json";

/**
 * The folder one agent this engine compiles for reads everything of its own
 * from (FR-018).
 *
 * Not part of the workspace, and named here all the same: `.cw/` is what this
 * repository keeps for itself, and a host's directory is the host's — but both
 * are folders under one repository, and a build that writes into one and takes
 * files out of the other reads where they are in one place.
 */
export function agentProviderFolderIn(repo: URL, provider: AgentProvider): FolderURL {
  switch (provider) {
    case "claude":
      return folderIn(repo, CLAUDE_DIRECTORY);
  }
}

/** The folder one repository keeps its self-regression tests in. */
export function testFolderIn(repo: URL): FolderURL {
  return folderIn(repo, TEST_DIRECTORY);
}

/** The folder one repository keeps its evaluation cases in. */
export function evalFolderIn(repo: URL): FolderURL {
  return folderIn(repo, EVAL_DIRECTORY);
}

/** The folder, under the cases, that every case runs in a worktree of its own
 *  under, which version control is told to ignore (EVAL-FR-021). */
export const EVAL_WORKTREES_DIRECTORY = ".worktrees";

/** What version control is told to ignore of the workspace, written at setup
 *  (EVAL-FR-021). */
export const WORKSPACE_GITIGNORE_FILE = `${WORKSPACE_DIRECTORY}/.gitignore`;

/** The line of it that keeps the evaluation worktrees out of version control,
 *  named from the workspace. */
export const EVAL_WORKTREES_GITIGNORE_LINE = `${EVAL_DIRECTORY.slice(`${WORKSPACE_DIRECTORY}/`.length)}/${EVAL_WORKTREES_DIRECTORY}/`;

/** The folder every evaluation worktree of one repository is added under. */
export function evalWorktreesFolderIn(repo: URL): FolderURL {
  return folderIn(repo, `${EVAL_DIRECTORY}/${EVAL_WORKTREES_DIRECTORY}`);
}

/** The folder it keeps every vendor it installed in, one directory each. */
export function vendorFolderIn(repo: URL): FolderURL {
  return folderIn(repo, VENDOR_DIRECTORY);
}

/** One folder of the workspace, under the repository holding it. A repository
 *  named without its trailing separator still means the directory, and only a
 *  directory resolves anything under it. */
function folderIn(repo: URL, directory: string): FolderURL {
  return folderURL(new URL(`${directory}/`, repo.href.endsWith("/") ? repo : new URL(`${repo.href}/`)));
}

/** Where one repository keeps them. A repository named without its trailing
 *  separator still means the directory, and only a directory resolves
 *  `.cw/settings.json` under it — so the joining is done here, once, rather
 *  than by everyone who has to name the file a fault is filed under. */
export function settingsFileIn(repo: URL): URL {
  return new URL(SETTINGS_FILE, repo.href.endsWith("/") ? repo : new URL(`${repo.href}/`));
}

/** What each session's folder keeps its stops in, one line each (EVAL-FR-009). */
export const SESSION_LOG_FILE = "session-analysis.jsonl";

/**
 * The folder one repository's sessions are kept in on this machine, a folder
 * per session id under it, as `cw-session-tokens-counter` keeps them
 * (EVAL-FR-009): the `sessionAnalysisFolder` the repository set, an absolute
 * path or one under `~/`, or else `~/.cherry-works/` and the repository's
 * path, each character that is not a letter or a digit a dash. The counter
 * names it the same way, from the folder the agent ran in.
 */
export function sessionsFolderOf(repo: URL, home: URL, sessionAnalysisFolder?: string): FolderURL {
  const homeFolder = home.href.endsWith("/") ? home : new URL(`${home.href}/`);
  if (sessionAnalysisFolder === undefined) {
    const repoFolder = decodeURIComponent(repo.pathname).replace(/\/$/, "");
    return folderURL(new URL(`.cherry-works/${repoFolder.replace(/[^A-Za-z0-9]/g, "-")}/`, homeFolder));
  }
  const sessionsFolderPath = sessionAnalysisFolder.endsWith("/") ? sessionAnalysisFolder : `${sessionAnalysisFolder}/`;
  return folderURL(
    sessionsFolderPath.startsWith("~/")
      ? new URL(sessionsFolderPath.slice(2).split("/").map(encodeURIComponent).join("/"), homeFolder)
      : new URL(`file://${sessionsFolderPath.split("/").map(encodeURIComponent).join("/")}`),
  );
}
