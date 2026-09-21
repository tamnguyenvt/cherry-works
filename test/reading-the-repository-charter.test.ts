import { test } from "node:test";
import assert from "node:assert/strict";
import { inTheBrowser } from "./in-the-browser.js";
import { KINDS } from "../src/hexagon/domain/models/charter/primitive/Primitive.js";
import { GuidePrimitive } from "../src/hexagon/domain/models/charter/primitive/GuidePrimitive.js";

const at = (path: string) => new URL(path, "file:///repo/.cw/charter/").href;

const primitive = (kind: string, id: string, headers: readonly string[] = []) =>
  ["---", `kind: ${kind}`, `id: ${id}`, `description: About ${id}.`, ...headers, "---", "", `The body of ${id}.`, ""].join("\n");

/** A charter with something of three kinds and nothing of the six others: what
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
    await page.locator(".chip.on").waitFor();

    assert.deepEqual(await page.locator(".chip > span").allInnerTexts(), [...KINDS]);
    assert.deepEqual(await page.locator(".chip > b").allInnerTexts(), ["1", "0", "0", "1", "0", "0", "0", "1", "1"]);
  });
});

test("the line above the table says when the shown kind comes up, in the words the kind declares", async () => {
  await inTheBrowser(charter, async (page) => {
    assert.equal(await page.locator(".chip.on > span").innerText(), "guide");
    assert.equal(await page.locator(".actnote span").innerText(), GuidePrimitive.activatesWhen);
  });
});

test("a guide is listed with what it is for, the file it is in, the globs it matches and the corpus it cites", async () => {
  await inTheBrowser(charter, async (page) => {
    const row = page.locator(".chrow:not(.chhead)");

    assert.equal(await row.locator(".cid").innerText(), "no-any");
    assert.equal(await row.locator(".cn").innerText(), "About no-any.");
    assert.equal(await row.locator(".cp").innerText(), ".cw/charter/guide/no-any.md");
    assert.deepEqual(await row.locator(".cgl").allInnerTexts(), ["src/**/*.ts", "corpus:why", "voice"]);
  });
});

test("a guide declaring no globs is listed as matching all patterns, since it comes up every turn", async () => {
  await inTheBrowser({ [at("guide/everywhere.md")]: primitive("guide", "everywhere") }, async (page) => {
    await page.locator(".chrow:not(.chhead)").waitFor();

    assert.equal(await page.locator(".chrow:not(.chhead) .cgl").first().innerText(), "all patterns");
  });
});

test("a mixin is listed without a column for the mixins it may not name", async () => {
  await inTheBrowser(charter, async (page) => {
    await page.locator(".chip", { hasText: "mixin" }).click();

    assert.deepEqual(await page.locator(".chhead > span").allTextContents(), ["Id", "Description", ""]);
    assert.equal(await page.locator(".chrow:not(.chhead) .cid").innerText(), "voice");
  });
});

test("a kind the charter holds nothing of says so in place of a table", async () => {
  await inTheBrowser(charter, async (page) => {
    await page.locator(".chip", { hasText: "posture" }).click();

    assert.equal(await page.locator(".mem-empty").innerText(), "No posture in this charter yet.");
    assert.equal(await page.locator(".panel").count(), 0);
  });
});

test("the charter is read again when the tab is shown again, so a file written meanwhile is listed", async () => {
  await inTheBrowser(charter, async (page, files) => {
    await page.locator(".chrow:not(.chhead)").waitFor();

    files.write(new URL(at("guide/no-casts.md")), primitive("guide", "no-casts", ['globs: ["src/**/*.ts"]']));
    await page.getByRole("button", { name: "Vendor" }).click();
    await page.getByRole("button", { name: "Repo Charter" }).click();
    await page.locator(".chrow:not(.chhead)").nth(1).waitFor();

    assert.deepEqual(await page.locator(".chrow:not(.chhead) .cid").allInnerTexts(), ["no-any", "no-casts"]);
  });
});

test("a charter the engine will not read shows every fault under its file in place of a listing (FR-115)", async () => {
  await inTheBrowser({ [at("guide/broken.md")]: "not a primitive at all\n" }, async (page) => {
    await page.locator(".refused").waitFor();

    assert.equal(await page.locator(".refused b").innerText(), "The engine will not read this charter");
    assert.deepEqual(await page.locator(".dcrow .dcfile").allInnerTexts(), [".cw/charter/guide/broken.md"]);
    assert.ok((await page.locator(".dcrow .dcfaults > span").count()) > 0);
    assert.equal(await page.locator(".chip").count(), 0);
  });
});

test("the repository's tab lists what was authored here and what the engine brings, and nothing vendored (FR-112)", async () => {
  const vendored = new URL("guide/small-diffs.md", "file:///repo/.cw/vendor/acme/").href;
  await inTheBrowser({ ...charter, [vendored]: primitive("guide", "small-diffs") }, async (page) => {
    await page.locator(".chip.on").waitFor();

    assert.deepEqual(await page.locator(".chrow:not(.chhead) .cid").allInnerTexts(), ["no-any"]);
    await page.locator(".chip", { hasText: "skill" }).click();
    assert.deepEqual(await page.locator(".chrow:not(.chhead) .cp").allInnerTexts(), ["(built into cw)/skill/cw-author.md"]);
  });
});
