import assert from "node:assert/strict";
import { test } from "node:test";
import { GuidePrimitive } from "../src/module/charter/domain/models/primitive/guide-primitive.js";
import { Primitives } from "../src/module/charter/domain/models/primitive/primitive.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { wrapAppToShowPaths } from "../src/presentation/cli/commands/helper.js";
import { inTheBrowser } from "./in-the-browser.js";
import { chipsOf, columnOf, rowsOf, shownKindOf } from "./listing-in-the-browser.js";
import { buildingCharterOf } from "./use-cases-of.js";

const at = (path: string) => new URL(path, "file:///repo/.cw/charter/team/primitive/").href;
const vendoredAt = (path: string) => new URL(path, "file:///repo/.cw/charter/acme/primitive/").href;
/** What makes `acme` a charter this repository installed (VENDOR-FR-010). */
const vendorRecordFile = {
  ["file:///repo/.cw/charter/acme/cw-vendor.json"]: `${JSON.stringify({ charter: "acme", source: "acme/charter", version: "HEAD" })}\n`,
};

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

/** A charter with something of three kinds and nothing of the five others: what
 *  a reader meets, and what a chip with no primitives behind it has to survive. */
const charter = {
  [at("guide/no-any/index.md")]: primitive("guide", "no-any", [
    'globs: ["src/**/*.ts"]',
    "rationale: why",
    'mixins: ["voice"]',
  ]),
  [at("corpus/why/index.md")]: primitive("corpus", "why"),
  [at("mixin/voice/index.md")]: primitive("mixin", "voice"),
};

test("every kind the charter knows has a chip, carrying how many primitives of it are held (CORE Story 5 scenario 1)", async () => {
  await inTheBrowser(charter, async (page) => {
    // Every assertion below reads what is there rather than waiting for it, so
    // the view is waited for once, here.
    await page.getByRole("radio", { checked: true }).waitFor();

    // The sensor, the skill and the script the engine brings are counted
    // with what the repository authored.
    assert.deepEqual(
      await chipsOf(page),
      Primitives.kinds.map((kind, index) => [kind, ["1", "1", "1", "0", "0", "0", "1", "1", "0", "1", "0"][index]]),
    );
  });
});

test("the line above the table says when the shown kind comes up, in the words the kind declares (CORE Story 5 scenario 2)", async () => {
  await inTheBrowser(charter, async (page) => {
    assert.equal(await shownKindOf(page), "guide");
    assert.equal(await page.getByLabel("Activates when").innerText(), GuidePrimitive.activatesWhen);
  });
});

test("a guide is listed with what it is for, the file it is in, the globs it matches and the corpus it cites (CORE Story 5 scenario 2)", async () => {
  await inTheBrowser(charter, async (page) => {
    const row = rowsOf(page);

    assert.equal(await row.locator("td").nth(0).innerText(), "no-any");
    assert.equal(await row.locator("td").nth(1).locator("div").nth(0).innerText(), "About no-any.");
    assert.equal(
      await row.locator("td").nth(1).locator("div").nth(1).innerText(),
      ".cw/charter/team/primitive/guide/no-any/index.md",
    );
    assert.equal(await row.getByRole("cell", { name: "Matching globs" }).innerText(), "src/**/*.ts");
    assert.equal(await row.getByRole("cell", { name: "Rationale" }).innerText(), "why");
    assert.equal(await row.getByRole("cell", { name: "Mixins" }).innerText(), "voice");
  });
});

test("a guide declaring no globs is listed as matching all patterns, since it comes up every turn", async () => {
  await inTheBrowser({ [at("guide/everywhere/index.md")]: primitive("guide", "everywhere") }, async (page) => {
    assert.equal(await rowsOf(page).getByRole("cell", { name: "Matching globs" }).innerText(), "all patterns");
  });
});

test("a mixin is listed without a column for the mixins it may not name", async () => {
  await inTheBrowser(charter, async (page) => {
    await page.getByRole("radio", { name: "mixin" }).click();
    await page.getByRole("table", { name: "mixin primitives" }).waitFor();

    assert.deepEqual(await page.getByRole("columnheader").allTextContents(), ["Id", "Description", ""]);
    assert.equal(await columnOf(page, 1).innerText(), "voice");
  });
});

test("a kind the charter holds nothing of says so in place of a table (CORE Story 5 scenario 6)", async () => {
  await inTheBrowser(charter, async (page) => {
    await page.getByRole("radio", { name: "posture" }).click();

    await page.getByText("No posture in this charter yet.").waitFor();
    assert.equal(await page.getByRole("table").count(), 0);
  });
});

