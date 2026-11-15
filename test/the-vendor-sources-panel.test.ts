import assert from "node:assert/strict";
import { test } from "node:test";
import { InMemorySources } from "../src/module/charter/infra/in-memory/in-memory-sources.adapter.js";
import type { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { inTheBrowser } from "./in-the-browser.js";

const at = (path: string) => new URL(path, "file:///repo/.cw/charter/primitive/").href;
const vendoredAt = (vendor: string, path: string) =>
  new URL(path, `file:///repo/.cw/charter/vendor/${vendor}/primitive/`).href;

const primitive = (kind: string, id: string) =>
  ["---", `kind: ${kind}`, `id: ${id}`, `description: About ${id}.`, "---", "", `The body of ${id}.`, ""].join("\n");

/** A repository authoring one guide, and two vendors: `acme/charter/root`,
 *  bringing two guides and a corpus, and `acme/charters/baseline`, bringing
 *  one guide. */
const withTwoVendors = () => ({
  [at("guide/no-any/index.md")]: primitive("guide", "no-any"),
  [vendoredAt("acme/charter/root", "guide/small-diffs/index.md")]: primitive("guide", "small-diffs"),
  [vendoredAt("acme/charter/root", "guide/one-question/index.md")]: primitive("guide", "one-question"),
  [vendoredAt("acme/charter/root", "corpus/why/index.md")]: primitive("corpus", "why"),
  [vendoredAt("acme/charters/baseline", "guide/old/index.md")]: primitive("guide", "old"),
});

test("with no vendor installed, the vendor tab says so, and adding one lists the reserved directories (CORE Story 8 scenario 1)", async () => {
  await inTheBrowser({ [at("guide/no-any/index.md")]: primitive("guide", "no-any") }, async (page) => {
    await page.getByRole("tab", { name: "Vendor" }).click();
    await page.getByText("No vendor source installed").waitFor();

    await page.getByRole("button", { name: "Add vendor source" }).click();
    const reserved = page.getByLabel("Reserved directories");
    await reserved.getByText("guide/").waitFor();
    for (const kind of ["sensor", "skill", "playbook", "agent", "posture", "corpus", "mixin"])
      assert.equal(await reserved.getByText(`${kind}/`, { exact: true }).count(), 1, kind);
  });
});

test("each source installed shows its folder and its primitives by kind (CORE Story 8 scenario 4, CORE Story 8 scenario 7)", async () => {
  await inTheBrowser(withTwoVendors(), async (page) => {
    await page.getByRole("tab", { name: "Vendor" }).click();
    const acme = page.getByLabel(".cw/charter/vendor/acme/charter/root", { exact: true });
    await acme.waitFor();

    assert.match(
      await acme.innerText(),
      /^acme\/charter\/root\n\.cw\/charter\/vendor\/acme\/charter\/root\/ · read-only/,
    );
    assert.deepEqual(await acme.getByLabel("Primitives by kind").locator("dt, dd").allInnerTexts(), [
      "corpus",
      "1",
      "guide",
      "2",
    ]);
    const baseline = page.getByLabel(".cw/charter/vendor/acme/charters/baseline", { exact: true });
    assert.deepEqual(await baseline.getByLabel("Primitives by kind").locator("dt, dd").allInnerTexts(), ["guide", "1"]);
  });
});

test("a source added from the dialog is installed through the engine, and the dialog closes (CORE Story 8 scenario 2)", async () => {
  const sourceFetcher = new InMemorySources();
  await inTheBrowser(
    {},
    async (page) => {
      await page.getByRole("tab", { name: "Vendor" }).click();
      await page.getByRole("button", { name: "Add vendor source" }).click();
      await page.getByLabel("source", { exact: true }).fill("git@github.com:team/charter.git");
      await page.getByLabel("version", { exact: true }).fill("v1.2.0");
      await page.getByRole("button", { name: "Add source" }).click();
      await page.getByText("Vendor source added").waitFor();

      assert.deepEqual(sourceFetcher.fetchedSources, [
        { source: "git@github.com:team/charter.git", version: "v1.2.0" },
      ]);
      assert.deepEqual(
        sourceFetcher.checkedOutFolders.map(({ intoSubFolder }) => intoSubFolder),
        [".cw/charter/vendor/team/charter/published/primitive"],
      );
      await page.getByRole("dialog").waitFor({ state: "detached" });
    },
    sourceFetcher,
  );
});

test("a source holding no charter folder is refused, and the refusal stays in the dialog, in the engine's words (CORE-FR-123)", async () => {
  const sourceFetcher = new InMemorySources();
  sourceFetcher.sourcesWithoutSubFolder.push("team/charter");
  await inTheBrowser(
    {},
    async (page) => {
      await page.getByRole("tab", { name: "Vendor" }).click();
      await page.getByRole("button", { name: "Add vendor source" }).click();
      await page.getByLabel("source", { exact: true }).fill("team/charter");
      await page.getByRole("button", { name: "Add source" }).click();
      await page.getByText("Refused, and nothing was installed").waitFor();

      assert.match(await page.getByRole("dialog").innerText(), /is no vendor[\s\S]*Check that the source holds/);
      assert.deepEqual(sourceFetcher.checkedOutFolders, []);
    },
    sourceFetcher,
  );
});

/** Every file under the vendor folder, with what it holds. */
const vendoredFilesOf = async (files: InMemoryFileReaders) =>
  Object.fromEntries(
    (await files.readFilesRecursively(new URL("file:///repo/.cw/charter/vendor/"))).map(({ fileUrl, contents }) => [
      fileUrl.href,
      contents,
    ]),
  );

test("a source that cannot be reached installs nothing, touches nothing installed, and the dialog shows why in the engine's words (CORE Story 8 scenarios 3, 6, CORE-FR-123, CORE-FR-049, CORE Story 55 scenario 11)", async () => {
  const sourceFetcher = new InMemorySources();
  sourceFetcher.unreachableSources.push("team/charter");
  await inTheBrowser(
    withTwoVendors(),
    async (page, files) => {
      const vendoredBefore = await vendoredFilesOf(files);
      await page.getByRole("tab", { name: "Vendor" }).click();
      await page.getByLabel("Vendor sources").getByRole("button", { name: "Add source" }).click();
      await page.getByLabel("source", { exact: true }).fill("team/charter");
      await page.getByRole("dialog").getByRole("button", { name: "Add source" }).click();
      await page.getByText("Refused, and nothing was installed").waitFor();

      const dialogText = await page.getByRole("dialog").innerText();
      assert.match(dialogText, /team\/charter could not be fetched\./);
      assert.match(dialogText, /Check the address, and that you can reach it from here\./);
      assert.deepEqual(sourceFetcher.checkedOutFolders, []);
      assert.deepEqual(await vendoredFilesOf(files), vendoredBefore);
    },
    sourceFetcher,
  );
});

test("a source whose charter would land on a name reserved for a kind installs nothing, touches nothing installed, and the dialog shows why (CORE Story 8 scenario 6, CORE-FR-123, CORE-FR-044, CORE Story 55 scenario 11)", async () => {
  const sourceFetcher = new InMemorySources();
  sourceFetcher.sourceFilesBySource["team/charters"] = {
    "charters/guide/.cw/charter/primitive/guide/one-rule/index.md": primitive("guide", "one-rule"),
  };
  await inTheBrowser(
    withTwoVendors(),
    async (page, files) => {
      const vendoredBefore = await vendoredFilesOf(files);
      await page.getByRole("tab", { name: "Vendor" }).click();
      await page.getByLabel("Vendor sources").getByRole("button", { name: "Add source" }).click();
      await page.getByLabel("source", { exact: true }).fill("team/charters");
      await page.getByRole("dialog").getByRole("button", { name: "Add source" }).click();
      await page.getByText("Refused, and nothing was installed").waitFor();

      const dialogText = await page.getByRole("dialog").innerText();
      assert.match(dialogText, /is named as a kind is, and a charter is never installed under a kind's name/);
      assert.deepEqual(sourceFetcher.checkedOutFolders, []);
      assert.deepEqual(await vendoredFilesOf(files), vendoredBefore);
    },
    sourceFetcher,
  );
});

test("Remove takes a source under its owner away by owner, repository and name (CORE Story 8 scenario 5, FR-050)", async () => {
  const sourceFetcher = new InMemorySources();
  await inTheBrowser(
    { ...withTwoVendors(), [vendoredAt("team/rules/root", "guide/one-rule/index.md")]: primitive("guide", "one-rule") },
    async (page) => {
      await page.getByRole("tab", { name: "Vendor" }).click();
      await page
        .getByLabel(".cw/charter/vendor/team/rules/root", { exact: true })
        .getByRole("button", { name: "Remove" })
        .click();
      await page.getByText("Vendor source removed").waitFor();

      await page.getByLabel(".cw/charter/vendor/team/rules/root", { exact: true }).waitFor({ state: "detached" });
    },
    sourceFetcher,
  );
});

test("Remove takes the source away through the engine (CORE Story 8 scenario 5)", async () => {
  const sourceFetcher = new InMemorySources();
  await inTheBrowser(
    withTwoVendors(),
    async (page) => {
      await page.getByRole("tab", { name: "Vendor" }).click();
      await page
        .getByLabel(".cw/charter/vendor/acme/charter/root", { exact: true })
        .getByRole("button", { name: "Remove" })
        .click();
      await page.getByText("Vendor source removed").waitFor();

      await page.getByLabel(".cw/charter/vendor/acme/charter/root", { exact: true }).waitFor({ state: "detached" });
    },
    sourceFetcher,
  );
});
