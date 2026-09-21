import { test } from "node:test";
import assert from "node:assert/strict";
import { inTheBrowser } from "./in-the-browser.js";

test("the header carries the search box, Build with its two ways to build, and Doctor", async () => {
  await inTheBrowser({}, async (page) => {
    await assert.doesNotReject(page.getByPlaceholder("Search everything").waitFor());
    await assert.doesNotReject(page.getByRole("button", { name: "Doctor" }).waitFor());
    assert.equal(await page.getByRole("menu").count(), 0);

    await page.getByLabel("More build options").click();

    assert.deepEqual(
      (await page.getByRole("menuitem").allInnerTexts()).map((item) => item.split("\n")[0]),
      ["Preview", "Build"],
    );
  });
});

test("the header reads as the mockup draws it: the brand, the search, Build and Doctor", async () => {
  await inTheBrowser({}, async (page) => {
    const header = page.locator("header");

    assert.match(await header.innerText(), /^Cherry Works/);
    assert.equal(await header.getByPlaceholder("Search everything").count(), 1);
    assert.deepEqual(
      await header.getByRole("button").evaluateAll((buttons) => buttons.map((one) => one.getAttribute("aria-label") ?? one.textContent)),
      ["Build", "More build options", "Doctor"],
    );
  });
});

test("the build menu closes on the next click anywhere", async () => {
  await inTheBrowser({}, async (page) => {
    await page.getByLabel("More build options").click();
    await page.getByRole("menu").waitFor();
    await page.mouse.click(5, 400);

    await page.getByRole("menu").waitFor({ state: "detached" });
    assert.equal(await page.getByRole("menu").count(), 0);
  });
});

test("the build menu closes on the click that chose from it", async () => {
  await inTheBrowser({}, async (page) => {
    await page.getByLabel("More build options").click();
    await page.getByRole("menuitem", { name: /Preview/ }).click();

    await page.getByRole("menu").waitFor({ state: "detached" });
    assert.equal(await page.getByRole("menu").count(), 0);
  });
});

test("the three tabs are shown, the repository charter first, and the one clicked is the one on", async () => {
  await inTheBrowser({}, async (page) => {
    assert.deepEqual(await page.getByRole("tab").allInnerTexts(), ["Repo Charter", "Vendor", "Test"]);
    assert.equal(await page.getByRole("tab", { selected: true }).innerText(), "Repo Charter");

    await page.getByRole("tab", { name: "Vendor" }).click();

    assert.equal(await page.getByRole("tab", { selected: true }).innerText(), "Vendor");
    assert.equal(await page.getByRole("tabpanel").getAttribute("aria-labelledby"), await page.getByRole("tab", { name: "Vendor" }).getAttribute("id"));
  });
});

test("the test sheet holds nothing yet, since no view is mounted in it", async () => {
  await inTheBrowser({}, async (page) => {
    await page.getByRole("tab", { name: "Test" }).click();

    assert.equal(await page.getByRole("tabpanel").innerHTML(), "");
  });
});

test("nothing is shown over the page until a view opens it", async () => {
  await inTheBrowser({}, async (page) => {
    await page.getByRole("tab").first().waitFor();

    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal(await page.locator("[data-sonner-toast]").count(), 0);
  });
});
