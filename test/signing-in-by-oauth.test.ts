import { test } from "node:test";
import assert from "node:assert/strict";
import { McpConnecting } from "../src/hexagon/application/McpConnecting.js";
import type { McpOrigin } from "../src/hexagon/domain/models/output/common/McpOrigin.js";
import { credentialFor } from "../src/hexagon/service/credentialRepo.js";
import { InMemoryAuthorizing } from "../src/zdriven/InMemoryAuthorizing.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryMcpServers } from "../src/zdriven/InMemoryMcpServers.js";
import { InMemorySecrets } from "../src/zdriven/InMemorySecrets.js";
import { OAuth } from "../src/zdriven/OAuth.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";
import { anOAuthServer } from "./an-oauth-server.js";

/** One place at the test server's endpoint, signed in to by OAuth. */
const placeAt = (endpoint: string): McpOrigin => ({ ids: ["billing"], names: { "billing": "billing_0000" }, address: endpoint, endpoint, auth: ["oauth"] });

/** The developer opening the address they were shown: the test server agrees
 *  at once and sends the browser back to the callback. */
const openInBrowser = (authorizationUrl: string) => void fetch(authorizationUrl);

/** A kept credential made to have expired a minute ago. */
const expire = async (secrets: InMemorySecrets, address: string) => {
  const credential = JSON.parse(secrets.secrets.get(address) ?? "");
  await secrets.writeSecret(address, JSON.stringify({ ...credential, expiresAt: new Date(Date.now() - 60_000).toISOString() }));
};

test("an OAuth sign-in against a place ends with a credential in the store holding a refresh token (FR-148)", async (t) => {
  const oauthTestServer = await anOAuthServer();
  t.after(() => oauthTestServer.server.close());
  const secrets = new InMemorySecrets();
  const origin = placeAt(oauthTestServer.endpoint);
  const held = new InMemoryFileReaders({ "file:///repo/.cw/out/mcp-origins.json": JSON.stringify({ origins: [origin] }) });
  const shown: string[] = [];

  await new McpConnecting(new URL("file:///repo/"), held, secrets, new OAuth(), new YamlParser(), new InMemoryMcpServers()).signInWithOAuth(origin.address, (authorizationUrl) => {
    shown.push(authorizationUrl);
    openInBrowser(authorizationUrl);
  });

  const credential = JSON.parse(secrets.secrets.get(origin.address) ?? "");
  assert.equal(shown.length, 1);
  assert.match(shown[0] ?? "", /code_challenge=/);
  assert.equal(credential.method, "oauth");
  assert.equal(credential.accessToken, "access-1");
  assert.equal(credential.refreshToken, "refresh-1");
  assert.equal(credential.client.clientId, "client-1");
  assert.ok(Date.parse(credential.expiresAt) > Date.now());
});

test("an expired credential is renewed on use, asking nothing, and the renewal kept; one the place refuses says to sign in again (FR-151)", async (t) => {
  const oauthTestServer = await anOAuthServer();
  t.after(() => oauthTestServer.server.close());
  const secrets = new InMemorySecrets();
  const oauth = new OAuth();
  const origin = placeAt(oauthTestServer.endpoint);
  const held = new InMemoryFileReaders({ "file:///repo/.cw/out/mcp-origins.json": JSON.stringify({ origins: [origin] }) });
  await new McpConnecting(new URL("file:///repo/"), held, secrets, oauth, new YamlParser(), new InMemoryMcpServers()).signInWithOAuth(origin.address, openInBrowser);

  assert.equal(await credentialFor(secrets, oauth, origin), "access-1");
  assert.equal(oauthTestServer.issued.refresh_token, 0);

  await expire(secrets, origin.address);
  assert.equal(await credentialFor(secrets, oauth, origin), "access-renewed-1");
  const renewedCredential = JSON.parse(secrets.secrets.get(origin.address) ?? "");
  assert.equal(renewedCredential.refreshToken, "refresh-1");
  assert.ok(Date.parse(renewedCredential.expiresAt) > Date.now());
  assert.equal(oauthTestServer.issued.authorization_code, 1);

  oauthTestServer.refusesRenewal = true;
  await expire(secrets, origin.address);
  await assert.rejects(credentialFor(secrets, oauth, origin), (raised: Error & { fix?: string }) => {
    assert.match(raised.message, /expired/);
    assert.match(raised.fix ?? "", /cw mcp auth billing/);
    return true;
  });
});

test("a place nobody signed in to is refused naming the command that signs in there (FR-151)", async () => {
  const origin = placeAt("https://nowhere.example/mcp");
  await assert.rejects(credentialFor(new InMemorySecrets(), new InMemoryAuthorizing(), origin), { fix: /cw mcp auth billing/ });
});

test("a token credential never expires as far as cw knows, and is used as kept", async () => {
  const secrets = new InMemorySecrets();
  const origin: McpOrigin = { ids: ["linear"], names: { "linear": "linear_0000" }, address: "https://mcp.linear.app/mcp", endpoint: "https://mcp.linear.app/mcp", auth: ["token"] };
  await secrets.writeSecret(origin.address, JSON.stringify({ address: origin.address, method: "token", accessToken: "lin" }));
  assert.equal(await credentialFor(secrets, new InMemoryAuthorizing(), origin), "lin");
});

test("a sign-in the developer refuses in the browser keeps nothing, and says so", async (t) => {
  const oauthTestServer = await anOAuthServer();
  t.after(() => oauthTestServer.server.close());

  const refusing = (authorizationUrl: string) => {
    const callbackUrl = new URL(new URL(authorizationUrl).searchParams.get("redirect_uri") ?? "");
    callbackUrl.searchParams.set("error", "access_denied");
    void fetch(callbackUrl);
  };

  await assert.rejects(new OAuth().authorize(oauthTestServer.endpoint, refusing), /access_denied/);
  assert.equal(oauthTestServer.issued.authorization_code, 0);
});

test("a credential kept for a place now at plain http on another machine is not handed out (FR-149)", async () => {
  const secrets = new InMemorySecrets();
  const origin: McpOrigin = { ids: ["cleartext"], names: { "cleartext": "cleartext_0000" }, address: "http://mcp.example/mcp", endpoint: "http://mcp.example/mcp", auth: ["token"] };
  await secrets.writeSecret(origin.address, JSON.stringify({ address: origin.address, method: "token", accessToken: "t" }));
  await assert.rejects(credentialFor(secrets, new InMemoryAuthorizing(), origin), /plain http/);
});
