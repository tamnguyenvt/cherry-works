import { test } from "node:test";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { inTheBrowser } from "./in-the-browser.js";
import packageJson from "../package.json" with { type: "json" };

const at = (path: string) => new URL(path, "file:///repo/").href;

const primitive = (kind: string, id: string, headers: readonly string[] = []) =>
  ["---", `kind: ${kind}`, `id: ${id}`, `description: About ${id}.`, ...headers, "---", "", `The body of ${id}.`, ""].join("\n");

const guide = (id: string, headers: readonly string[] = []) => primitive("guide", id, ['globs: ["src/**/*.ts"]', ...headers]);

/** One guide, and the case naming it. */
const holding = (extra: Record<string, string> = {}) => ({
  [at(".cw/charter/guide/no-any/index.md")]: guide("no-any"),
  [at(".cw/test/no-any.json")]: JSON.stringify({ cases: [{ do: { touchFile: "src/one.ts" }, expect: { activate: "guide:no-any" } }] }),
  ...extra,
});

/** Preview, from the Build button. */
const previewing = async (page: Page) => {
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page.getByRole("table", { name: "Build plan" }).waitFor();
};

test("the preview lists every target with its change and a count, and writes nothing (FR-120)", async () => {
  await inTheBrowser(holding(), async (page, files) => {
    await previewing(page);

    const rows = await page.getByRole("table", { name: "Build plan" }).locator("tr").allInnerTexts();
    assert.ok(rows.some((row) => /create\s+\.cw\/out\/catalog\.json/i.test(row)));
    assert.match(await page.getByLabel("Plan counts").innerText(), /^\d+ files: \d+ create, 0 update, 0 delete, 0 unchanged\.$/);
    assert.equal(await files.readIfThere(new URL(at(".cw/out/catalog.json"))), undefined);
  });
});

test("building from the preview writes, and lists what it wrote (FR-120)", async () => {
  await inTheBrowser(holding(), async (page, files) => {
    await previewing(page);
    await page.getByRole("dialog").getByRole("button", { name: "Build", exact: true }).click();

    await page.getByRole("table", { name: "Build written" }).waitFor();
    assert.match(await page.getByLabel("Build counts").innerText(), /^Built \d+ files: \d+ added, 0 changed, 0 deleted\.$/);
    assert.notEqual(await files.readIfThere(new URL(at(".cw/out/catalog.json"))), undefined);
  });
});

test("a charter with an error builds nothing, and its faults are shown under their files (FR-120)", async () => {
  await inTheBrowser(holding({ [at(".cw/charter/guide/no-any/index.md")]: guide("no-any", ['mixins: ["nowhere"]']) }), async (page, files) => {
    await page.getByRole("button", { name: "Build", exact: true }).click();

    const refused = page.getByRole("dialog").getByRole("table", { name: "Refused files" });
    await refused.waitFor();
    assert.match(await refused.innerText(), /\.cw\/charter\/guide\/no-any\/index\.md[\s\S]*the mixin "nowhere"/);
    assert.equal(await files.readIfThere(new URL(at(".cw/out/catalog.json"))), undefined);
  });
});

test("Doctor shows the four answers and every warning, and builds when the output is behind (FR-121)", async () => {
  await inTheBrowser(holding({ [at(".cw/charter/corpus/why/index.md")]: primitive("corpus", "why") }), async (page, files) => {
    await page.getByRole("button", { name: "Doctor" }).click();

    const health = page.getByLabel("Health");
    await health.waitFor();
    // The version the report is from, as `cw doctor` starts with it (FR-132).
    assert.equal(await page.getByRole("dialog").getByText(`cw ${packageJson.version}`, { exact: true }).count(), 1);
    const answers = await health.innerText();
    assert.match(answers, /Agents\s+none chosen/i);
    assert.match(answers, /Charter\s+holds, with 1 warning\./i);
    assert.match(answers, /Vendors\s+none edited here\./i);
    assert.match(answers, /Built\s+\d+ files out of date\./i);
    assert.match(await page.getByRole("table", { name: "Faults" }).innerText(), /\.cw\/charter\/corpus\/why\/index\.md[\s\S]*warn[\s\S]*No primitive cites "corpus:why"/);

    await page.getByRole("dialog").getByRole("button", { name: "Build", exact: true }).click();
    await page.getByRole("table", { name: "Build written" }).waitFor();
    assert.notEqual(await files.readIfThere(new URL(at(".cw/out/catalog.json"))), undefined);
  });
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
