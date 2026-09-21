import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

/** What the dependency rules say of one page file holding `text`: put where the
 *  rules look, since what they guard is a path in the repository, and taken
 *  away whatever the run says. */
async function cruisePage(name: string, text: string): Promise<{ status: number | null; stdout: string }> {
  const probe = `src/driver/portal/page/${name}-${process.pid}.ts`;
  await writeFile(new URL(probe, root), text);
  try {
    return spawnSync("pnpm", ["exec", "depcruise", probe], { cwd: root, encoding: "utf8" });
  } finally {
    await rm(new URL(probe, root));
  }
}

test("a page file that imports node:fs fails the dependency rules", async () => {
  const run = await cruisePage("probe-fs", 'import { readFileSync } from "node:fs";\nexport const read = readFileSync;\n');

  assert.notEqual(run.status, 0);
  assert.match(run.stdout, /page-is-browser-code/);
});

test("a page file may call the routes through hc, knowing them by their types", async () => {
  const run = await cruisePage(
    "probe-hc",
    'import { hc } from "hono/client";\nimport type api from "../routes.js";\nexport const client = hc<typeof api>("/api");\n',
  );

  assert.equal(run.status, 0, run.stdout);
});

test("a page file that imports what runs in the routes fails the dependency rules", async () => {
  const run = await cruisePage("probe-routes", 'import api from "../routes.js";\nexport const routes = api;\n');

  assert.notEqual(run.status, 0);
  assert.match(run.stdout, /page-knows-routes-only-as-types/);
});
