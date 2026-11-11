import assert from "node:assert/strict";
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";
import packageJson from "../package.json" with { type: "json" };

/** What one command printed and how it ended. */
export interface CommandAnswer {
  args: string;
  status: number | null;
  stdout: string;
  stderr: string;
}

/** What the portal sent back for one request the page makes. */
export interface PortalAnswer {
  request: string;
  status: number;
  body: string;
}

/** Every answer a developer meets, running every command that needs neither
 *  the network nor an agent in turn, then the portal's every route: what each
 *  printed or sent, and the files the repository is left holding. */
export interface AnswersOfEveryCommand {
  commandAnswers: CommandAnswer[];
  portalAnswers: PortalAnswer[];
  repoFiles: Record<string, string>;
}

/** A git source on disk holding one skill, committed at a fixed time by a
 *  fixed author, so its commit is the same on every run. */
const VENDOR_SKILL_TEXT = "---\nname: grill-me\ndescription: Ask questions until the plan holds.\n---\n\nAsk.\n";

/** Each command in the order a developer meets them, each over the repository
 *  the ones before it left; `<vendor>` is the git source of one skill, and
 *  `<listed vendor>` the name `cw vendor list` last gave its folder. */
const COMMAND_ARGS: readonly (readonly string[])[] = [
  ["--help"],
  ["--version"],
  ["init", "--agent", "claude"],
  ["kinds"],
  ["kinds", "guide"],
  ["add", "guide", "plain-words", "--header", "description=Write in plain words.", "--header", "globs=src/**/*.ts"],
  ["add", "skill", "ask-first", "--header", "description=Ask before guessing.", "--header", "triggers=ask first"],
  ["list"],
  ["explain", "plain-words"],
  ["edit", "plain-words"],
  ["suite", "add"],
  ["suite", "edit", "untitled-1.json"],
  ["test"],
  ["suite", "remove", "untitled-1.json"],
  ["build"],
  ["doctor"],
  ["context"],
  ["sessions"],
  ["eval-analyze"],
  ["vendor", "add", "<vendor>"],
  ["vendor", "list"],
  ["build"],
  ["vendor", "remove", "<listed vendor>"],
  ["vendor", "inject", "<vendor>"],
  ["list"],
  ["sensor", "run", "Stop"],
  ["mcp", "auth"],
  ["mcp", "serve"],
  ["remove", "plain-words", "--yes"],
  ["build"],
  ["doctor"],
];

/** The portal's requests, in the order the page makes them as a developer
 *  reads, adds, changes and removes; `<id>` is a primitive the requests add. */
const PORTAL_REQUESTS: readonly { method: string; path: string; body?: unknown }[] = [
  { method: "GET", path: "/" },
  { method: "GET", path: "/styles.css" },
  { method: "GET", path: "/logo.png" },
  { method: "GET", path: "/api/settings" },
  { method: "GET", path: "/api/charter/root/faults" },
  { method: "GET", path: "/api/charter/root/primitives" },
  { method: "GET", path: "/api/definitions/kinds" },
  { method: "GET", path: "/api/definitions/kinds/guide/requirements" },
  {
    method: "POST",
    path: "/api/charter/root/primitives",
    body: {
      kind: "guide",
      id: "short-lines",
      headers: { description: "Keep lines short.", globs: ["src/**/*.ts"] },
      body: "Keep lines short.\n",
    },
  },
  { method: "GET", path: "/api/charter/root/primitives/short-lines" },
  { method: "GET", path: "/api/charter/root/primitives/short-lines/explanation" },
  {
    method: "PUT",
    path: "/api/charter/root/primitives/short-lines",
    body: {
      headers: { description: "Keep lines under a hundred characters.", globs: ["src/**/*.ts"] },
      body: "Keep lines short.\n",
    },
  },
  { method: "GET", path: "/api/charter/root/build" },
  { method: "POST", path: "/api/charter/root/build", body: {} },
  { method: "GET", path: "/api/charter/root/health" },
  { method: "GET", path: "/api/charter/root/context" },
  { method: "GET", path: "/api/test-suites" },
  { method: "POST", path: "/api/test-suites", body: {} },
  {
    method: "PUT",
    path: "/api/test-suites/untitled-1.json",
    body: { text: '{"cases":[{"do":{"touchFile":"src/one.ts"},"expect":{"activate":"short-lines"}}]}\n' },
  },
  { method: "GET", path: "/api/test-suites/outcome" },
  { method: "DELETE", path: "/api/test-suites/untitled-1.json", body: {} },
  { method: "GET", path: "/api/vendors" },
  { method: "DELETE", path: "/api/charter/root/primitives/short-lines", body: {} },
  { method: "GET", path: "/api/charter/root/primitives" },
];

