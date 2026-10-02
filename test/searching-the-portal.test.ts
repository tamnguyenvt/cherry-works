import { test } from "node:test";
import assert from "node:assert/strict";
import { inTheBrowser } from "./in-the-browser.js";
import { rowsOf } from "./listing-in-the-browser.js";

const at = (path: string) => new URL(path, "file:///repo/.cw/charter/").href;
const vendoredAt = (path: string) => new URL(path, "file:///repo/.cw/vendor/acme/").href;

const primitive = (kind: string, id: string, headers: readonly string[] = []) =>
  ["---", `kind: ${kind}`, `id: ${id}`, `description: About ${id}.`, ...headers, "---", "", `The body of ${id}.`, ""].join("\n");

/** A primitive of each layer that mentions "lint", and one that does not. */
const charter = {
  [at("sensor/check/index.md")]: primitive("sensor", "check", ["signal: PostToolUse", "run: pnpm lint"]),
  [vendoredAt("guide/lint-clean/index.md")]: primitive("guide", "lint-clean"),
  [at("guide/no-any/index.md")]: primitive("guide", "no-any"),
};

test("a word typed in the search lists what mentions it in every layer under the box, a header value included (FR-114)", async () => {
  await inTheBrowser(charter, async (page) => {
    await rowsOf(page).waitFor();
    await page.getByPlaceholder("Search everything").fill("lint");
    await page.getByRole("option").nth(1).waitFor();

    assert.deepEqual(
      await page.getByRole("option").evaluateAll((options) => options.map((option) => option.getAttribute("data-value"))),
      ["check", "lint-clean"],
    );
    // The listing under the tabs is left as it was.
    assert.equal(await rowsOf(page).count(), 1);
  });
});

test("a word nothing mentions says so", async () => {
  await inTheBrowser(charter, async (page) => {
    await page.getByPlaceholder("Search everything").fill("nowhere-at-all");

    await assert.doesNotReject(page.getByText("Nothing in the charter says that.").waitFor());
  });
});

test("choosing a result opens it where it is listed: its layer's tab, its kind (Story 5, scenario 7)", async () => {
  await inTheBrowser(charter, async (page) => {
    await page.getByPlaceholder("Search everything").fill("lint");
    await page.getByRole("option", { name: /lint-clean/ }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("alert").waitFor();
    assert.equal(await dialog.locator('[data-slot="dialog-title"]').innerText(), "lint-clean");
    assert.equal(await page.getByPlaceholder("Search everything").inputValue(), "");

    await dialog.getByRole("button", { name: "Close" }).click();
    await dialog.waitFor({ state: "detached" });
    assert.equal(await page.getByRole("tab", { selected: true }).innerText(), "Vendor");
    assert.equal(await page.getByRole("radio", { checked: true }).getAttribute("aria-label"), "guide");
  });
});

test("Escape clears the search and leaves the tab as it was", async () => {
  await inTheBrowser(charter, async (page) => {
    await page.getByRole("tab", { name: "Vendor" }).click();
    await page.getByPlaceholder("Search everything").fill("lint");
    await page.getByRole("option").first().waitFor();
    await page.keyboard.press("Escape");

    assert.equal(await page.getByPlaceholder("Search everything").inputValue(), "");
    assert.equal(await page.getByRole("option").count(), 0);
    assert.equal(await page.getByRole("tab", { selected: true }).innerText(), "Vendor");
  });
});
