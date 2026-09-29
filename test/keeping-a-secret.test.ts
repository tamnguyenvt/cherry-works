import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { OsSecrets } from "../src/zdriven/OsSecrets.js";
import { InMemorySecrets } from "../src/zdriven/InMemorySecrets.js";
import { DrivenFault } from "../src/hexagon/port/zdriven/DrivenFault.js";
import type { ForKeepingSecrets } from "../src/hexagon/port/zdriven/ForKeepingSecrets.js";

/** Whether this machine has the store `OsSecrets` would reach: `security` on
 *  macOS, `secret-tool` on Linux. Where it has not, the real store is not
 *  tested here. */
const storeCommand = process.platform === "darwin" ? "security" : process.platform === "linux" ? "secret-tool" : undefined;
const storeInstalled = (() => {
  if (storeCommand === undefined) return false;
  try {
    execFileSync("which", [storeCommand], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

/** What every adapter of the port promises, asked of one under a key no one
 *  else uses, and taken away afterwards whatever happens. */
async function keepsASecret(t: { after(fn: () => unknown): void }, secrets: ForKeepingSecrets): Promise<void> {
  const key = `https://cw-test-${randomUUID()}.example/mcp`;
  t.after(() => secrets.removeSecret(key));
  const secret = JSON.stringify({ address: key, method: "token", accessToken: "a token with spaces and \"quotes\"" });

  assert.equal(await secrets.readSecret(key), undefined);
  await secrets.writeSecret(key, secret);
  assert.equal(await secrets.readSecret(key), secret);
  await secrets.writeSecret(key, "replaced");
  assert.equal(await secrets.readSecret(key), "replaced");
  await secrets.removeSecret(key);
  assert.equal(await secrets.readSecret(key), undefined);
  await secrets.removeSecret(key);
}

test("a secret written is read back, replaced and removed, in memory", async (t) => {
  await keepsASecret(t, new InMemorySecrets());
});

test(
  "a secret written is read back, replaced and removed, in the operating system's store",
  { skip: !storeInstalled && `no ${storeCommand ?? "credential store"} on this machine` },
  async (t) => {
    await keepsASecret(t, new OsSecrets());
  },
);

test("a platform with no store it knows is refused, naming the two it supports", async () => {
  const secrets = new OsSecrets("win32");
  for (const call of [
    () => secrets.readSecret("https://a.example/mcp"),
    () => secrets.writeSecret("https://a.example/mcp", "s3cret"),
    () => secrets.removeSecret("https://a.example/mcp"),
  ]) {
    await assert.rejects(call, (raised: unknown) => {
      assert.ok(raised instanceof DrivenFault);
      assert.match(`${raised.message} ${raised.fix}`, /macOS/);
      assert.match(`${raised.message} ${raised.fix}`, /Linux/);
      assert.doesNotMatch(raised.message, /s3cret/);
      return true;
    });
  }
});
