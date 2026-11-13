import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rm, symlink, writeFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);

/** What the dependency rules say of one page file holding `text`: put where the
 *  rules look, since what they guard is a path in the repository, and taken
 *  away whatever the run says. */
async function cruisePage(name: string, text: string): Promise<{ status: number | null; stdout: string }> {
  const probe = `src/presentation/portal/page/${name}-${process.pid}.probe.ts`;
  await writeFile(new URL(probe, root), text);
  try {
    return spawnSync("pnpm", ["exec", "depcruise", probe], { cwd: root, encoding: "utf8" });
  } finally {
    await rm(new URL(probe, root));
  }
}

test("a page file that imports node:fs fails the dependency rules", async () => {
  const run = await cruisePage(
    "probe-fs",
    'import { readFileSync } from "node:fs";\nexport const read = readFileSync;\n',
  );

  assert.notEqual(run.status, 0);
  assert.match(run.stdout, /page-is-browser-code/);
});

test("a page file may call the routes through hc, knowing them by their types", async () => {
  const run = await cruisePage(
    "probe-hc",
    'import { hc } from "hono/client";\nimport type api from "../portal.routes.js";\nexport const client = hc<typeof api>("/api");\n',
  );

  assert.equal(run.status, 0, run.stdout);
});

test("a page file that imports what runs in the routes fails the dependency rules", async () => {
  const run = await cruisePage("probe-routes", 'import api from "../portal.routes.js";\nexport const routes = api;\n');

  assert.notEqual(run.status, 0);
  assert.match(run.stdout, /page-knows-routes-only-as-types/);
});

test("a probe file taken away while the naming guides read src fails none of them", async () => {
  // A probe listed but already gone, as a run beside cruisePage meets it.
  const probe = `src/presentation/portal/page/probe-gone-${process.pid}.probe.ts`;
  await symlink(new URL(`${probe}.gone`, root), new URL(probe, root));
  // Run as a test run of its own, not as a subtest reporting to this one.
  const { NODE_TEST_CONTEXT: _testContext, ...ownEnv } = process.env;
  try {
    const run = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--import",
        "./scripts/module-loader.mjs",
        "--test",
        "test/keeping-the-engine-to-its-naming-and-fault-guides.test.ts",
      ],
      { cwd: root, encoding: "utf8", env: ownEnv, timeout: 120_000 },
    );

    assert.equal(run.status, 0, `${run.stdout}${run.stderr}${run.error ?? ""}`);
  } finally {
    await rm(new URL(probe, root));
  }
});
