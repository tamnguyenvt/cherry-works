import { test } from "node:test";
import assert from "node:assert/strict";
import { inTheBrowser } from "./in-the-browser.js";

const at = (path: string) => new URL(path, "file:///repo/.cw/charter/").href;
const vendoredAt = (path: string) => new URL(path, "file:///repo/.cw/vendor/acme/").href;

const primitive = (kind: string, id: string, headers: readonly string[] = []) =>
  ["---", `kind: ${kind}`, `id: ${id}`, `description: About ${id}.`, ...headers, "---", "", `The body of ${id}.`, ""].join("\n");

test("the vendor tab lists what vendors installed, and nothing authored here (FR-112)", async () => {
  const charter = {
    [at("guide/no-any.md")]: primitive("guide", "no-any"),
    [vendoredAt("guide/small-diffs.md")]: primitive("guide", "small-diffs", ['globs: ["**/*.md"]']),
  };
  await inTheBrowser(charter, async (page) => {
    await page.getByRole("button", { name: "Vendor", exact: true }).click();
    await page.locator(".chip.on").waitFor();

    assert.deepEqual(await page.locator(".chrow:not(.chhead) .cid").allInnerTexts(), ["small-diffs"]);
    assert.equal(await page.locator(".chrow:not(.chhead) .cp").innerText(), ".cw/vendor/acme/guide/small-diffs.md");
    assert.equal(await page.locator(".chip.on > b").innerText(), "1");
  });
});

test("a repository with no vendor still has every kind's chip on the vendor tab, each empty", async () => {
  await inTheBrowser({ [at("guide/no-any.md")]: primitive("guide", "no-any") }, async (page) => {
    await page.getByRole("button", { name: "Vendor", exact: true }).click();
    await page.locator(".chip.on").waitFor();

    assert.ok((await page.locator(".chip > b").allInnerTexts()).every((count) => count === "0"));
    assert.equal(await page.locator(".mem-empty").innerText(), "No guide in this charter yet.");
  });
});
