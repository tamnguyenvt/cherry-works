/** What an adapter answering this port raises when the server behind it
 *  cannot be reached, named again here so it names this port and nothing
 *  behind it. */
export { DrivenFault } from "./DrivenFault.js";

/**
 * What one OAuth sign-in ends with: the tokens a place issued, and what it
 * registered `cw` as, so a renewal needs no second registration (plan §19.5).
 *
 * Not a domain type, and no DTO carries one (SC-036): it goes from this port
 * into the credential store and back, and nowhere else.
 */
export interface OAuthGrant {
  readonly accessToken: string;
  readonly refreshToken?: string;
  /** ISO 8601. Absent where the place said nothing of when it expires. */
  readonly expiresAt?: string;
  /** What the place's authorization server registered `cw` as, and which
   *  server that was: a registration is presented to the server it came from
   *  and no other. */
  readonly client: { readonly clientId: string; readonly clientSecret?: string; readonly issuer: string };
}

/**
 * DRIVEN PORT — OAuth against one MCP server: signing in, and renewing what a
 * sign-in ended with (FR-148, FR-151).
 *
 * Discovery, registration, PKCE and the callback are the adapter's business;
 * the hexagon hands it an endpoint and keeps what comes back.
 */
export interface ForAuthorizing {
  /**
   * Sign in to the server at this endpoint in the developer's browser.
   *
   * `showAuthorizationUrl` is handed the address to open, once: the adapter
   * never opens it (plan §15). Raises a `DrivenFault` where the server cannot
   * be reached, the developer refuses, or nobody comes back in time.
   */
  authorize(endpoint: string, showAuthorizationUrl: (authorizationUrl: string) => void): Promise<OAuthGrant>;

  /**
   * Renew one grant with its refresh token, asking nobody.
   *
   * `undefined` where the server refuses: the developer has to sign in again.
   * A server that cannot be reached raises a `DrivenFault` instead, since
   * nothing says the grant is no good.
   */
  renew(endpoint: string, oauthGrant: OAuthGrant): Promise<OAuthGrant | undefined>;
}
