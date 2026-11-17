import assert from "node:assert/strict";
import { test } from "node:test";
import type { Page } from "playwright";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { inTheBrowser } from "./in-the-browser.js";
import { authoringCharterOf } from "./use-cases-of.js";

const at = (path: string) => new URL(path, "file:///repo/.cw/charter/primitive/").href;
const vendoredAt = (path: string) => new URL(path, "file:///repo/.cw/charter/vendor/acme/charter/root/primitive/").href;

const primitive = (kind: string, id: string, headers: readonly string[] = [], description = `About ${id}.`) =>
  [
    "---",
    `kind: ${kind}`,
    `id: ${id}`,
    `description: ${description}`,
    ...headers,
    "---",
    "",
    `The body of ${id}.`,
    "",
  ].join("\n");

/** A primitive of the repository and one of a vendor, and one whose
 *  description says what its id does not. */
const charter = {
  [at("sensor/check/index.md")]: primitive("sensor", "check", ["signal: PostToolUse", "run: pnpm lint"]),
  [vendoredAt("guide/lint-clean/index.md")]: primitive("guide", "lint-clean", ['globs: ["src/**/*.ts"]']),
  [at("guide/no-any/index.md")]: primitive("guide", "no-any", ['globs: ["src/**/*.ts"]'], "Write unknown, never any."),
};

/** The body editor of `no-any`, opened, with the cursor at the end of its
 *  body. */
const bodySourceOf = async (page: Page) => {
  await page.getByRole("button", { name: "no-any", exact: true }).click();
  const source = page.getByRole("dialog").locator(".cm-content");
  await source.click();
  await page.keyboard.press("ControlOrMeta+End");
  return source;
};

/** The list the editor opened, while it takes a choice: a list still asking
 *  again for the key typed last is shown, and refuses one. */
const ENABLED_LIST_SELECTOR = ".cm-tooltip-autocomplete:not(.cm-tooltip-autocomplete-disabled)";

/** How long the editor takes no choice by key once its list opens, as a key
 *  pressed while it pops up is meant for the text: CodeMirror's
 *  `interactionDelay`, left at its default by the editor's `autocompletion`
 *  in `src/presentation/portal/page/components/primitive-body.component.tsx`. */
const INTERACTION_DELAY_MS = 75;

/** The list the editor opened, once it holds only the entry named
 *  `onlyId`: what was typed last is listed, not a step on the way to it. */
const narrowingTo = async (page: Page, onlyId: string) => {
  // The editor may read the key typed last at the next frame, and the list
  // answers what it has read.
  await page.evaluate("new Promise((resolve) => requestAnimationFrame(resolve))");
  const mentionOptions = page.locator(ENABLED_LIST_SELECTOR).getByRole("option");
  await mentionOptions.getByText(onlyId, { exact: true }).waitFor();
  await mentionOptions.nth(1).waitFor({ state: "detached" });
  await page.waitForTimeout(INTERACTION_DELAY_MS);
};

/** The list the editor opened: each entry as its id, its kind and its
 *  description. */
const mentionOptionsOf = (page: Page) =>
  page
    .locator(".cm-tooltip-autocomplete")
    .getByRole("option")
    .evaluateAll((options) =>
      options.map((option) => [
        option.querySelector(".cm-completionLabel")?.textContent,
        option.querySelector(".cm-completionDetail")?.textContent,
        option.querySelector(".cm-mentionDescription")?.textContent,
      ]),
    );

test("typing [[ in the body lists every primitive the charter holds, vendored and builtin included, each by its id, kind and description (CORE Story 70 scenario 1, FR-245)", async () => {
  const files = new InMemoryFileReaders(charter);
  const primitivesAnswer = await authoringCharterOf(
    files,
    new InMemoryFileOutput(files),
    new InMemoryReporter(),
  ).listPrimitives();
  assert.equal(primitivesAnswer.type, "Primitives");
  const listedPrimitives = primitivesAnswer.data.primitives.map(({ data: listedPrimitive }) => listedPrimitive);
  assert.ok(listedPrimitives.some(({ layerName }) => layerName === "builtin"));

  await inTheBrowser(charter, async (page) => {
    await bodySourceOf(page);
    await page.keyboard.type("[[");
    await page.locator(".cm-tooltip-autocomplete").getByRole("option").first().waitFor();

    assert.deepEqual(
      await mentionOptionsOf(page),
      listedPrimitives.map(({ id, kind, description }) => [id, kind, description]),
    );
  });
});

