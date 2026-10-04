import { test } from "node:test";
import assert from "node:assert/strict";
import { inTheBrowser } from "./in-the-browser.js";

const at = (path: string) => new URL(path, "file:///repo/").href;

const primitive = (kind: string, id: string, headers: readonly string[]) =>
  ["---", `kind: ${kind}`, `id: ${id}`, `description: About ${id}.`, ...headers, "---", "", `The body of ${id}.`, ""].join("\n");

/** A repository compiling for claude, a guide on every turn and one loaded
 *  when a file it names is touched. */
const holding = {
  [at(".cw/settings.json")]: `${JSON.stringify({ agents: ["claude"], contextCeiling: 30 })}\n`,
  [at(".cw/charter/guide/plain-words/index.md")]: primitive("guide", "plain-words", []),
  [at(".cw/charter/guide/no-any/index.md")]: primitive("guide", "no-any", ['globs: ["src/**/*.ts"]']),
};

test("the Context tab shows what a session opens with, the total against the ceiling, and the guides loaded on a touch apart (EVAL-FR-007)", async () => {
  await inTheBrowser(holding, async (page) => {
    await page.getByRole("tab", { name: "Context" }).click();

    const sessionTable = page.getByRole("table", { name: "Loaded when a session opens" });
    await sessionTable.waitFor();
    const sessionRows = await sessionTable.locator("tr").allInnerTexts();
    assert.ok(sessionRows.some((row) => /plain-words/.test(row)));
    assert.ok(sessionRows.every((row) => !/no-any/.test(row)));
    assert.match(
      await page.getByRole("table", { name: "Loaded when a file it names is touched, not in the total" }).innerText(),
      /no-any[\s\S]*src\/\*\*\/\*\.ts/,
    );
    assert.match(await page.getByRole("heading", { level: 2 }).innerText(), /claude opens a session with [\d,]+ tokens of the charter, estimated · past the ceiling of 30/);
  });
});
