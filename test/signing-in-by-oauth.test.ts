import assert from "node:assert/strict";
import { test } from "node:test";
import type { ForAuthorizingOAuthClients } from "../src/module/charter/app/port/out/authorizing-oauth-clients.port.js";
import type { ForStoringCredentials } from "../src/module/charter/app/port/out/storing-credentials.port.js";
import { McpOrigin } from "../src/module/charter/domain/models/charter-output/mcp-origin.js";
import { McpAuthMethod } from "../src/module/charter/domain/models/mcp/mcp-auth-method.value-object.js";
import { InMemoryCredentialsRepository } from "../src/module/charter/infra/in-memory/in-memory-credentials.repository.js";
import { InMemoryOAuthAuthorizer } from "../src/module/charter/infra/in-memory/in-memory-oauth-authorizer.adapter.js";
import { OAuth } from "../src/module/charter/infra/oauth.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { anOAuthServer } from "./an-oauth-server.js";
import { charterFilesOf } from "./charter-of-mcp-origins.js";
import { authoringCharterOf } from "./use-cases-of.js";

/** One mcp origin at the test server's endpoint, signed in to by OAuth. */
const mcpOriginAt = (endpoint: string): McpOrigin =>
  new McpOrigin({
    ids: ["billing"],
    names: { billing: "billing_0000" },
    address: endpoint,
    endpoint,
    auth: [McpAuthMethod.OAUTH],
  });

/** The developer opening the address they were shown: the test server agrees
 *  at once and sends the browser back to the callback. */
const openInBrowser = (authorizationUrl: string) => void fetch(authorizationUrl);

/** A kept credential made to have expired a minute ago. */
const expire = async (credentialsRepository: InMemoryCredentialsRepository, address: string) => {
  const credential = JSON.parse(credentialsRepository.secretByAddress.get(address) ?? "");
  await credentialsRepository.secretByAddress.set(
    address,
    JSON.stringify({ ...credential, expiresAt: new Date(Date.now() - 60_000).toISOString() }),
  );
};

/** The developer's access token to this mcp origin, as charter runtime asks
 *  charter authoring for it: the token, or its fault raised. */
async function accessTokenOf(
  credentialsRepository: ForStoringCredentials,
  oauthAuthorizer: ForAuthorizingOAuthClients,
  origin: McpOrigin,
): Promise<string> {
  const emptyFileReaders = new InMemoryFileReaders({});
  const accessTokenAnswer = await authoringCharterOf(
    emptyFileReaders,
    new InMemoryFileOutput(emptyFileReaders),
    new InMemoryReporter(),
    { credentialsRepository, oauthAuthorizer },
  ).getAccessToken(
    {
      address: origin.address,
      ...(origin.endpoint === undefined ? {} : { endpoint: origin.endpoint }),
      mcpId: origin.ids[0] ?? "",
    },
    false,
  );
  if (accessTokenAnswer.type === "Fault")
    throw Object.assign(new Error(accessTokenAnswer.data.message), { fix: accessTokenAnswer.data.fix });
  return accessTokenAnswer.data.accessToken;
}

test("an OAuth sign-in against an mcp origin ends with a credential in the store holding a refresh token (FR-148)", async (t) => {
  const oauthTestServer = await anOAuthServer();
  t.after(() => oauthTestServer.server.close());
  const credentialsRepository = new InMemoryCredentialsRepository();
  const origin = mcpOriginAt(oauthTestServer.endpoint);
  const held = new InMemoryFileReaders({
    ...charterFilesOf([origin]),
    "file:///repo/.cw/out/mcp-origins.json": JSON.stringify({ origins: [origin] }),
  });
  const shown: string[] = [];

  await authoringCharterOf(held, new InMemoryFileOutput(held), new InMemoryReporter(), {
    credentialsRepository,
    oauthAuthorizer: new OAuth(),
  }).signInWithOAuth(origin.address, (authorizationUrl) => {
    shown.push(authorizationUrl);
    openInBrowser(authorizationUrl);
  });

  const credential = JSON.parse(credentialsRepository.secretByAddress.get(origin.address) ?? "");
  assert.equal(shown.length, 1);
  assert.match(shown[0] ?? "", /code_challenge=/);
  assert.equal(credential.method, "oauth");
  assert.equal(credential.accessToken, "access-1");
  assert.equal(credential.refreshToken, "refresh-1");
  assert.equal(credential.client.clientId, "client-1");
  assert.ok(Date.parse(credential.expiresAt) > Date.now());
});

