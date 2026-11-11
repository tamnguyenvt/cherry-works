import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import {
  type ForStoringCredentials,
  McpCredential,
} from "../src/module/charter/app/port/out/storing-credentials.port.js";
import { InMemoryCredentialsRepository } from "../src/module/charter/infra/in-memory/in-memory-credentials.repository.js";
import { KeychainCredentialsRepository } from "../src/module/charter/infra/keychain-credentials.repository.js";
import { AdapterFault } from "../src/module/shared/domain/models/adapter.fault.js";

/** Whether this machine has the store `KeychainCredentialsRepository` would
 *  reach: `security` on macOS, `secret-tool` on Linux. Where it has not, the
 *  real store is not tested here. */
const storeCommand =
  process.platform === "darwin" ? "security" : process.platform === "linux" ? "secret-tool" : undefined;
const storeInstalled = (() => {
  if (storeCommand === undefined) return false;
  try {
    execFileSync("which", [storeCommand], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

/** What every adapter of the port promises, asked of one under an address no
 *  one else uses; `forget` takes it away afterwards whatever happens. */
async function keepsACredential(
  t: { after(fn: () => unknown): void },
  credentialsRepository: ForStoringCredentials,
  forget: (address: string) => void,
): Promise<void> {
  const address = `https://cw-test-${randomUUID()}.example/mcp`;
  t.after(() => forget(address));

  assert.equal(await credentialsRepository.readCredential(address), undefined);
  await credentialsRepository.writeCredential(
    new McpCredential({ address, method: "token", accessToken: 'a token with spaces and "quotes"' }),
  );
  assert.equal((await credentialsRepository.readCredential(address))?.accessToken, 'a token with spaces and "quotes"');
  await credentialsRepository.writeCredential(new McpCredential({ address, method: "token", accessToken: "replaced" }));
  assert.equal((await credentialsRepository.readCredential(address))?.accessToken, "replaced");
}

test("a credential written is read back and replaced, in memory", async (t) => {
  const credentialsRepository = new InMemoryCredentialsRepository();
  await keepsACredential(t, credentialsRepository, (address) => credentialsRepository.secrets.delete(address));
});

test("a secret that does not read as a credential is none: signing in again replaces it", async () => {
  const credentialsRepository = new InMemoryCredentialsRepository();
  credentialsRepository.secrets.set("https://a.example/mcp", "not json");

  assert.equal(await credentialsRepository.readCredential("https://a.example/mcp"), undefined);
});

test("a credential written is read back and replaced, in the operating system's store", {
  skip: !storeInstalled && `no ${storeCommand ?? "credential store"} on this machine`,
}, async (t) => {
  await keepsACredential(t, new KeychainCredentialsRepository(), (address) => {
    try {
      if (process.platform === "darwin")
        execFileSync("security", ["delete-generic-password", "-s", "cherry-works", "-a", address], { stdio: "ignore" });
      else execFileSync("secret-tool", ["clear", "service", "cherry-works", "account", address], { stdio: "ignore" });
    } catch {}
  });
});

test("a platform with no store it knows is refused, naming the two it supports", async () => {
  const credentialsRepository = new KeychainCredentialsRepository("win32");
  for (const call of [
    () => credentialsRepository.readCredential("https://a.example/mcp"),
    () =>
      credentialsRepository.writeCredential(
        new McpCredential({ address: "https://a.example/mcp", method: "token", accessToken: "s3cret" }),
      ),
  ]) {
    await assert.rejects(call, (raised: unknown) => {
      assert.ok(raised instanceof AdapterFault);
      assert.match(`${raised.message} ${raised.fix}`, /macOS/);
      assert.match(`${raised.message} ${raised.fix}`, /Linux/);
      assert.doesNotMatch(raised.message, /s3cret/);
      return true;
    });
  }
});
