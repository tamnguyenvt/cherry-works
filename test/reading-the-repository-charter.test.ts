import { test } from "node:test";
import assert from "node:assert/strict";
import { inTheBrowser } from "./in-the-browser.js";
import { chipsOf, columnOf, rowsOf, shownKindOf } from "./listing-in-the-browser.js";
import { KINDS } from "../src/hexagon/domain/models/charter/primitive/Primitive.js";
import { GuidePrimitive } from "../src/hexagon/domain/models/charter/primitive/GuidePrimitive.js";

const at = (path: string) => new URL(path, "file:///repo/.cw/charter/").href;

const primitive = (kind: string, id: string, headers: readonly string[] = []) =>
  ["---", `kind: ${kind}`, `id: ${id}`, `description: About ${id}.`, ...headers, "---", "", `The body of ${id}.`, ""].join("\n");

/** A charter with something of three kinds and nothing of the five others: what
 *  a reader meets, and what a chip with no primitives behind it has to survive. */
const charter = {
  [at("guide/no-any.md")]: primitive("guide", "no-any", ['globs: ["src/**/*.ts"]', "rationale: corpus:why", 'mixins: ["voice"]']),
  [at("corpus/why.md")]: primitive("corpus", "why"),
  [at("mixin/voice.md")]: primitive("mixin", "voice"),
};

test("every kind the charter knows has a chip, carrying how many primitives of it are held", async () => {
  await inTheBrowser(charter, async (page) => {
    // Every assertion below reads what is there rather than waiting for it, so
    // the view is waited for once, here.
    await page.getByRole("radio", { checked: true }).waitFor();

    assert.deepEqual(
      await chipsOf(page),
      KINDS.map((kind, index) => [kind, ["1", "0", "1", "0", "0", "0", "1", "1", "0"][index]]),
    );
  });
});

test("the line above the table says when the shown kind comes up, in the words the kind declares", async () => {
  await inTheBrowser(charter, async (page) => {
    assert.equal(await shownKindOf(page), "guide");
    assert.equal(await page.getByLabel("Activates when").innerText(), GuidePrimitive.activatesWhen);
  });
});

test("a guide is listed with what it is for, the file it is in, the globs it matches and the corpus it cites", async () => {
  await inTheBrowser(charter, async (page) => {
    const row = rowsOf(page);

    assert.equal(await row.locator("td").nth(0).innerText(), "no-any");
    assert.equal(await row.locator("td").nth(1).locator("div").nth(0).innerText(), "About no-any.");
    assert.equal(await row.locator("td").nth(1).locator("div").nth(1).innerText(), ".cw/charter/guide/no-any.md");
    assert.equal(await row.getByRole("cell", { name: "Matching globs" }).innerText(), "src/**/*.ts");
    assert.equal(await row.getByRole("cell", { name: "Rationale" }).innerText(), "corpus:why");
    assert.equal(await row.getByRole("cell", { name: "Mixins" }).innerText(), "voice");
  });
});

test("a guide declaring no globs is listed as matching all patterns, since it comes up every turn", async () => {
  await inTheBrowser({ [at("guide/everywhere.md")]: primitive("guide", "everywhere") }, async (page) => {
    assert.equal(await rowsOf(page).getByRole("cell", { name: "Matching globs" }).innerText(), "all patterns");
  });
});

test("a mixin is listed without a column for the mixins it may not name", async () => {
  await inTheBrowser(charter, async (page) => {
    await page.getByRole("radio", { name: "mixin" }).click();
    await page.getByRole("table", { name: "mixin primitives" }).waitFor();

    assert.deepEqual(await page.getByRole("columnheader").allTextContents(), ["Id", "Description", ""]);
    assert.equal(await columnOf(page, 1).innerText(), "voice");
  });
});

test("a kind the charter holds nothing of says so in place of a table", async () => {
  await inTheBrowser(charter, async (page) => {
    await page.getByRole("radio", { name: "posture" }).click();

    await page.getByText("No posture in this charter yet.").waitFor();
    assert.equal(await page.getByRole("table").count(), 0);
  });
});

test("the charter is read again when the tab is shown again, so a file written meanwhile is listed", async () => {
  await inTheBrowser(charter, async (page, files) => {
    await rowsOf(page).waitFor();

    files.write(new URL(at("guide/no-casts.md")), primitive("guide", "no-casts", ['globs: ["src/**/*.ts"]']));
    await page.getByRole("tab", { name: "Vendor" }).click();
    await page.getByRole("tab", { name: "Repo Charter" }).click();
    await rowsOf(page).nth(1).waitFor();

    assert.deepEqual(await columnOf(page, 1).allInnerTexts(), ["no-any", "no-casts"]);
  });
});

test("a charter the engine will not read shows every fault under its file in place of a listing (FR-115)", async () => {
  await inTheBrowser({ [at("guide/broken.md")]: "not a primitive at all\n" }, async (page) => {
    await page.getByRole("alert").waitFor();

    assert.match(await page.getByRole("alert").innerText(), /The engine will not read this charter/);
    const refusedFiles = page.getByRole("table", { name: "Refused files" });
    assert.deepEqual(await refusedFiles.locator("tr td:first-child").allInnerTexts(), [".cw/charter/guide/broken.md"]);
    assert.ok((await refusedFiles.locator("tr td:nth-child(2) p").count()) > 0);
    assert.equal(await page.getByRole("radio").count(), 0);
  });
});

test("the repository's tab lists what was authored here and what the engine brings, and nothing vendored (FR-112)", async () => {
  const vendored = new URL("guide/small-diffs.md", "file:///repo/.cw/vendor/acme/").href;
  await inTheBrowser({ ...charter, [vendored]: primitive("guide", "small-diffs") }, async (page) => {
    await rowsOf(page).waitFor();

    assert.deepEqual(await columnOf(page, 1).allInnerTexts(), ["no-any"]);
    await page.getByRole("radio", { name: "skill" }).click();
    await page.getByRole("table", { name: "skill primitives" }).waitFor();
    assert.deepEqual(await columnOf(page, 2).locator("div:nth-child(2)").allInnerTexts(), ["(built into cw)/skill/cw-author.md"]);
  });
});
