import { test } from "node:test";
import assert from "node:assert/strict";
import { inTheBrowser } from "./in-the-browser.js";

const at = (path: string) => new URL(path, "file:///repo/.cw/charter/").href;
const vendoredAt = (path: string) => new URL(path, "file:///repo/.cw/vendor/acme/").href;

const primitive = (kind: string, id: string, headers: readonly string[] = []) =>
  ["---", `kind: ${kind}`, `id: ${id}`, `description: About ${id}.`, ...headers, "---", "", `The body of ${id}.`, ""].join("\n");

/** A primitive of each layer that mentions "lint", and one that does not. */
const charter = {
  [at("sensor/check.md")]: primitive("sensor", "check", ["signal: PostToolUse", "run: pnpm lint"]),
  [vendoredAt("guide/lint-clean.md")]: primitive("guide", "lint-clean"),
  [at("guide/no-any.md")]: primitive("guide", "no-any"),
};

test("a word typed in the search lists what mentions it in every layer, a header value included (FR-114)", async () => {
  await inTheBrowser(charter, async (page) => {
    await page.getByPlaceholder("Search everything").fill("lint");
    await page.locator(".chrow.s:not(.chhead)").nth(1).waitFor();

    assert.deepEqual(await page.locator(".chrow.s:not(.chhead) .cid").allInnerTexts(), ["guide:lint-clean", "sensor:check"]);
    assert.equal(await page.locator(".chip").count(), 0);
  });
});

test("a word nothing mentions says so", async () => {
  await inTheBrowser(charter, async (page) => {
    await page.getByPlaceholder("Search everything").fill("nowhere-at-all");

    assert.equal(await page.locator(".mem-empty").innerText(), "Nothing in the charter says that.");
  });
});

test("clearing the search returns to the tab that was showing (Story 5, scenario 7)", async () => {
  await inTheBrowser(charter, async (page) => {
    await page.getByRole("button", { name: "Vendor", exact: true }).click();
    await page.getByPlaceholder("Search everything").fill("lint");
    await page.getByRole("button", { name: "Clear" }).click();
    await page.locator(".chip.on").waitFor();

    assert.equal(await page.getByPlaceholder("Search everything").inputValue(), "");
    assert.equal(await page.locator(".flowtab.on").innerText(), "Vendor");
    assert.deepEqual(await page.locator(".chrow:not(.chhead) .cid").allInnerTexts(), ["lint-clean"]);
  });
});
