import { test } from "node:test";
import assert from "node:assert/strict";
import { inTheBrowser } from "./in-the-browser.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";

const at = (path: string) => new URL(path, "file:///repo/.cw/charter/").href;
const vendoredAt = (vendor: string, path: string) => new URL(path, `file:///repo/.cw/vendor/${vendor}/`).href;

const primitive = (kind: string, id: string) =>
  ["---", `kind: ${kind}`, `id: ${id}`, `description: About ${id}.`, "---", "", `The body of ${id}.`, ""].join("\n");

/** A repository authoring one guide, and two vendors: `acme`, bringing two
 *  guides and a corpus, and `legacy`, bringing one guide. */
const withTwoVendors = () => ({
  [at("guide/no-any.md")]: primitive("guide", "no-any"),
  [vendoredAt("acme", "guide/small-diffs.md")]: primitive("guide", "small-diffs"),
  [vendoredAt("acme", "guide/one-question.md")]: primitive("guide", "one-question"),
  [vendoredAt("acme", "corpus/why.md")]: primitive("corpus", "why"),
  [vendoredAt("legacy", "guide/old.md")]: primitive("guide", "old"),
});

test("with no vendor installed, the vendor tab says so, and adding one lists the reserved directories (Story 8 scenario 1)", async () => {
  await inTheBrowser({ [at("guide/no-any.md")]: primitive("guide", "no-any") }, async (page) => {
    await page.getByRole("tab", { name: "Vendor" }).click();
    await page.getByText("No vendor source installed").waitFor();

    await page.getByRole("button", { name: "Add vendor source" }).click();
    const reserved = page.getByLabel("Reserved directories");
    await reserved.getByText("guide/").waitFor();
    for (const kind of ["sensor", "command", "skill", "playbook", "agent", "posture", "corpus", "mixin"])
      assert.equal(await reserved.getByText(`${kind}/`, { exact: true }).count(), 1, kind);
  });
});

test("each source installed shows its folder and its primitives by kind (Story 8 scenario 4)", async () => {
  await inTheBrowser(withTwoVendors(), async (page) => {
    await page.getByRole("tab", { name: "Vendor" }).click();
    const acme = page.getByLabel(".cw/vendor/acme", { exact: true });
    await acme.waitFor();

    assert.match(await acme.innerText(), /^acme\n\.cw\/vendor\/acme\/ · read-only/);
    assert.deepEqual(await acme.getByLabel("Primitives by kind").locator("dt, dd").allInnerTexts(), ["corpus", "1", "guide", "2"]);
    const legacy = page.getByLabel(".cw/vendor/legacy", { exact: true });
    assert.deepEqual(await legacy.getByLabel("Primitives by kind").locator("dt, dd").allInnerTexts(), ["guide", "1"]);
  });
});

test("a source added from the dialog is installed through the engine, and the dialog closes (Story 8 scenario 2)", async () => {
  const vcs = new InMemoryVCS();
  await inTheBrowser(
    {},
    async (page) => {
      await page.getByRole("tab", { name: "Vendor" }).click();
      await page.getByRole("button", { name: "Add vendor source" }).click();
      await page.getByLabel("source", { exact: true }).fill("git@github.com:team/charter.git");
      await page.getByLabel("version", { exact: true }).fill("v1.2.0");
      await page.getByRole("button", { name: "Add source" }).click();
      await page.getByText("Vendor source added").waitFor();

      assert.deepEqual(
        vcs.installed.map(({ source, intoSubFolder, version }) => ({ source, intoSubFolder, version })),
        [{ source: "git@github.com:team/charter.git", intoSubFolder: ".cw/vendor/charter", version: "v1.2.0" }],
      );
      await page.getByRole("dialog").waitFor({ state: "detached" });
    },
    vcs,
  );
});

test("a refused source stays in the dialog, in the engine's words (Story 8 scenarios 3, 6)", async () => {
  const vcs = new InMemoryVCS(true, false);
  await inTheBrowser(
    {},
    async (page) => {
      await page.getByRole("tab", { name: "Vendor" }).click();
      await page.getByRole("button", { name: "Add vendor source" }).click();
      await page.getByLabel("source", { exact: true }).fill("team/charter");
      await page.getByRole("button", { name: "Add source" }).click();
      await page.getByText("Refused, and nothing was installed").waitFor();

      assert.match(await page.getByRole("dialog").innerText(), /work in hand[\s\S]*stash/);
      assert.deepEqual(vcs.installed, []);
    },
    vcs,
  );
});

test("Remove takes the source away through the engine (Story 8 scenario 5)", async () => {
  const vcs = new InMemoryVCS();
  await inTheBrowser(
    withTwoVendors(),
    async (page) => {
      await page.getByRole("tab", { name: "Vendor" }).click();
      await page.getByLabel(".cw/vendor/acme", { exact: true }).getByRole("button", { name: "Remove" }).click();
      await page.getByText("Vendor source removed").waitFor();

      assert.deepEqual(vcs.removed.map(({ subFolder }) => subFolder), [".cw/vendor/acme"]);
    },
    vcs,
  );
});