test("typing on narrows the list to what holds the text in its id or description, and says when nothing does (CORE Story 70 scenario 2, FR-245)", async () => {
  await inTheBrowser(charter, async (page) => {
    const source = await bodySourceOf(page);
    await page.keyboard.type("[[LINT");
    await narrowingTo(page, "lint-clean");
    assert.deepEqual(
      (await mentionOptionsOf(page)).map(([id]) => id),
      ["lint-clean"],
    );

    await page.keyboard.press("Escape");
    await page.locator(".cm-tooltip-autocomplete").waitFor({ state: "detached" });
    await page.keyboard.type(" [[unknown");
    await narrowingTo(page, "no-any");
    assert.deepEqual(
      (await mentionOptionsOf(page)).map(([id]) => id),
      ["no-any"],
    );

    await page.keyboard.type("-nowhere-at-all");
    // Pressed once the editor has read the key typed last, its list asks no
    // more, and it takes a choice by key, as `narrowingTo` waits for an id.
    await page.evaluate("new Promise((resolve) => requestAnimationFrame(resolve))");
    await assert.doesNotReject(
      page.locator(ENABLED_LIST_SELECTOR).getByText("Nothing in the charter matches.").waitFor(),
    );
    await page.waitForTimeout(INTERACTION_DELAY_MS);

    // Choosing that line closes the list, as Escape does.
    await page.keyboard.press("Enter");
    await assert.doesNotReject(page.locator(".cm-tooltip-autocomplete").waitFor({ state: "detached" }));
    assert.match(await source.innerText(), /\[\[unknown-nowhere-at-all$/);
  });
});

test("a primitive chosen by keyboard or by pointer is written as [[<id>]], and built it names that primitive (CORE Story 70 scenario 3, FR-246, SC-077)", async () => {
  await inTheBrowser(charter, async (page, files) => {
    const source = await bodySourceOf(page);
    await page.keyboard.type(" Read [[lint-c");
    await narrowingTo(page, "lint-clean");
    await page.keyboard.press("Enter");
    await page.keyboard.type(" and [[che");
    await page.locator(".cm-tooltip-autocomplete").getByRole("option", { name: /check/ }).click();

    assert.match(await source.innerText(), /The body of no-any\. Read \[\[lint-clean\]\] and \[\[check\]\]$/);

    await page.getByRole("button", { name: "Save" }).click();
    await page.getByText("Primitive saved").waitFor();
    await page.getByRole("button", { name: "Build", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Build", exact: true }).click();
    await page.getByRole("table", { name: "Build written" }).waitFor();

    const builtGuideMarkdown = (await files.readIfThere(new URL("file:///repo/.cw/out/guide/no-any/index.md"))) ?? "";
    assert.match(
      builtGuideMarkdown,
      /Read \[lint-clean\]\([^)]*lint-clean\/index\.md\) and \[check\]\([^)]*check\/index\.md\)/,
    );
  });
});

test("Enter once the list is narrowed chooses the mention, even typed while the list still shows what an earlier key narrowed it to (CORE Story 70 scenario 3, FR-246)", async () => {
  await inTheBrowser(charter, async (page) => {
    const source = await bodySourceOf(page);
    // `[[lint-` already narrows the list to lint-clean, so the key after it
    // leaves the list showing just that while it asks again.
    await page.keyboard.type(" Read [[lint-");
    await narrowingTo(page, "lint-clean");
    await page.keyboard.type("c");
    await narrowingTo(page, "lint-clean");
    await page.keyboard.press("Enter");

    assert.match(await source.innerText(), /Read \[\[lint-clean\]\]$/);
  });
});

test("a primitive chosen inside a mention already written replaces that mention whole (CORE Story 70 scenario 3, FR-246)", async () => {
  await inTheBrowser(charter, async (page) => {
    const source = await bodySourceOf(page);
    await page.keyboard.type(" Read [[li]] now");
    for (const _ of " now]]") await page.keyboard.press("ArrowLeft");
    await page.keyboard.type("nt-c");
    await narrowingTo(page, "lint-clean");
    await page.keyboard.press("Enter");

    assert.match(await source.innerText(), /Read \[\[lint-clean\]\] now$/);
  });
});

test("Escape closes the list and leaves the text as typed (CORE Story 70 scenario 4, FR-246)", async () => {
  await inTheBrowser(charter, async (page) => {
    const source = await bodySourceOf(page);
    await page.keyboard.type(" [[lint");
    await page.locator(".cm-tooltip-autocomplete").getByRole("option").first().waitFor();
    await page.keyboard.press("Escape");

    await assert.doesNotReject(page.locator(".cm-tooltip-autocomplete").waitFor({ state: "detached" }));
    assert.match(await source.innerText(), /The body of no-any\. \[\[lint$/);
    await page.getByRole("dialog").waitFor();
  });
});

test("[[ typed inside a code block of the body opens the list as anywhere, and Escape leaves the text as typed (CORE Story 70 edge case, FR-245, FR-246)", async () => {
  await inTheBrowser(charter, async (page) => {
    const source = await bodySourceOf(page);
    await page.keyboard.press("Enter");
    await page.keyboard.type("```");
    await page.keyboard.press("Enter");
    await page.keyboard.type("[[lint");
    await narrowingTo(page, "lint-clean");
    await page.keyboard.press("Escape");

    await assert.doesNotReject(page.locator(".cm-tooltip-autocomplete").waitFor({ state: "detached" }));
    assert.match(await source.innerText(), /```\n\[\[lint$/);
  });
});

test("typing [[ in a header field opens no list (CORE Story 70 scenario 5, FR-245)", async () => {
  await inTheBrowser(charter, async (page) => {
    await page.getByRole("button", { name: "no-any", exact: true }).click();
    const descriptionInput = page.getByRole("dialog").getByLabel("description", { exact: true });
    await descriptionInput.click();
    await page.keyboard.type(" [[lint");

    assert.equal(await descriptionInput.inputValue(), "Write unknown, never any. [[lint");
    assert.equal(await page.locator(".cm-tooltip-autocomplete").count(), 0);
    assert.equal(await page.getByRole("option").count(), 0);
  });
});

test("a body the author can edit says beneath it to type [[ to mention another primitive, and a vendor's read-only body does not (CORE Story 70 scenario 6, FR-245)", async () => {
  await inTheBrowser(charter, async (page) => {
    const mentionHint = page.getByRole("dialog").getByText("Type [[ to mention another primitive.", { exact: true });
    await page.getByRole("button", { name: "no-any", exact: true }).click();
    await assert.doesNotReject(mentionHint.waitFor());
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("dialog").waitFor({ state: "detached" });

    await page.getByRole("tab", { name: "Vendor" }).click();
    await page.getByRole("button", { name: "lint-clean", exact: true }).click();
    // Opened once it says how to differ from a vendored primitive.
    await page.getByRole("dialog").getByRole("alert").waitFor();
    assert.equal(await mentionHint.count(), 0);
  });
});

test("where the engine stops reading the charter while the body is open, [[ opens no list (CORE Story 70 edge case, FR-245)", async () => {
  await inTheBrowser(charter, async (page, files) => {
    await page.getByRole("button", { name: "no-any", exact: true }).waitFor();
    files.writeFile(
      new URL(at("guide/broken/index.md")),
      primitive("guide", "broken", ['globs: ["src/**/*.ts"]', 'mixins: ["nowhere"]']),
    );
    // Opening the primitive asks the engine for the charter again, which it
    // now refuses.
    const primitivesResponse = page.waitForResponse((response) => response.url().includes("/charter/root/primitives"));
    const source = await bodySourceOf(page);
    await primitivesResponse;
    await page.keyboard.type(" [[");

    assert.match(await source.innerText(), /\[\[$/);
    assert.equal(await page.locator(".cm-tooltip-autocomplete").count(), 0);
  });
});
