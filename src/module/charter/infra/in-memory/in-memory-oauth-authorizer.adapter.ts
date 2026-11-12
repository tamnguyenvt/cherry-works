import type { ForAuthorizingOAuthClients, OAuthGrant } from "../../app/port/out/authorizing-oauth-clients.port.js";

/** OAuth answered from memory: a test sets the grant a sign-in ends with and
 *  what a renewal answers, and reads what was asked of it. The second
 *  implementation that earns `ForAuthorizingOAuthClients` its place (plan §2.4). */
export class InMemoryOAuthAuthorizer implements ForAuthorizingOAuthClients {
  /** What the next sign-in ends with. */
  oauthGrant: OAuthGrant = { accessToken: "signed-in", client: { clientId: "cw", issuer: "http://127.0.0.1/" } };
  /** What a renewal answers; `undefined` is the server refusing it. */
  renewedGrant: OAuthGrant | undefined;
  readonly authorizedEndpoints: string[] = [];
  readonly renewedEndpoints: string[] = [];

  async authorizeInBrowser(
    endpoint: string,
    showAuthorizationUrl: (authorizationUrl: string) => void,
  ): Promise<OAuthGrant> {
    this.authorizedEndpoints.push(endpoint);
    showAuthorizationUrl(`${endpoint}/authorize`);
    return this.oauthGrant;
  }

  async renewGrant(endpoint: string): Promise<OAuthGrant | undefined> {
    this.renewedEndpoints.push(endpoint);
    return this.renewedGrant;
  }
}
