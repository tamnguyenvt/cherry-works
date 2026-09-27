import { test } from "node:test";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { inTheBrowser } from "./in-the-browser.js";
import { columnOf } from "./listing-in-the-browser.js";
import { primitiveHeadersOf, primitiveOf } from "../src/hexagon/domain/models/charter/primitive/Primitive.js";
import { SIGNALS } from "../src/hexagon/domain/models/charter/primitive/SensorPrimitive.js";
import type { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";

const at = (path: string) => new URL(path, "file:///repo/").href;

const primitive = (kind: string, id: string, headers: readonly string[] = []) =>
  ["---", `kind: ${kind}`, `id: ${id}`, `description: About ${id}.`, ...headers, "---", "", `The body of ${id}.`, ""].join("\n");

const guide = (id: string) => primitive("guide", id, ['globs: ["src/**/*.ts"]']);

/** What one file holds now, or nothing where it is not there. */
const fileIn = (files: InMemoryFileReaders, path: string) => files.readIfThere(new URL(at(path)));

/** The label of every row the form shows, in order. */
const rowLabelsOf = (page: Page) => page.getByRole("dialog").locator('[data-slot="label"]').allTextContents();

/** A new primitive of one kind started from the Repo Charter view. */
const startingNew = async (page: Page, kind: string) => {
  await page.getByRole("radio", { name: kind }).click();
  await page.getByRole("button", { name: `New ${kind}` }).click();
  await page.getByRole("dialog").getByLabel("description", { exact: true }).waitFor();
};

/** One primitive of the listing opened by its id. */
const opening = async (page: Page, id: string) => {
  await page.getByRole("button", { name: id, exact: true }).click();
  await page.getByRole("dialog").waitFor();
};

test("New asks the kind, the id and every header the kind takes, each in its shape (FR-117, FR-118)", async () => {
  await inTheBrowser({}, async (page) => {
    await startingNew(page, "guide");

    assert.equal(await page.getByRole("dialog").getByLabel("kind", { exact: true }).innerText(), "guide");
    assert.deepEqual(await rowLabelsOf(page), ["kind", "id", ...primitiveHeadersOf("guide").map(({ field }) => field)]);
    // A list is a box per entry, with a way to add the next.
    assert.equal(await page.getByRole("dialog").getByLabel(/^globs \d+$/).count(), 1);
    await page.getByRole("button", { name: "Add globs" }).click();
    assert.equal(await page.getByRole("dialog").getByLabel(/^globs \d+$/).count(), 2);
    assert.equal(await page.getByRole("dialog").locator(".cm-content").count(), 1);

    // A header read from a closed set is chosen, not typed.
    await page.getByRole("dialog").getByLabel("kind", { exact: true }).click();
    await page.getByRole("option", { name: "sensor" }).click();
    await page.getByRole("dialog").getByLabel("signal", { exact: true }).click();
    assert.deepEqual(await page.getByRole("option").allInnerTexts(), [...SIGNALS]);
  });
});

test("creating writes the file cw add writes, with the body typed, and the listing shows it (FR-117)", async () => {
  await inTheBrowser({}, async (page, files) => {
    await startingNew(page, "guide");
    await page.getByRole("dialog").getByLabel("id", { exact: true }).fill("no-any");
    await page.getByRole("dialog").getByLabel("description", { exact: true }).fill("Never write any.");
    await page.getByRole("dialog").getByLabel("globs 1", { exact: true }).fill("src/**/*.ts");
    await page.getByRole("dialog").locator(".cm-content").click();
    await page.keyboard.type("Use unknown.");
    await page.getByRole("button", { name: "Create primitive" }).click();
    await page.getByText("Primitive created").waitFor();

    const expected = primitiveOf({
      headers: { kind: "guide", id: "no-any", description: "Never write any.", globs: ["src/**/*.ts"] },
      body: "Use unknown.",
    }).toMarkdown();
    assert.equal(await fileIn(files, ".cw/charter/guide/no-any.md"), expected);
    await page.getByRole("button", { name: "no-any", exact: true }).waitFor();
    // Nothing was compiled (Story 6 scenario 8).
    assert.deepEqual((await files.readFilesRecursively(new URL(at(".cw/out/")))).length, 0);
  });
});

test("answers the kind refuses, and an identity already claimed, are shown in the engine's words and nothing is written", async () => {
  await inTheBrowser({ [at(".cw/charter/guide/no-any.md")]: guide("no-any") }, async (page, files) => {
    await startingNew(page, "guide");
    await page.getByRole("dialog").getByLabel("id", { exact: true }).fill("Not A Slug");
    await page.getByRole("button", { name: "Create primitive" }).click();
    await page.getByRole("dialog").getByRole("alert").waitFor();
    assert.match(await page.getByRole("dialog").getByRole("alert").innerText(), /These headers are not what a guide holds/);

    await page.getByRole("dialog").getByLabel("id", { exact: true }).fill("no-any");
    await page.getByRole("dialog").getByLabel("description", { exact: true }).fill("Again.");
    await page.getByRole("dialog").getByLabel("globs 1", { exact: true }).fill("src/**");
    await page.getByRole("button", { name: "Create primitive" }).click();
    await page.getByRole("dialog").getByRole("alert").filter({ hasText: "already there" }).waitFor();
    assert.match(await page.getByRole("dialog").getByRole("alert").innerText(), /declared by \.cw\/charter\/guide\/no-any\.md/);

    assert.equal(await fileIn(files, ".cw/charter/guide/not-a-slug.md"), undefined);
    assert.equal(await fileIn(files, ".cw/charter/guide/no-any.md"), guide("no-any"));
  });
});

test("an existing primitive opens locked to its identity, saves over its file and deletes it (Story 6 scenarios 4 – 6)", async () => {
  await inTheBrowser({ [at(".cw/charter/guide/no-any.md")]: guide("no-any") }, async (page, files) => {
    await opening(page, "no-any");
    await page.getByRole("dialog").getByLabel("description", { exact: true }).waitFor();

    assert.equal(await page.getByRole("dialog").getByLabel("kind", { exact: true }).count(), 0);
    assert.equal(await page.getByRole("dialog").getByLabel("id", { exact: true }).count(), 0);
    assert.match(await page.getByRole("dialog").innerText(), /rename by creating a new primitive and deleting this one/);
    assert.equal(await page.getByRole("dialog").getByLabel("globs 1", { exact: true }).inputValue(), "src/**/*.ts");

    await page.getByRole("dialog").getByLabel("description", { exact: true }).fill("Never any.");
    await page.getByRole("button", { name: "Save" }).click();
    await page.getByText("Primitive saved").waitFor();
    assert.match((await fileIn(files, ".cw/charter/guide/no-any.md")) ?? "", /description: Never any\.[\s\S]*The body of no-any\.\n$/);

    await page.getByRole("dialog").waitFor({ state: "detached" });
    await opening(page, "no-any");
    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByText("Primitive deleted").waitFor();
    assert.equal(await fileIn(files, ".cw/charter/guide/no-any.md"), undefined);
    assert.equal(await columnOf(page, 1).count(), 0);
  });
});

test("a primitive whose id holds / opens, saves and deletes like any other (FR-141)", async () => {
  await inTheBrowser({ [at(".cw/charter/guide/mfbs/no-any.md")]: guide("mfbs/no-any") }, async (page, files) => {
    await opening(page, "mfbs/no-any");
    await page.getByRole("dialog").getByLabel("description", { exact: true }).fill("Never any.");
    await page.getByRole("button", { name: "Save" }).click();
    await page.getByText("Primitive saved").waitFor();
    assert.match((await fileIn(files, ".cw/charter/guide/mfbs/no-any.md")) ?? "", /description: Never any\./);

    await page.getByRole("dialog").waitFor({ state: "detached" });
    await opening(page, "mfbs/no-any");
    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByText("Primitive deleted").waitFor();
    assert.equal(await fileIn(files, ".cw/charter/guide/mfbs/no-any.md"), undefined);
  });
});

test("a save over a file changed on disk is refused naming it, and the other change stays (Story 6 scenario 9)", async () => {
  await inTheBrowser({ [at(".cw/charter/guide/no-any.md")]: guide("no-any") }, async (page, files) => {
    await opening(page, "no-any");
    await page.getByRole("dialog").getByLabel("description", { exact: true }).waitFor();
    const changedOnDisk = guide("no-any").replace("About no-any.", "Changed elsewhere.");
    files.write(new URL(at(".cw/charter/guide/no-any.md")), changedOnDisk);

    await page.getByRole("dialog").getByLabel("description", { exact: true }).fill("Mine.");
    await page.getByRole("button", { name: "Save" }).click();
    await page.getByRole("dialog").getByRole("alert").waitFor();

    assert.match(await page.getByRole("dialog").getByRole("alert").innerText(), /\.cw\/charter\/guide\/no-any\.md changed on disk/);
    assert.equal(await fileIn(files, ".cw/charter/guide/no-any.md"), changedOnDisk);
  });
});

test("a vendored primitive opens read-only, saying how to differ from it (Story 6 scenario 7)", async () => {
  await inTheBrowser({ [at(".cw/vendor/team/guide/theirs.md")]: guide("theirs") }, async (page) => {
    await page.getByRole("tab", { name: "Vendor" }).click();
    await opening(page, "theirs");
    const note = page.getByRole("dialog").getByRole("alert");
    await note.waitFor();

    assert.match(await note.innerText(), /author a primitive of your own under an identity of its own/);
    assert.match(await page.getByRole("dialog").innerText(), /\.cw\/vendor\/team\/guide\/theirs\.md/);
    assert.equal(await page.getByRole("button", { name: "Save" }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Delete" }).count(), 0);
  });
});

test("Preview renders the body, raw HTML shown as text rather than run (FR-119)", async () => {
  const body = "# Heading\n\n<img src=x onerror=\"document.title='ran'\">";
  const withHtml = ["---", "kind: guide", "id: no-any", "description: About.", 'globs: ["src/**"]', "---", "", body, ""].join("\n");
  await inTheBrowser({ [at(".cw/charter/guide/no-any.md")]: withHtml }, async (page) => {
    await opening(page, "no-any");
    const source = page.getByRole("dialog").locator(".cm-content");
    await source.waitFor();
    assert.match(await source.innerText(), /# Heading/);

    await page.getByRole("tab", { name: "Preview" }).click();
    const preview = page.getByRole("tabpanel", { name: "Preview" });
    await preview.locator("h1").waitFor();
    assert.equal(await preview.locator("h1").innerText(), "Heading");
    assert.match(await preview.innerText(), /<img src=x onerror=/);
    assert.equal(await preview.locator("img").count(), 0);
    assert.notEqual(await page.title(), "ran");
  });
});
