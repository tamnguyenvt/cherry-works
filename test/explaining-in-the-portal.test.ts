import { test } from "node:test";
import assert from "node:assert/strict";
import { inTheBrowser } from "./in-the-browser.js";
import { GuidePrimitive } from "../src/hexagon/domain/models/charter/primitive/GuidePrimitive.js";

const at = (path: string) => new URL(path, "file:///repo/.cw/charter/").href;

const primitive = (kind: string, id: string, headers: readonly string[] = []) =>
  ["---", `kind: ${kind}`, `id: ${id}`, `description: About ${id}.`, ...headers, "---", "", `The body of ${id}.`, ""].join("\n");

/** A guide pulling in a mixin and citing a corpus, and a test case naming it. */
const charter = {
  [at("guide/no-any/index.md")]: primitive("guide", "no-any", ['globs: ["src/**/*.ts"]', "rationale: corpus:why", 'mixins: ["voice"]']),
  [at("corpus/why/index.md")]: primitive("corpus", "why"),
  [at("mixin/voice/index.md")]: primitive("mixin", "voice"),
  "file:///repo/.cw/test/activation.json": `${JSON.stringify({ cases: [{ do: { touchFile: "src/one.ts" }, expect: { activate: "guide:no-any" } }] })}\n`,
};

/** The text of each part of the dialog, under its title. */
const sectionsOf = async (page: import("playwright").Page) =>
  Object.fromEntries(
    await page
      .getByRole("dialog")
      .getByRole("region")
      .evaluateAll((sections) => sections.map((section) => [section.getAttribute("aria-label"), section.querySelector("h3 + div")!.textContent])),
  );

test("a row's Explain opens what the engine says of it: when it comes up, what it pulls in, what names it (FR-029)", async () => {
  await inTheBrowser(charter, async (page) => {
    await page.getByLabel("Explain guide:no-any").click();
    await page.getByRole("dialog").getByRole("region").first().waitFor();

    assert.equal(await page.getByRole("dialog").locator('[data-slot="dialog-description"]').innerText(), "guide:no-any");
    const sections = await sectionsOf(page);
    assert.equal(sections["When it comes up"], GuidePrimitive.activatesWhen);
    assert.match(sections["What it pulls in"], /mixin:voice/);
    assert.match(sections["What it pulls in"], /corpus:why/);
    assert.match(sections["Tested by"], /\.cw\/test\/activation\.jsontouching src\/one\.ts activates guide:no-any/);
    assert.match(sections["File"], /\.cw\/charter\/guide\/no-any\/index\.md in the repo layer/);
  });
});

test("a sensor's explanation shows the signal it answers to and the command it runs", async () => {
  await inTheBrowser({ [at("sensor/check/index.md")]: primitive("sensor", "check", ["signal: Stop", "run: pnpm lint"]) }, async (page) => {
    await page.getByRole("radio", { name: "sensor" }).click();
    await page.getByLabel("Explain sensor:check").click();
    await page.getByRole("dialog").getByRole("region").first().waitFor();

    const declaredHeaders = await page
      .getByRole("region", { name: "What it declares" })
      .locator("dl > div")
      .evaluateAll((rows) => rows.map((row) => [row.querySelector("dt")!.textContent, row.querySelector("dd")!.textContent]));
    assert.deepEqual(declaredHeaders, [
      ["signal", "Stop"],
      ["run", "pnpm lint"],
    ]);
  });
});

test("every identity in an explanation opens its own (FR-116)", async () => {
  await inTheBrowser(charter, async (page) => {
    await page.getByLabel("Explain guide:no-any").click();
    await page.getByRole("dialog").getByRole("button", { name: "corpus:why" }).click();
    await page.getByRole("dialog").locator('[data-slot="dialog-description"]', { hasText: "corpus:why" }).waitFor();
    await page.getByRole("dialog").getByRole("button", { name: "guide:no-any" }).waitFor();

    assert.match((await sectionsOf(page))["Cited by"], /guide:no-any/);
  });
});

test("a script's explanation names the primitives whose body names it (FR-163)", async () => {
  const naming = {
    [at("script/check/index.md")]: primitive("script", "check", ["executionPath: ./run.sh"]),
    [at("script/check/run.sh")]: "true\n",
    [at("skill/release/index.md")]: ["---", "kind: skill", "id: release", "description: About release.", 'triggers: ["release"]', "---", "", "Run script:check.", ""].join("\n"),
  };
  await inTheBrowser(naming, async (page) => {
    await page.getByRole("radio", { name: "script" }).click();
    await page.getByLabel("Explain script:check").click();
    await page.getByRole("dialog").getByRole("region").first().waitFor();

    assert.equal((await sectionsOf(page))["Mentioned in"], "skill:release");
  });
});

test("a rationale no corpus answers to is said not to resolve", async () => {
  await inTheBrowser({ [at("guide/no-any/index.md")]: primitive("guide", "no-any", ["rationale: corpus:gone"]) }, async (page) => {
    await page.getByLabel("Explain guide:no-any").click();
    await page.getByRole("dialog").getByRole("region").first().waitFor();

    assert.equal((await sectionsOf(page))["What it pulls in"], "corpus:gone (does not resolve)");
  });
});

test("the dialog closes by its ×, by the overlay behind it, and by Escape", async () => {
  await inTheBrowser(charter, async (page) => {
    const explain = page.getByLabel("Explain guide:no-any");

    await explain.click();
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
    await page.getByRole("dialog").waitFor({ state: "detached" });

    await explain.click();
    // Clicked once the dialog has finished coming in, as a reader clicks: a
    // click while it is still animating in is not taken as one outside it.
    await page.evaluate("Promise.all(document.querySelector('[role=dialog]').getAnimations().map((animation) => animation.finished))");
    await page.mouse.click(5, 5);
    await page.getByRole("dialog").waitFor({ state: "detached" });

    await explain.click();
    // Pressed once the modal is drawn, as a reader presses it: the key is
    // listened for from then on.
    await page.getByRole("dialog").getByRole("region").first().waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });
    assert.equal(await page.getByRole("dialog").count(), 0);
  });
});
