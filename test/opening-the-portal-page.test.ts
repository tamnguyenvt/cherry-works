import { test } from "node:test";
import assert from "node:assert/strict";
import { inTheBrowser } from "./in-the-browser.js";

test("the header carries the search box, Build with its two ways to build, and Doctor", async () => {
  await inTheBrowser({}, async (page) => {
    await assert.doesNotReject(page.getByPlaceholder("Search everything").waitFor());
    assert.equal(await page.locator(".split .menu").count(), 0);

    await page.getByLabel("More build options").click();

    assert.deepEqual(await page.locator(".split .menu b").allInnerTexts(), ["Preview", "Build"]);
    await assert.doesNotReject(page.getByRole("button", { name: "Doctor" }).waitFor());
  });
});

test("the header reads as the mockup draws it: the brand, the repository, the search, Build and Doctor", async () => {
  await inTheBrowser({}, async (page) => {
    const headerClasses = await page.locator(".top > *").evaluateAll((children) => children.map(({ className }) => className));

    assert.deepEqual(headerClasses, ["brand", "repo", "search", "split", "btn"]);
    assert.equal(await page.locator(".top > .btn").innerText(), "Doctor");
  });
});

test("the build menu closes on the next click anywhere", async () => {
  await inTheBrowser({}, async (page) => {
    await page.getByLabel("More build options").click();
    await page.locator(".sheet").click();

    assert.equal(await page.locator(".split .menu").count(), 0);
  });
});

test("the build menu closes on the click that chose from it", async () => {
  await inTheBrowser({}, async (page) => {
    await page.getByLabel("More build options").click();
    await page.locator(".split .menu button", { hasText: "Preview" }).click();

    assert.equal(await page.locator(".split .menu").count(), 0);
  });
});

test("the three tabs are shown, the repository charter first, and the one clicked is the one on", async () => {
  await inTheBrowser({}, async (page) => {
    assert.deepEqual(await page.locator(".flowtab").allInnerTexts(), ["Repo Charter", "Vendor", "Test"]);
    assert.equal(await page.locator(".flowtab.on").innerText(), "Repo Charter");

    await page.getByRole("button", { name: "Vendor" }).click();

    assert.equal(await page.locator(".flowtab.on").innerText(), "Vendor");
    assert.equal(await page.locator(".sheet").getAttribute("data-tab"), "vendor");
  });
});

test("the test sheet holds nothing yet, since no view is mounted in it", async () => {
  await inTheBrowser({}, async (page) => {
    await page.getByRole("button", { name: "Test", exact: true }).click();

    assert.equal(await page.locator(".sheet").innerHTML(), "");
  });
});

test("nothing is shown over the page until a view opens it", async () => {
  await inTheBrowser({}, async (page) => {
    assert.equal(await page.locator(".mdovl").count(), 0);
    assert.equal(await page.locator(".toast").count(), 0);
  });
});
