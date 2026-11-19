import assert from "node:assert/strict";
import { test } from "node:test";
import type { Page } from "playwright";
import packageJson from "../package.json" with { type: "json" };
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import type { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { Commander } from "../src/presentation/cli/cli.commander.js";
import { COMMANDS } from "../src/presentation/cli/commands/index.js";
import { inTheBrowser } from "./in-the-browser.js";
import { authoringCharterOf, buildingCharterOf, commandLineOf } from "./use-cases-of.js";

const at = (path: string) => new URL(path, "file:///repo/").href;

const primitive = (kind: string, id: string, headers: readonly string[] = []) =>
  [
    "---",
    `kind: ${kind}`,
    `id: ${id}`,
    `description: About ${id}.`,
    ...headers,
    "---",
    "",
    `The body of ${id}.`,
    "",
  ].join("\n");

const guide = (id: string, headers: readonly string[] = []) =>
  primitive("guide", id, ['globs: ["src/**/*.ts"]', ...headers]);

/** One guide, and the case naming it. */
const holding = (extra: Record<string, string> = {}) => ({
  [at(".cw/charter/team/primitive/guide/no-any/index.md")]: guide("no-any"),
  [at(".cw/charter/team/test/no-any.json")]: JSON.stringify({
    cases: [{ do: { touchFile: "src/one.ts" }, expect: { activate: "no-any" } }],
  }),
  ...extra,
});

/** What `cw doctor` printed over the same files the page reads. */
const printedDoctorOf = async (files: InMemoryFileReaders) => {
  const charterAuthoringApp = authoringCharterOf(files, new InMemoryFileOutput(files), new InMemoryReporter());
  const charterRuntimeApps = buildingCharterOf(
    files,
    new InMemoryFileOutput(files),
    new InMemoryTokenCounter(),
    { claude: new InMemoryAgentCli() },
    new InMemoryReporter(),
  );
  const printedTexts: string[] = [];
  const keptWrite = process.stdout.write;
  process.stdout.write = ((text: string) => (printedTexts.push(String(text)), true)) as typeof process.stdout.write;
  try {
    await new Commander(
      commandLineOf(
        files,
        new InMemoryFileOutput(files),
        { charterAuthoringApp, charterRuntimeApp: charterRuntimeApps },
        "/repo",
      ),
      COMMANDS,
    ).runCommandLine(["doctor"]);
  } finally {
    process.stdout.write = keptWrite;
  }
  return printedTexts.join("");
};

/** Preview, from the Build button. */
const previewing = async (page: Page) => {
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page.getByRole("table", { name: "Build plan" }).waitFor();
};

test("the preview lists every target with its change and a count, and writes nothing (FR-120, CORE Story 7 scenario 1)", async () => {
  await inTheBrowser(holding(), async (page, files) => {
    await previewing(page);

    const rows = await page.getByRole("table", { name: "Build plan" }).locator("tr").allInnerTexts();
    assert.ok(rows.some((row) => /create\s+\.cw\/out\/CHARTER\.md/i.test(row)));
    assert.match(
      await page.getByLabel("Plan counts").innerText(),
      /^\d+ files: \d+ create, 0 update, 0 delete, 0 unchanged\.$/,
    );
    assert.equal(await files.readIfThere(new URL(at(".cw/out/CHARTER.md"))), undefined);
  });
});

test("building from the preview writes, and lists what it wrote (FR-120, CORE Story 7 scenario 2)", async () => {
  await inTheBrowser(holding(), async (page, files) => {
    await previewing(page);
    await page.getByRole("dialog").getByRole("button", { name: "Build", exact: true }).click();

    await page.getByRole("table", { name: "Build written" }).waitFor();
    assert.match(
      await page.getByLabel("Build counts").innerText(),
      /^Built \d+ files: \d+ added, 0 changed, 0 deleted\.$/,
    );
    assert.notEqual(await files.readIfThere(new URL(at(".cw/out/CHARTER.md"))), undefined);
  });
});

test("a charter with an error builds nothing, and its faults are shown under their files (FR-120, CORE Story 7 scenario 3)", async () => {
  await inTheBrowser(
    holding({ [at(".cw/charter/team/primitive/guide/no-any/index.md")]: guide("no-any", ['mixins: ["nowhere"]']) }),
    async (page, files) => {
      await page.getByRole("button", { name: "Build", exact: true }).click();

      const refused = page.getByRole("dialog").getByRole("table", { name: "Refused files" });
      await refused.waitFor();
      assert.match(
        await refused.innerText(),
        /\.cw\/charter\/team\/primitive\/guide\/no-any\/index\.md[\s\S]*the mixin "nowhere"/,
      );
      assert.equal(await files.readIfThere(new URL(at(".cw/out/CHARTER.md"))), undefined);
    },
  );
});

test("Doctor shows the three answers and every warning, and builds when the output is behind (FR-121, CORE Story 7 scenario 5, CORE Story 14 scenario 4)", async () => {
  await inTheBrowser(
    holding({ [at(".cw/charter/team/primitive/corpus/why/index.md")]: primitive("corpus", "why") }),
    async (page, files) => {
      await page.getByRole("button", { name: "Doctor" }).click();

      const health = page.getByLabel("Health");
      await health.waitFor();
      // The version the report is from, as `cw doctor` starts with it (FR-132).
      assert.equal(await page.getByRole("dialog").getByText(`cw ${packageJson.version}`, { exact: true }).count(), 1);
      const answers = await health.innerText();
      assert.match(answers, /Agents\s+none chosen/i);
      assert.match(answers, /Charter\s+holds, with 1 warning\./i);
      assert.match(answers, /Built\s+\d+ files out of date\./i);
      assert.match(
        await page.getByRole("table", { name: "Faults" }).innerText(),
        /\.cw\/charter\/team\/primitive\/corpus\/why\/index\.md[\s\S]*warn[\s\S]*No primitive cites "why"/,
      );

      await page.getByRole("dialog").getByRole("button", { name: "Build", exact: true }).click();
      await page.getByRole("table", { name: "Build written" }).waitFor();
      assert.notEqual(await files.readIfThere(new URL(at(".cw/out/CHARTER.md"))), undefined);
    },
  );
});

test("Doctor gives what cw doctor gives for the same repository: its main-context line per chosen agent, and every fault, nothing added and nothing left out (CORE Story 7 scenario 4, FR-080, FR-121, EVAL-FR-006, CORE Story 55 scenario 8)", async () => {
  await inTheBrowser(
    holding({
      [at(".cw/settings.json")]: `${JSON.stringify({ agents: ["claude", "codex"] })}\n`,
      [at(".cw/charter/team/primitive/corpus/why/index.md")]: primitive("corpus", "why"),
      [at(".cw/charter/team/primitive/mixin/ts/index.md")]: primitive("mixin", "ts"),
    }),
    async (page, files) => {
      const doctorText = await printedDoctorOf(files);
      await page.getByRole("button", { name: "Doctor" }).click();
      await page.getByLabel("Health").waitFor();

      const healthText = await page.getByLabel("Health").innerText();
      // A value wider than the terminal goes on beneath its own column: each
      // row is read as the one line it is.
      const doctorContextLines = doctorText
        .replace(/\n {5,}/g, " ")
        .split("\n")
        .filter((line) => line.includes("Context:"));
      assert.equal(doctorContextLines.length, 2, doctorText);
      for (const doctorContextLine of doctorContextLines) {
        const [, agentTokensText] = /\((\w+ opens a session with about [\d,]+ tokens)/.exec(doctorContextLine) ?? [];
        assert.ok(agentTokensText !== undefined && healthText.includes(agentTokensText), doctorContextLine);
      }
      assert.equal((healthText.match(/opens a session with about/g) ?? []).length, doctorContextLines.length);

      // Every fault the page shows, file and words, against every fault cw
      // doctor printed: the same, both ways.
      const shownFaultTexts = await page
        .getByRole("table", { name: "Faults" })
        .locator("tr")
        .evaluateAll((rows) =>
          rows.flatMap((row) =>
            [...row.querySelectorAll("td:nth-child(2) p")].map(
              (paragraph) => `${row.querySelector("td")!.textContent} ${paragraph.textContent}`,
            ),
          ),
        );
      // A fault's message, then its fix, each a value line beneath its marked
      // label, either one wrapped beneath its own column: joined with a space,
      // its lines are the message and the fix as the page shows them.
      const doctorFaultTexts = [
        ...doctorText.matchAll(/^(\S.*)\n((?: {2}[✘⚠] (?:error|warn): {2}.*\n(?: {5,}\S.*\n)*)+)/gm),
      ].flatMap(([, filePath, faultLines]) =>
        [...(faultLines ?? "").matchAll(/^ {2}[✘⚠] (error|warn): {2}(.*)\n((?: {5,}\S.*\n)*)/gm)].map(
          ([, severity, firstValueLine, nextValueLines]) =>
            `${filePath} ${severity}${[
              firstValueLine,
              ...(nextValueLines ?? "")
                .split("\n")
                .filter(Boolean)
                .map((valueLine) => valueLine.trim()),
            ].join(" ")}`,
        ),
      );
      assert.ok(doctorFaultTexts.length >= 2, doctorText);
      assert.deepEqual([...shownFaultTexts].sort(), [...doctorFaultTexts].sort());
    },
  );
});

test("Doctor offers no build once the output is up to date (FR-121)", async () => {
  await inTheBrowser(holding(), async (page) => {
    await previewing(page);
    await page.getByRole("dialog").getByRole("button", { name: "Build", exact: true }).click();
    await page.getByRole("table", { name: "Build written" }).waitFor();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Doctor" }).click();
    await page.getByLabel("Health").waitFor();
    assert.match(await page.getByLabel("Health").innerText(), /Built\s+up to date\./i);
    assert.equal(await page.getByRole("dialog").getByRole("button", { name: "Build", exact: true }).count(), 0);
  });
});
