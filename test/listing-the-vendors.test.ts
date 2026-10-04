import { test } from "node:test";
import assert from "node:assert/strict";
import { Commander } from "../src/driver/cli/Commander.js";
import { COMMANDS } from "../src/driver/cli/commands/index.js";
import { EXIT_OK } from "../src/driver/cli/commands/Command.js";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { CharterVendoring } from "../src/hexagon/application/CharterVendoring.js";
import { TestAuthoring } from "../src/hexagon/application/TestAuthoring.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";
import { noPlacesReached } from "./no-places.js";
import { InMemoryTokenCounter } from "../src/zdriven/InMemoryTokenCounter.js";
import { InMemoryAgentCli } from "../src/zdriven/InMemoryAgentCli.js";

const repoPath = new URL("file:///repo/");
const vendoredAt = (vendor: string, path: string) => new URL(`.cw/vendor/${vendor}/${path}`, repoPath).href;

const guide = (id: string) => ["---", "kind: guide", `id: ${id}`, `description: About ${id}.`, "---", "", "Body.", ""].join("\n");

/** Two vendors on disk, `legacy` read before `acme`, and one guide authored
 *  here. */
const twoVendors = () =>
  new InMemoryFileReaders({
    [vendoredAt("legacy", "guide/old/index.md")]: guide("old"),
    [vendoredAt("acme", "guide/small-diffs/index.md")]: guide("small-diffs"),
    [new URL(".cw/charter/guide/no-any/index.md", repoPath).href]: guide("no-any"),
  });

/** What `cw vendor list` printed, over one repository held in memory. */
async function listing(held: InMemoryFileReaders) {
  const said: string[] = [];
  const kept = process.stdout.write;
  process.stdout.write = ((text: string) => {
    said.push(String(text));
    return true;
  }) as typeof process.stdout.write;
  try {
    const vcs = new InMemoryVCS();
    const charterAuthoringApp = new CharterAuthoring(repoPath, held, new YamlParser(), new InMemoryFileOutput(held), vcs, new InMemoryTokenCounter(), { claude: new InMemoryAgentCli() });
    const charterVendoringApp = new CharterVendoring(repoPath, held, vcs);
    const testAuthoringApp = new TestAuthoring(repoPath, held, new InMemoryFileOutput(held));
    const code = await new Commander({ cwd: "/repo", version: "0.0.0", charterAuthoringApp, charterVendoringApp, testAuthoringApp, mcpConnectingApp: noPlacesReached }, COMMANDS).run(["vendor", "list"]);
    return { code, said: said.join("") };
  } finally {
    process.stdout.write = kept;
  }
}

test("every folder under the vendor folder is listed, sorted, and nothing authored here (FR-053)", async () => {
  assert.deepEqual(await new CharterVendoring(repoPath, twoVendors(), new InMemoryVCS()).installed(), [".cw/vendor/acme", ".cw/vendor/legacy"]);
});

test("a repository with no vendor lists none", async () => {
  assert.deepEqual(await new CharterVendoring(repoPath, new InMemoryFileReaders({}), new InMemoryVCS()).installed(), []);
});

test("cw vendor list prints each folder on a line of its own", async () => {
  const { code, said } = await listing(twoVendors());

  assert.equal(code, EXIT_OK);
  assert.equal(said, ".cw/vendor/acme\n.cw/vendor/legacy\n");
});

test("cw vendor list says when none is installed, and how to install one", async () => {
  const { code, said } = await listing(new InMemoryFileReaders({}));

  assert.equal(code, EXIT_OK);
  assert.match(said, /No vendor source is installed/);
  assert.match(said, /cw vendor add/);
});
