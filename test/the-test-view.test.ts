import { test } from "node:test";
import assert from "node:assert/strict";
import { inTheBrowser } from "./in-the-browser.js";

const at = (path: string) => new URL(path, "file:///repo/").href;

const guide = (id: string) =>
  ["---", "kind: guide", `id: ${id}`, `description: About ${id}.`, 'globs: ["src/**/*.ts"]', "---", "", "Body.", ""].join("\n");

const suiteText = (written: unknown) => `${JSON.stringify(written, undefined, 2)}\n`;

/** One guide; `guides.json` with a passing case, a failing one and one naming
 *  an identity the charter does not hold; and `posture.json`, all passing. */
const withTwoFiles = () => ({
  [at(".cw/settings.json")]: `${JSON.stringify({ agents: [] })}\n`,
  [at(".cw/charter/guide/no-any.md")]: guide("no-any"),
  [at(".cw/test/guides.json")]: suiteText({
    description: "The guides come up on code.",
    cases: [
      { do: { touchFile: "src/one.ts" }, expect: { activate: "guide:no-any" } },
      { do: { touchFile: "docs/a.md" }, expect: { activate: "guide:no-any" } },
      { do: { touchFile: "src/two.ts" }, expect: { activate: "guide:gone" } },
    ],
  }),
  [at(".cw/test/posture.json")]: suiteText({ cases: [{ do: { touchFile: "src/one.ts" }, expect: { allow: true } }] }),
});

test("with no test file, the test view says so and where they live", async () => {
  await inTheBrowser({}, async (page) => {
    await page.getByRole("tab", { name: "Test" }).click();

    await page.getByText("0 cases in 0 files").waitFor();
    await page.getByText("No test file yet. Test files live in .cw/test/.").waitFor();
  });
});

test("the test view lists each file with its description and case count, and its cases once opened (Story 9 scenario 1)", async () => {
  await inTheBrowser(withTwoFiles(), async (page) => {
    await page.getByRole("tab", { name: "Test" }).click();
    await page.getByText("4 cases in 2 files").waitFor();

    const guides = page.getByLabel("guides.json", { exact: true });
    assert.match(await guides.innerText(), /guides\.json\s+The guides come up on code\.\s+3 cases/);

    await guides.getByRole("button", { name: /guides\.json/ }).click();
    await guides.getByText("touching docs/a.md").waitFor();
    assert.equal(await guides.getByText("not run").count(), 3);
  });
});

test("Run all tests says how many pass, marks each case, says why one failed, and opens its file (Story 9 scenarios 2, 8)", async () => {
  await inTheBrowser(withTwoFiles(), async (page) => {
    await page.getByRole("tab", { name: "Test" }).click();
    await page.getByRole("button", { name: "Run all tests" }).click();
    await page.getByText("2 of 4 cases pass").waitFor();

    const guides = page.getByLabel("guides.json", { exact: true });
    assert.equal(await guides.getByRole("button", { name: /guides\.json/ }).getAttribute("aria-expanded"), "true");
    assert.match(await guides.innerText(), /2 failing/);
    assert.equal(await guides.getByText("pass", { exact: true }).count(), 1);
    assert.equal(await guides.getByText("fail", { exact: true }).count(), 2);
    await guides.getByText(/matches none of the globs "guide:no-any" speaks about/).waitFor();
  });
});

test("an expected identity opens its primitive, and one the charter does not hold is marked (Story 9 scenario 5)", async () => {
  await inTheBrowser(withTwoFiles(), async (page) => {
    await page.getByRole("tab", { name: "Test" }).click();
    const guides = page.getByLabel("guides.json", { exact: true });
    await guides.getByRole("button", { name: /guides\.json/ }).click();

    await guides.getByText("not in the charter").waitFor();
    assert.equal(await guides.getByRole("button", { name: "guide:gone" }).count(), 0);

    await guides.getByRole("button", { name: "guide:no-any" }).first().click();
    await page.getByRole("dialog").getByRole("heading", { name: "guide:no-any" }).waitFor();
  });
});

test("a save that reads is written and clears the outcome; one that does not is refused in the dialog (Story 9 scenarios 3, 4)", async () => {
  await inTheBrowser(withTwoFiles(), async (page, files) => {
    await page.getByRole("tab", { name: "Test" }).click();
    await page.getByRole("button", { name: "Run all tests" }).click();
    await page.getByText("2 of 4 cases pass").waitFor();

    await page.getByLabel("posture.json", { exact: true }).getByRole("button", { name: "Edit" }).click();
    const text = page.getByLabel("Test file text");
    await text.fill("{ nope");
    await page.getByRole("button", { name: "Save" }).click();
    await page.getByText("Refused, and nothing was written").waitFor();
    assert.match(await page.getByRole("dialog").innerText(), /not JSON[\s\S]*Write it as/);
    assert.match((await files.readIfThere(new URL(at(".cw/test/posture.json")))) ?? "", /"allow": true/);

    const corrected = suiteText({ cases: [{ do: { touchFile: ".env" }, expect: { allow: true } }] });
    await text.fill(corrected);
    await page.getByRole("button", { name: "Save" }).click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
    await page.getByText("4 cases in 2 files").waitFor();
    assert.equal(await files.readIfThere(new URL(at(".cw/test/posture.json"))), corrected);
  });
});

test("New test file writes one and opens its text; Delete file removes it (Story 9 scenarios 6, 7)", async () => {
  await inTheBrowser(withTwoFiles(), async (page, files) => {
    await page.getByRole("tab", { name: "Test" }).click();
    await page.getByRole("button", { name: "New test file" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("heading", { name: ".cw/test/untitled-1.json" }).waitFor();
    assert.match(await page.getByLabel("Test file text").inputValue(), /"touchFile": "src\/one\.ts"/);
    assert.ok(await files.readIfThere(new URL(at(".cw/test/untitled-1.json"))));

    await dialog.getByRole("button", { name: "Delete file" }).click();
    await page.getByText("Test file deleted").waitFor();
    assert.equal(await files.readIfThere(new URL(at(".cw/test/untitled-1.json"))), undefined);
    assert.equal(await page.getByLabel("untitled-1.json", { exact: true }).count(), 0);
  });
});
