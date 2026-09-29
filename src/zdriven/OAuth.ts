import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { auth, type OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import { OAuthError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { OAuthClientInformationMixed, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import { DrivenFault, type ForAuthorizing, type OAuthGrant } from "#hexagon/port/zdriven/ForAuthorizing.js";

/** How long a sign-in waits for the developer to come back from the browser. */
const CALLBACK_TIMEOUT_MS = 5 * 60_000;

/** What one sign-in or renewal holds while the SDK's flow runs: what the SDK
 *  saves through the provider, read back as the grant it ends with. */
interface OAuthSession {
  clientInformation?: OAuthClientInformationMixed;
  tokens?: OAuthTokens;
  codeVerifier?: string;
}

/**
 * DRIVEN ADAPTER: OAuth against one MCP server, over the SDK's own client —
 * discovery, dynamic registration, PKCE and renewal are its (plan §19.5).
 *
 * A sign-in listens on `127.0.0.1` at a port the system picks, for the one
 * request the browser comes back with, and closes. The address to open is
 * handed to the caller, never opened here (plan §15). Nothing is kept here:
 * the grant goes back to the caller, and the credential store is its business.
 */
export class OAuth implements ForAuthorizing {
  readonly #callbackTimeoutMs: number;

  constructor(callbackTimeoutMs = CALLBACK_TIMEOUT_MS) {
    this.#callbackTimeoutMs = callbackTimeoutMs;
  }

  async authorize(endpoint: string, showAuthorizationUrl: (authorizationUrl: string) => void): Promise<OAuthGrant> {
    const state = randomUUID();
    const callbackServer = createServer();
    await new Promise<void>((resolve, reject) => callbackServer.once("error", reject).listen(0, "127.0.0.1", resolve));
    const redirectUrl = `http://127.0.0.1:${(callbackServer.address() as AddressInfo).port}/callback`;

    let callbackTimeout: NodeJS.Timeout | undefined;
    const authorizationCode = new Promise<string>((resolve, reject) => {
      callbackTimeout = setTimeout(
        () => reject(new DrivenFault(`Nobody came back from signing in to ${endpoint} in time.`, 'Run "cw mcp auth" again, and open the address it prints.')),
        this.#callbackTimeoutMs,
      );
      callbackServer.on("request", (request, response) => {
        const callbackUrl = new URL(request.url ?? "/", redirectUrl);
        if (callbackUrl.pathname !== "/callback") return void response.writeHead(404).end();

        const callbackCode = callbackUrl.searchParams.get("code");
        const signedIn = callbackCode !== null && callbackUrl.searchParams.get("state") === state;
        response
          .writeHead(200, { "content-type": "text/plain; charset=utf-8" })
          .end(signedIn ? "Signed in. Go back to the terminal.\n" : "Not signed in. Go back to the terminal.\n");
        if (signedIn) return resolve(callbackCode);
        const callbackError = callbackUrl.searchParams.get("error");
        reject(new DrivenFault(`Signing in to ${endpoint} came back without an authorization${callbackError ? `: ${callbackError}` : ""}.`, 'Run "cw mcp auth" again.'));
      });
    });
    // Awaited only once the address is shown: a sign-in failing before then
    // still leaves this settled, and it is not left unhandled.
    authorizationCode.catch(() => undefined);

    try {
      const oauthSession: OAuthSession = {};
      const provider = this.#providerOver(oauthSession, redirectUrl, (authorizationUrl) => showAuthorizationUrl(authorizationUrl.href), state);
      if ((await auth(provider, { serverUrl: endpoint })) === "REDIRECT")
        await auth(provider, { serverUrl: endpoint, authorizationCode: await authorizationCode });
      return oauthGrantOf(endpoint, oauthSession);
    } catch (raised) {
      if (raised instanceof DrivenFault) throw raised;
      throw new DrivenFault(
        `Signing in to ${endpoint} failed: ${raised instanceof Error ? raised.message : String(raised)}`,
        "Check the address is reachable and offers an OAuth sign-in, then run \"cw mcp auth\" again.",
      );
    } finally {
      clearTimeout(callbackTimeout);
      callbackServer.closeAllConnections();
      callbackServer.close();
    }
  }

  async renew(endpoint: string, oauthGrant: OAuthGrant): Promise<OAuthGrant | undefined> {
    const { clientId, clientSecret, issuer } = oauthGrant.client;
    const oauthSession: OAuthSession = {
      clientInformation: { client_id: clientId, ...(clientSecret !== undefined && { client_secret: clientSecret }), issuer },
      tokens: {
        access_token: oauthGrant.accessToken,
        token_type: "Bearer",
        ...(oauthGrant.refreshToken !== undefined && { refresh_token: oauthGrant.refreshToken }),
        issuer,
      },
    };
    // No redirect is followed and no registration made: the SDK falls back to
    // a new sign-in only where the refresh was refused, which is the answer.
    const provider = this.#providerOver(oauthSession, "http://127.0.0.1/callback", () => undefined);
    try {
      if ((await auth(provider, { serverUrl: endpoint })) === "REDIRECT") return undefined;
    } catch (raised) {
      if (raised instanceof OAuthError) return undefined;
      throw new DrivenFault(
        `Renewing the sign-in to ${endpoint} failed: ${raised instanceof Error ? raised.message : String(raised)}`,
        "Check the address is reachable, then try again.",
      );
    }
    const renewedGrant = oauthGrantOf(endpoint, oauthSession);
    // A server that does not rotate its refresh token keeps the one it had.
    return renewedGrant.refreshToken !== undefined || oauthGrant.refreshToken === undefined
      ? renewedGrant
      : { ...renewedGrant, refreshToken: oauthGrant.refreshToken };
  }

  /**
   * What the SDK's flow is run with: `cw` described as a public client that
   * signs in at `redirectUrl`, and everything the flow saves kept in this
   * session. Registering is offered to a sign-in only, where a `state` is
   * checked on the way back; a renewal presents what the grant was issued to.
   */
  #providerOver(
    oauthSession: OAuthSession,
    redirectUrl: string,
    redirectToAuthorization: (authorizationUrl: URL) => void,
    state?: string,
  ): OAuthClientProvider {
    return {
      redirectUrl,
      clientMetadata: {
        client_name: "cherry-works",
        redirect_uris: [redirectUrl],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      },
      ...(state !== undefined && {
        state: () => state,
        saveClientInformation: (clientInformation: OAuthClientInformationMixed) => {
          oauthSession.clientInformation = clientInformation;
        },
      }),
      clientInformation: () => oauthSession.clientInformation,
      tokens: () => oauthSession.tokens,
      saveTokens: (tokens) => {
        oauthSession.tokens = tokens;
      },
      redirectToAuthorization,
      saveCodeVerifier: (codeVerifier) => {
        oauthSession.codeVerifier = codeVerifier;
      },
      codeVerifier: () => oauthSession.codeVerifier ?? "",
    };
  }
}

/** What a finished flow saved, as the grant it ends with. */
function oauthGrantOf(endpoint: string, { clientInformation, tokens }: OAuthSession): OAuthGrant {
  if (clientInformation === undefined || tokens === undefined)
    throw new DrivenFault(`Signing in to ${endpoint} ended without a token.`, 'Run "cw mcp auth" again.');
  return {
    accessToken: tokens.access_token,
    ...(tokens.refresh_token !== undefined && { refreshToken: tokens.refresh_token }),
    ...(tokens.expires_in !== undefined && { expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString() }),
    client: {
      clientId: clientInformation.client_id,
      ...(clientInformation.client_secret !== undefined && { clientSecret: clientInformation.client_secret }),
      issuer: clientInformation.issuer ?? tokens.issuer ?? endpoint,
    },
  };
}
