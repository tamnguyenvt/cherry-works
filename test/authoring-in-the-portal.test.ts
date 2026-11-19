import assert from "node:assert/strict";
import { test } from "node:test";
import type { Page } from "playwright";
import { Primitives } from "../src/module/charter/domain/models/primitive/primitive.js";
import { SensorPrimitive } from "../src/module/charter/domain/models/primitive/sensor-primitive.js";
import type { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { inTheBrowser } from "./in-the-browser.js";
import { columnOf } from "./listing-in-the-browser.js";
import { readPrimitive } from "./use-cases-of.js";

const at = (path: string) => new URL(path, "file:///repo/").href;

const primitive = (kind: string, id: string, headers: readonly string[] = []) =>
  [
    "---",
    `kind: ${kind}`,
    `id: ${id}`,
    `description: About ${id}.`,
    ...headers,
    "---",
    "",
    `The body of ${id}.`,
    "",
  ].join("\n");

const guide = (id: string) => primitive("guide", id, ['globs: ["src/**/*.ts"]']);

/** What one file holds now, or nothing where it is not there. */
const fileIn = (files: InMemoryFileReaders, path: string) => files.readIfThere(new URL(at(path)));

/** The label of every row the form shows, in order. */
const rowLabelsOf = (page: Page) => page.getByRole("dialog").locator('[data-slot="label"]').allTextContents();

/** A new primitive of one kind started from the Repo Charter view, written
 *  into the charter `team` where the repository authored none. */
const startingNew = async (page: Page, kind: string) => {
  await page.getByRole("radio", { name: kind }).click();
  await page.getByRole("button", { name: `New ${kind}` }).click();
  await page.getByRole("dialog").getByLabel("description", { exact: true }).waitFor();
  const charterBox = page.getByRole("dialog").getByLabel("charter", { exact: true });
  if ((await charterBox.inputValue()) === "") await charterBox.fill("team");
};

/** One primitive of the listing opened by its id. */
const opening = async (page: Page, id: string) => {
  await page.getByRole("button", { name: id, exact: true }).click();
  await page.getByRole("dialog").waitFor();
};

test("for every kind, New asks the id, the description, every header that kind requires, the rationale and the mixins, and no header of another kind (CORE Story 6 scenario 1, FR-117, CORE Story 55 scenario 14)", async () => {
  await inTheBrowser({}, async (page) => {
    await startingNew(page, "guide");

    for (const kind of Primitives.kinds) {
      await page.getByRole("dialog").getByLabel("kind", { exact: true }).click();
      await page.getByRole("option", { name: kind, exact: true }).click();
      const kindHeaders = Primitives.headersOf(kind);
      await page
        .getByRole("dialog")
        .locator('[data-slot="label"]')
        .nth(kindHeaders.length + 2)
        .waitFor();
      const rowLabels = await rowLabelsOf(page);

      // A header of the kind's own that it does not require may be asked as
      // well: the scenario rules out only another kind's.
      for (const askedField of [
        "id",
        "charter",
        "description",
        "rationale",
        "mixins",
        ...kindHeaders.filter(({ isRequired }) => isRequired).map(({ field }) => field),
      ])
        assert.ok(rowLabels.includes(askedField), `${kind} asks no ${askedField}`);
      const kindFields = new Set(kindHeaders.map(({ field }) => field));
      const otherKindFields = Primitives.kinds
        .flatMap((otherKind) => Primitives.headersOf(otherKind).map(({ field }) => field))
        .filter((field) => !kindFields.has(field));
      for (const otherKindField of otherKindFields)
        assert.ok(!rowLabels.includes(otherKindField), `${kind} asks ${otherKindField}, another kind's`);
    }
    assert.equal(await page.getByRole("dialog").locator(".cm-content").count(), 1, "a body editor");
  });
});

test("New asks the kind, the id and every header the kind takes, each in its shape (FR-117, FR-118, CORE Story 6 scenario 10)", async () => {
  await inTheBrowser({}, async (page) => {
    await startingNew(page, "guide");

    assert.equal(await page.getByRole("dialog").getByLabel("kind", { exact: true }).innerText(), "guide");
    assert.deepEqual(await rowLabelsOf(page), [
      "kind",
      "id",
      "charter",
      ...Primitives.headersOf("guide").map(({ field }) => field),
    ]);
    // A list is a box per entry, with a way to add the next.
    assert.equal(
      await page
        .getByRole("dialog")
        .getByLabel(/^globs \d+$/)
        .count(),
      1,
    );
    await page.getByRole("button", { name: "Add globs" }).click();
    assert.equal(
      await page
        .getByRole("dialog")
        .getByLabel(/^globs \d+$/)
        .count(),
      2,
    );
    assert.equal(await page.getByRole("dialog").locator(".cm-content").count(), 1);

    // A header read from a closed set is chosen, not typed.
    await page.getByRole("dialog").getByLabel("kind", { exact: true }).click();
    await page.getByRole("option", { name: "sensor" }).click();
    await page.getByRole("dialog").getByLabel("signal", { exact: true }).click();
    assert.deepEqual(await page.getByRole("option").allInnerTexts(), [...SensorPrimitive.signals]);
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

    const expectedMarkdown = readPrimitive({
      headers: { kind: "guide", id: "no-any", description: "Never write any.", globs: ["src/**/*.ts"] },
      body: "Use unknown.",
    }).writeMarkdown();
    assert.equal(await fileIn(files, ".cw/charter/team/primitive/guide/no-any/index.md"), expectedMarkdown);
    await page.getByRole("button", { name: "no-any", exact: true }).waitFor();
    // Nothing was compiled (CORE Story 6 scenario 8).
    assert.deepEqual((await files.readFilesRecursively(new URL(at(".cw/out/")))).length, 0);
  });
});

test("creating a script writes its index.md in the folders its id names, and an empty asset at its executionPath (FR-141, FR-167, CORE Story 23 scenario 1, CORE Story 24 scenario 2)", async () => {
  await inTheBrowser({}, async (page, files) => {
    await startingNew(page, "script");
    await page.getByRole("dialog").getByLabel("id", { exact: true }).fill("release/check");
    await page.getByRole("dialog").getByLabel("description", { exact: true }).fill("Check the changelog.");
    await page.getByRole("dialog").getByLabel("executionPath", { exact: true }).fill("./run.sh");
    await page.getByRole("button", { name: "Create primitive" }).click();
    await page.getByText("Primitive created").waitFor();
    // Said where the script itself is to be written.
    await page.getByText(/\.\/run\.sh beside it is the file it runs/).waitFor();

    assert.match(
      (await fileIn(files, ".cw/charter/team/primitive/script/release/check/index.md")) ?? "",
      /^executionPath: \.\/run\.sh$/m,
    );
    assert.equal(await fileIn(files, ".cw/charter/team/primitive/script/release/check/run.sh"), "");
  });
});

test("answers the kind refuses, and an id already claimed, are shown in the engine's words and nothing is written (CORE Story 6 scenario 3)", async () => {
  await inTheBrowser(
    { [at(".cw/charter/team/primitive/guide/no-any/index.md")]: guide("no-any") },
    async (page, files) => {
      await startingNew(page, "guide");
      await page.getByRole("dialog").getByLabel("id", { exact: true }).fill("Not A Slug");
      await page.getByRole("button", { name: "Create primitive" }).click();
      await page.getByRole("dialog").getByRole("alert").waitFor();
      assert.match(
        await page.getByRole("dialog").getByRole("alert").innerText(),
        /These headers are not what a guide holds/,
      );

      await page.getByRole("dialog").getByLabel("id", { exact: true }).fill("no-any");
      await page.getByRole("dialog").getByLabel("description", { exact: true }).fill("Again.");
      await page.getByRole("dialog").getByLabel("globs 1", { exact: true }).fill("src/**");
      await page.getByRole("button", { name: "Create primitive" }).click();
      await page.getByRole("dialog").getByRole("alert").filter({ hasText: "already there" }).waitFor();
      assert.match(
        await page.getByRole("dialog").getByRole("alert").innerText(),
        /declared by \.cw\/charter\/team\/primitive\/guide\/no-any\/index\.md/,
      );

      assert.equal(await fileIn(files, ".cw/charter/team/primitive/guide/not-a-slug/index.md"), undefined);
      assert.equal(await fileIn(files, ".cw/charter/team/primitive/guide/no-any/index.md"), guide("no-any"));
    },
  );
});

test("an existing primitive opens locked to its id, saves over its file and deletes it (CORE Story 6 scenarios 4 – 6)", async () => {
  await inTheBrowser(
    { [at(".cw/charter/team/primitive/guide/no-any/index.md")]: guide("no-any") },
    async (page, files) => {
      await opening(page, "no-any");
      await page.getByRole("dialog").getByLabel("description", { exact: true }).waitFor();

      assert.equal(await page.getByRole("dialog").getByLabel("kind", { exact: true }).count(), 0);
      assert.equal(await page.getByRole("dialog").getByLabel("id", { exact: true }).count(), 0);
      assert.match(
        await page.getByRole("dialog").innerText(),
        /rename by creating a new primitive and deleting this one/,
      );
      assert.equal(await page.getByRole("dialog").getByLabel("globs 1", { exact: true }).inputValue(), "src/**/*.ts");

      await page.getByRole("dialog").getByLabel("description", { exact: true }).fill("Never any.");
      await page.getByRole("button", { name: "Save" }).click();
      await page.getByText("Primitive saved").waitFor();
      assert.match(
        (await fileIn(files, ".cw/charter/team/primitive/guide/no-any/index.md")) ?? "",
        /description: Never any\.[\s\S]*The body of no-any\.\n$/,
      );

      await page.getByRole("dialog").waitFor({ state: "detached" });
      await opening(page, "no-any");
      await page.getByRole("button", { name: "Delete" }).click();
      await page.getByText("Primitive deleted").waitFor();
      assert.equal(await fileIn(files, ".cw/charter/team/primitive/guide/no-any/index.md"), undefined);
      assert.equal(await columnOf(page, 1).count(), 0);
    },
  );
});

test("a primitive whose id holds / opens, saves and deletes like any other (FR-141)", async () => {
  await inTheBrowser(
    { [at(".cw/charter/team/primitive/guide/mfbs/no-any/index.md")]: guide("mfbs/no-any") },
    async (page, files) => {
      await opening(page, "mfbs/no-any");
      await page.getByRole("dialog").getByLabel("description", { exact: true }).fill("Never any.");
      await page.getByRole("button", { name: "Save" }).click();
      await page.getByText("Primitive saved").waitFor();
      assert.match(
        (await fileIn(files, ".cw/charter/team/primitive/guide/mfbs/no-any/index.md")) ?? "",
        /description: Never any\./,
      );

      await page.getByRole("dialog").waitFor({ state: "detached" });
      await opening(page, "mfbs/no-any");
      await page.getByRole("button", { name: "Delete" }).click();
      await page.getByText("Primitive deleted").waitFor();
      assert.equal(await fileIn(files, ".cw/charter/team/primitive/guide/mfbs/no-any/index.md"), undefined);
    },
  );
});

test("a save over a file changed on disk is refused naming it, and the other change stays (CORE Story 6 scenario 9)", async () => {
  await inTheBrowser(
    { [at(".cw/charter/team/primitive/guide/no-any/index.md")]: guide("no-any") },
    async (page, files) => {
      await opening(page, "no-any");
      await page.getByRole("dialog").getByLabel("description", { exact: true }).waitFor();
      const changedOnDisk = guide("no-any").replace("About no-any.", "Changed elsewhere.");
      files.writeFile(new URL(at(".cw/charter/team/primitive/guide/no-any/index.md")), changedOnDisk);

      await page.getByRole("dialog").getByLabel("description", { exact: true }).fill("Mine.");
      await page.getByRole("button", { name: "Save" }).click();
      await page.getByRole("dialog").getByRole("alert").waitFor();

      assert.match(
        await page.getByRole("dialog").getByRole("alert").innerText(),
        /\.cw\/charter\/team\/primitive\/guide\/no-any\/index\.md changed on disk/,
      );
      assert.equal(await fileIn(files, ".cw/charter/team/primitive/guide/no-any/index.md"), changedOnDisk);
    },
  );
});

test("an installed primitive opens read-only, saying how to differ from it (CORE Story 6 scenario 7)", async () => {
  await inTheBrowser(
    {
      [at(".cw/charter/rules/cw-package.json")]:
        `${JSON.stringify({ charter: "rules", source: "team/rules", version: "v1" })}\n`,
      [at(".cw/charter/rules/primitive/guide/theirs/index.md")]: guide("theirs"),
    },
    async (page) => {
      await page.getByRole("tab", { name: "Installed" }).click();
      await opening(page, "theirs");
      const note = page.getByRole("dialog").getByRole("alert");
      await note.waitFor();

      assert.match(await note.innerText(), /author a primitive of your own under an id of its own/);
      assert.match(
        await page.getByRole("dialog").innerText(),
        /\.cw\/charter\/rules\/primitive\/guide\/theirs\/index\.md/,
      );
      assert.equal(await page.getByRole("button", { name: "Save" }).count(), 0);
      assert.equal(await page.getByRole("button", { name: "Delete" }).count(), 0);
    },
  );
});

test("Preview renders the body, raw HTML shown as text rather than run (FR-119, CORE Story 6 scenario 11)", async () => {
  const body = "# Heading\n\n<img src=x onerror=\"document.title='ran'\">";
  const withHtml = [
    "---",
    "kind: guide",
    "id: no-any",
    "description: About.",
    'globs: ["src/**"]',
    "---",
    "",
    body,
    "",
  ].join("\n");
  await inTheBrowser({ [at(".cw/charter/team/primitive/guide/no-any/index.md")]: withHtml }, async (page) => {
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

test("New asks the charter among those the repository authored, or a new one, and writes into it (VENDOR Story 3 scenario 13)", async () => {
  await inTheBrowser(
    {
      [at(".cw/charter/team/primitive/guide/kept/index.md")]: guide("kept"),
      [at(".cw/charter/grill/cw-package.json")]:
        `${JSON.stringify({ charter: "grill", source: "mattpocock/skills", version: "v1" })}\n`,
      [at(".cw/charter/grill/primitive/guide/grilled/index.md")]: guide("grilled"),
    },
    async (page, files) => {
      await page.getByRole("radio", { name: "guide" }).click();
      await page.getByRole("button", { name: "New guide" }).click();
      const charterBox = page.getByRole("dialog").getByLabel("charter", { exact: true });
      await page.locator("#charter-names option").first().waitFor({ state: "attached" });
      assert.equal(await charterBox.inputValue(), "team");
      assert.deepEqual(
        await page
          .locator("#charter-names option")
          .evaluateAll((options) => options.map((option) => option.getAttribute("value"))),
        ["team"],
      );

      await charterBox.fill("review");
      await page.getByRole("dialog").getByLabel("id", { exact: true }).fill("no-mocks");
      await page.getByRole("dialog").getByLabel("description", { exact: true }).fill("Never mock.");
      await page.getByRole("dialog").getByLabel("globs 1", { exact: true }).fill("src/**/*.ts");
      await page.getByRole("button", { name: "Create primitive" }).click();
      await page.getByText("Primitive created").waitFor();

      assert.match(
        (await fileIn(files, ".cw/charter/review/primitive/guide/no-mocks/index.md")) ?? "",
        /^id: no-mocks$/m,
      );
    },
  );
});
