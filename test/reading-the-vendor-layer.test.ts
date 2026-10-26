import { test } from "node:test";
import assert from "node:assert/strict";
import { inTheBrowser } from "./in-the-browser.js";
import { chipsOf, columnOf, rowsOf } from "./listing-in-the-browser.js";

const at = (path: string) => new URL(path, "file:///repo/.cw/charter/").href;
const vendoredAt = (path: string) => new URL(path, "file:///repo/.cw/vendor/acme/").href;
const vendoredUnderOwnerAt = (path: string) => new URL(path, "file:///repo/.cw/vendor/team/rules/").href;

const primitive = (kind: string, id: string, headers: readonly string[] = []) =>
  ["---", `kind: ${kind}`, `id: ${id}`, `description: About ${id}.`, ...headers, "---", "", `The body of ${id}.`, ""].join("\n");

test("the vendor tab lists what vendors installed, and nothing authored here (FR-112)", async () => {
  const charter = {
    [at("guide/no-any/index.md")]: primitive("guide", "no-any"),
    [vendoredAt("guide/small-diffs/index.md")]: primitive("guide", "small-diffs", ['globs: ["**/*.md"]']),
  };
  await inTheBrowser(charter, async (page) => {
    await page.getByRole("tab", { name: "Vendor" }).click();
    await rowsOf(page).waitFor();

    assert.deepEqual(await columnOf(page, 1).allInnerTexts(), ["small-diffs"]);
    assert.equal(await columnOf(page, 2).locator("div").nth(1).innerText(), ".cw/vendor/acme/guide/small-diffs/index.md");
    assert.deepEqual((await chipsOf(page))[0], ["guide", "1"]);
  });
});

test("a source under its owner is read as a vendor layer, beside one installed by an earlier version (FR-050, FR-180)", async () => {
  const charter = {
    [at("guide/no-any/index.md")]: primitive("guide", "no-any"),
    [vendoredAt("guide/small-diffs/index.md")]: primitive("guide", "small-diffs"),
    [vendoredUnderOwnerAt("guide/one-question/index.md")]: primitive("guide", "one-question"),
  };
  await inTheBrowser(charter, async (page) => {
    await page.getByRole("tab", { name: "Vendor" }).click();
    await rowsOf(page).first().waitFor();

    assert.deepEqual((await columnOf(page, 1).allInnerTexts()).sort(), ["one-question", "small-diffs"]);
    assert.deepEqual((await chipsOf(page))[0], ["guide", "2"]);
  });
});

test("a repository with no vendor still has every kind's chip on the vendor tab, each empty", async () => {
  await inTheBrowser({ [at("guide/no-any/index.md")]: primitive("guide", "no-any") }, async (page) => {
    await page.getByRole("tab", { name: "Vendor" }).click();
    await page.getByText("No guide in this charter yet.").waitFor();

    assert.ok((await chipsOf(page)).every(([, count]) => count === "0"));
  });
});