test("the charter is read again when the tab is shown again, so a file written meanwhile is listed (CORE Story 5 scenario 9)", async () => {
  await inTheBrowser(charter, async (page, files) => {
    await rowsOf(page).waitFor();

    files.writeFile(new URL(at("guide/no-casts/index.md")), primitive("guide", "no-casts", ['globs: ["src/**/*.ts"]']));
    await page.getByRole("tab", { name: "Vendor" }).click();
    await page.getByRole("tab", { name: "Repo Charter" }).click();
    await rowsOf(page).nth(1).waitFor();

    assert.deepEqual(await columnOf(page, 1).allInnerTexts(), ["no-any", "no-casts"]);
  });
});

test("a charter the engine will not read shows every fault under its file in place of a listing (FR-115)", async () => {
  await inTheBrowser({ [at("guide/broken/index.md")]: "not a primitive at all\n" }, async (page) => {
    await page.getByRole("alert").waitFor();

    assert.match(await page.getByRole("alert").innerText(), /The engine will not read this charter/);
    const refusedFiles = page.getByRole("table", { name: "Refused files" });
    assert.deepEqual(await refusedFiles.locator("tr td:first-child").allInnerTexts(), [
      ".cw/charter/team/primitive/guide/broken/index.md",
    ]);
    assert.ok((await refusedFiles.locator("tr td:nth-child(2) p").count()) > 0);
    assert.equal(await page.getByRole("radio").count(), 0);
  });
});

test("a charter with two files claiming one id shows, in place of a listing, every fault cw doctor gives, under the same files, and nothing else (CORE Story 5 scenario 5, FR-115, CORE Story 55 scenario 8)", async () => {
  // One id in the repository and in a vendor: a collision, filed where it
  // has to change.
  const collidingCharter = {
    [at("guide/no-any/index.md")]: primitive("guide", "no-any", ['globs: ["src/**/*.ts"]']),
    ...vendorRecordFile,
    [vendoredAt("guide/no-any/index.md")]: primitive("guide", "no-any"),
  };
  await inTheBrowser(collidingCharter, async (page, files) => {
    await page.getByRole("alert").waitFor();
    const doctorOutcomeDTO = await wrapAppToShowPaths(
      buildingCharterOf(
        files,
        new InMemoryFileOutput(files),
        new InMemoryTokenCounter(),
        { claude: new InMemoryAgentCli() },
        new InMemoryReporter(),
      ),
      "/repo",
    ).diagnoseCharter();
    assert.equal(doctorOutcomeDTO.type, "DoctorOutcome");
    const doctorFaultsByFilePath =
      doctorOutcomeDTO.type === "DoctorOutcome" ? doctorOutcomeDTO.data.faultsByFile.data.files : {};

    assert.match(await page.getByRole("alert").innerText(), /The engine will not read this charter/);
    assert.equal(await page.getByRole("radio").count(), 0);
    const refusedFileRows = page.getByRole("table", { name: "Refused files" }).locator("tr");
    const shownFaultsByFilePath = Object.fromEntries(
      await refusedFileRows.evaluateAll((rows) =>
        rows.map((row) => [
          row.querySelector("td")!.textContent,
          [...row.querySelectorAll("td:nth-child(2) p")].map((paragraph) => paragraph.textContent),
        ]),
      ),
    );
    assert.deepEqual(Object.keys(shownFaultsByFilePath).sort(), Object.keys(doctorFaultsByFilePath).sort());
    assert.ok(Object.keys(doctorFaultsByFilePath).length > 0, "the collision is a fault cw doctor gives");
    assert.match(JSON.stringify(shownFaultsByFilePath), /\.cw\/charter\/acme\/primitive\/guide\/no-any\/index\.md/);
    for (const [filePath, doctorFaults] of Object.entries(doctorFaultsByFilePath))
      assert.deepEqual(
        [...(shownFaultsByFilePath[filePath] ?? [])].sort(),
        doctorFaults.map(({ data: { severity, message, fix } }) => `${severity}${message} ${fix}`).sort(),
        filePath,
      );
  });
});

test("the repository's tab lists what was authored here and what the engine brings, and nothing vendored (FR-112)", async () => {
  const vendored = vendoredAt("guide/small-diffs/index.md");
  await inTheBrowser(
    { ...charter, ...vendorRecordFile, [vendored]: primitive("guide", "small-diffs") },
    async (page) => {
      await rowsOf(page).waitFor();

      assert.deepEqual(await columnOf(page, 1).allInnerTexts(), ["no-any"]);
      await page.getByRole("radio", { name: "skill" }).click();
      await page.getByRole("table", { name: "skill primitives" }).waitFor();
      assert.deepEqual(await columnOf(page, 2).locator("div:nth-child(2)").allInnerTexts(), [
        "(built into cw)/skill/cw-author/index.md",
      ]);
    },
  );
});
