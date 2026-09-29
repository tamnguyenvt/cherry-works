import type { ForAuthorizing, OAuthGrant } from "#hexagon/port/zdriven/ForAuthorizing.js";

/** OAuth answered from memory: a test sets the grant a sign-in ends with and
 *  what a renewal answers, and reads what was asked of it. The second
 *  implementation that earns `ForAuthorizing` its place (plan §2.4). */
export class InMemoryAuthorizing implements ForAuthorizing {
  /** What the next sign-in ends with. */
  oauthGrant: OAuthGrant = { accessToken: "signed-in", client: { clientId: "cw", issuer: "http://127.0.0.1/" } };
  /** What a renewal answers; `undefined` is the server refusing it. */
  renewedGrant: OAuthGrant | undefined;
  readonly authorized: string[] = [];
  readonly renewed: string[] = [];

  async authorize(endpoint: string, showAuthorizationUrl: (authorizationUrl: string) => void): Promise<OAuthGrant> {
    this.authorized.push(endpoint);
    showAuthorizationUrl(`${endpoint}/authorize`);
    return this.oauthGrant;
  }

  async renew(endpoint: string): Promise<OAuthGrant | undefined> {
    this.renewed.push(endpoint);
    return this.renewedGrant;
  }
}
