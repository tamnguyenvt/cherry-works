import assert from "node:assert/strict";
import { test } from "node:test";
import { inTheBrowser } from "./in-the-browser.js";

test("the header reads as the mockup draws it: the brand, the search, Build and Doctor", async () => {
  await inTheBrowser({}, async (page) => {
    const header = page.locator("header");

    assert.match(await header.innerText(), /^Cherry Works/);
    assert.equal(await header.getByPlaceholder("Search everything").count(), 1);
    assert.deepEqual(
      await header
        .getByRole("button")
        .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label") ?? button.textContent)),
      ["Build", "Doctor"],
    );
  });
});

test("the four tabs are shown, the repository charter first, and the one clicked is the one on", async () => {
  await inTheBrowser({}, async (page) => {
    assert.deepEqual(await page.getByRole("tab").allInnerTexts(), ["Repo Charter", "Installed", "Test", "Context"]);
    assert.equal(await page.getByRole("tab", { selected: true }).innerText(), "Repo Charter");

    await page.getByRole("tab", { name: "Installed" }).click();

    assert.equal(await page.getByRole("tab", { selected: true }).innerText(), "Installed");
    assert.equal(
      await page.getByRole("tabpanel").getAttribute("aria-labelledby"),
      await page.getByRole("tab", { name: "Installed" }).getAttribute("id"),
    );
  });
});

test("nothing is shown over the page until a view opens it", async () => {
  await inTheBrowser({}, async (page) => {
    await page.getByRole("tab").first().waitFor();

    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal(await page.locator("[data-sonner-toast]").count(), 0);
  });
});