test("an expired credential is renewed on use, asking nothing, and the renewal kept; one the mcp origin refuses says to sign in again (FR-151)", async (t) => {
  const oauthTestServer = await anOAuthServer();
  t.after(() => oauthTestServer.server.close());
  const credentialsRepository = new InMemoryCredentialsRepository();
  const oauth = new OAuth();
  const origin = mcpOriginAt(oauthTestServer.endpoint);
  const held = new InMemoryFileReaders({
    ...charterFilesOf([origin]),
    "file:///repo/.cw/out/mcp-origins.json": JSON.stringify({ origins: [origin] }),
  });
  await authoringCharterOf(held, new InMemoryFileOutput(held), new InMemoryReporter(), {
    credentialsRepository,
    oauthAuthorizer: oauth,
  }).signInWithOAuth(origin.address, openInBrowser);

  assert.equal(await accessTokenOf(credentialsRepository, oauth, origin), "access-1");
  assert.equal(oauthTestServer.issued.refresh_token, 0);

  await expire(credentialsRepository, origin.address);
  assert.equal(await accessTokenOf(credentialsRepository, oauth, origin), "access-renewed-1");
  const renewedCredential = JSON.parse(credentialsRepository.secretByAddress.get(origin.address) ?? "");
  assert.equal(renewedCredential.refreshToken, "refresh-1");
  assert.ok(Date.parse(renewedCredential.expiresAt) > Date.now());
  assert.equal(oauthTestServer.issued.authorization_code, 1);

  oauthTestServer.refusesRenewal = true;
  await expire(credentialsRepository, origin.address);
  await assert.rejects(accessTokenOf(credentialsRepository, oauth, origin), (raised: Error & { fix?: string }) => {
    assert.match(raised.message, /expired/);
    assert.match(raised.fix ?? "", /cw mcp auth billing/);
    return true;
  });
});

test("an mcp origin nobody signed in to is refused naming the command that signs in there (FR-151)", async () => {
  const origin = mcpOriginAt("https://nowhere.example/mcp");
  await assert.rejects(accessTokenOf(new InMemoryCredentialsRepository(), new InMemoryOAuthAuthorizer(), origin), {
    fix: /cw mcp auth billing/,
  });
});

test("a token credential never expires as far as cw knows, and is used as kept", async () => {
  const credentialsRepository = new InMemoryCredentialsRepository();
  const origin = new McpOrigin({
    ids: ["linear"],
    names: { linear: "linear_0000" },
    address: "https://mcp.linear.app/mcp",
    endpoint: "https://mcp.linear.app/mcp",
    auth: [McpAuthMethod.TOKEN],
  });
  await credentialsRepository.secretByAddress.set(
    origin.address,
    JSON.stringify({ address: origin.address, method: "token", accessToken: "lin" }),
  );
  assert.equal(await accessTokenOf(credentialsRepository, new InMemoryOAuthAuthorizer(), origin), "lin");
});

test("a sign-in the developer refuses in the browser keeps nothing, and says so", async (t) => {
  const oauthTestServer = await anOAuthServer();
  t.after(() => oauthTestServer.server.close());

  const refusing = (authorizationUrl: string) => {
    const callbackUrl = new URL(new URL(authorizationUrl).searchParams.get("redirect_uri") ?? "");
    callbackUrl.searchParams.set("error", "access_denied");
    void fetch(callbackUrl);
  };

  await assert.rejects(new OAuth().authorizeInBrowser(oauthTestServer.endpoint, refusing), /access_denied/);
  assert.equal(oauthTestServer.issued.authorization_code, 0);
});

test("a credential kept for an mcp origin now at plain http on another machine is not handed out (FR-149)", async () => {
  const credentialsRepository = new InMemoryCredentialsRepository();
  const origin = new McpOrigin({
    ids: ["cleartext"],
    names: { cleartext: "cleartext_0000" },
    address: "http://mcp.example/mcp",
    endpoint: "http://mcp.example/mcp",
    auth: [McpAuthMethod.TOKEN],
  });
  await credentialsRepository.secretByAddress.set(
    origin.address,
    JSON.stringify({ address: origin.address, method: "token", accessToken: "t" }),
  );
  await assert.rejects(accessTokenOf(credentialsRepository, new InMemoryOAuthAuthorizer(), origin), /plain http/);
});