/** Runs every command of `COMMAND_ARGS` with the `cw` at `cwFilePath`, in a
 *  fresh git repository under a home of its own, then every request of
 *  `PORTAL_REQUESTS` to the portal it serves there. The run's folder, which
 *  differs on every run, is written as `<work>`, each date as `<date>`, and
 *  the package's version as `<version>`, which every release moves on;
 *  `extraEnv` is added to what every command runs with. */
export async function answersOfEveryCommand(
  cwFilePath: string,
  port: number,
  extraEnv: NodeJS.ProcessEnv = {},
): Promise<AnswersOfEveryCommand> {
  const workFolderPath = await mkdtemp(join(tmpdir(), "cw-every-command-"));
  const workFolderName = basename(workFolderPath);
  const repoFolderPath = join(workFolderPath, "repo");
  const vendorFolderPath = join(workFolderPath, "vendor");
  const homeFolderPath = join(workFolderPath, "home");
  // The run's folder, as given and with its links resolved, both as a path and
  // as an agent writes a path into a folder's name, each `/` a `-`; then any
  // other mention of its name.
  const workFolderPaths = [...new Set([await realpath(workFolderPath), workFolderPath])];
  const normalisedTextOf = (text: string) =>
    [...workFolderPaths, ...workFolderPaths.map((folderPath) => folderPath.replaceAll(/[/.]/g, "-"))]
      .reduce((normalisedText, folderPath) => normalisedText.replaceAll(folderPath, "<work>"), text)
      .replaceAll(workFolderName, "<work>")
      .replaceAll(/\b\d{4}-\d{2}-\d{2}\b/g, "<date>")
      .replaceAll(packageJson.version, "<version>");
  const commandEnv = {
    ...process.env,
    HOME: homeFolderPath,
    EDITOR: "true",
    NO_COLOR: "1",
    // No git configuration of this machine is read: an empty one of its own.
    GIT_CONFIG_GLOBAL: join(workFolderPath, "gitconfig"),
    GIT_AUTHOR_NAME: "Someone",
    GIT_AUTHOR_EMAIL: "someone@example.com",
    GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z",
    GIT_COMMITTER_NAME: "Someone",
    GIT_COMMITTER_EMAIL: "someone@example.com",
    GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z",
    ...extraEnv,
  };
  await mkdir(repoFolderPath);
  await mkdir(homeFolderPath);
  await writeFile(join(workFolderPath, "gitconfig"), "");
  await mkdir(join(vendorFolderPath, "skills/grill"), { recursive: true });
  await writeFile(join(vendorFolderPath, "skills/grill/SKILL.md"), VENDOR_SKILL_TEXT);
  let portalProcess: ChildProcess | undefined;
  try {
    for (const gitArgs of [
      ["init", "--quiet"],
      ["add", "."],
      ["commit", "--quiet", "-m", "One skill"],
    ]) {
      const gitRun = spawnSync("git", gitArgs, { cwd: vendorFolderPath, env: commandEnv, encoding: "utf8" });
      assert.equal(gitRun.status, 0, gitRun.stderr);
    }
    const repoGitRun = spawnSync("git", ["init", "--quiet"], {
      cwd: repoFolderPath,
      env: commandEnv,
      encoding: "utf8",
    });
    assert.equal(repoGitRun.status, 0, repoGitRun.stderr);
    let listedVendorName = "";
    const commandAnswers = COMMAND_ARGS.map((commandArgs) => {
      const cwArgs = commandArgs.map((commandArg) =>
        commandArg === "<vendor>" ? vendorFolderPath : commandArg === "<listed vendor>" ? listedVendorName : commandArg,
      );
      const commandRun = spawnSync(process.execPath, [cwFilePath, ...cwArgs], {
        cwd: repoFolderPath,
        env: commandEnv,
        input: "",
        encoding: "utf8",
      });
      if (commandArgs.join(" ") === "vendor list") {
        listedVendorName = commandRun.stdout.trim().replace(/^\.cw\/(charter\/)?vendor\//, "");
      }
      return {
        args: commandArgs.join(" "),
        status: commandRun.status,
        stdout: normalisedTextOf(commandRun.stdout),
        stderr: normalisedTextOf(commandRun.stderr),
      };
    });

    portalProcess = spawn(process.execPath, [cwFilePath, "portal", "--port", String(port)], {
      cwd: repoFolderPath,
      env: commandEnv,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const startedPortal = portalProcess;
    // The page is opened at the address the portal prints, its token and all.
    const portalAddress = new URL(
      await new Promise<string>((resolve, reject) => {
        let portalOutput = "";
        // A portal that neither prints its address nor stops fails the run.
        const addressTimer = setTimeout(
          () => reject(new Error(`the portal printed no address: ${portalOutput}`)),
          10_000,
        );
        startedPortal.stdout?.on("data", (outputChunk: Buffer) => {
          portalOutput += outputChunk.toString();
          const addressMatch = portalOutput.match(/http:\/\/\S+/);
          if (addressMatch !== null) {
            clearTimeout(addressTimer);
            resolve(addressMatch[0]);
          }
        });
        startedPortal.on("exit", () => reject(new Error(`the portal stopped: ${portalOutput}`)));
      }),
    );
    const portalToken = portalAddress.searchParams.get("t") ?? "";
    const portalAnswers: PortalAnswer[] = [];
    // A change is sent with the hash the primitive was last read at, as the page does.
    let openedPrimitiveHash = "";
    for (const portalRequest of PORTAL_REQUESTS) {
      const requestUrl = new URL(portalRequest.path, portalAddress.origin);
      if (portalRequest.path === "/") requestUrl.searchParams.set("t", portalToken);
      const portalResponse = await fetch(requestUrl, {
        method: portalRequest.method,
        headers: {
          authorization: `Bearer ${portalToken}`,
          ...(portalRequest.method === "PUT" ? { "if-match": `"${openedPrimitiveHash}"` } : {}),
          ...(portalRequest.body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(portalRequest.body === undefined ? {} : { body: JSON.stringify(portalRequest.body) }),
      });
      const responseBytes = Buffer.from(await portalResponse.arrayBuffer());
      const primitiveHash = /"hash":"([^"]+)"/.exec(responseBytes.toString("utf8"))?.[1];
      if (primitiveHash !== undefined) openedPrimitiveHash = primitiveHash;
      portalAnswers.push({
        request: `${portalRequest.method} ${portalRequest.path}`,
        status: portalResponse.status,
        body: portalRequest.path.endsWith(".png")
          ? createHash("sha256").update(responseBytes).digest("hex")
          : normalisedTextOf(responseBytes.toString("utf8")),
      });
    }

    const repoFiles: Record<string, string> = {};
    for (const repoDirent of await readdir(repoFolderPath, { recursive: true, withFileTypes: true })) {
      const filePath = join(repoDirent.parentPath, repoDirent.name);
      const repoFilePath = relative(repoFolderPath, filePath);
      if (!repoDirent.isFile() || repoFilePath.startsWith(".git/")) continue;
      repoFiles[normalisedTextOf(repoFilePath)] = normalisedTextOf(await readFile(filePath, "utf8"));
    }
    return { commandAnswers, portalAnswers, repoFiles };
  } finally {
    portalProcess?.kill();
    await rm(workFolderPath, { recursive: true, force: true });
  }
}
