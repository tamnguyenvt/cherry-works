/** What an mcp origin's authorization server registered `cw` as, and which
 *  server that was: a registration is presented to the server it came from
 *  and no other. */
export class McpClientRegistration {
  readonly clientId: string;
  readonly clientSecret?: string;
  readonly issuer: string;

  constructor({ clientId, clientSecret, issuer }: Pick<McpClientRegistration, "clientId" | "issuer"> & Partial<Pick<McpClientRegistration, "clientSecret">>) {
    this.clientId = clientId;
    if (clientSecret !== undefined) this.clientSecret = clientSecret;
    this.issuer = issuer;
  }
}

/**
 * One developer's sign-in at one address, as the credential store keeps it.
 *
 * No DTO holds it, so no driver can show one (SC-036): it is read, and handed
 * on as the access token a call is made with.
 */
export class McpCredential {
  readonly address: string;
  readonly method: "oauth" | "token";
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly expiresAt?: string;
  readonly client?: McpClientRegistration;

  constructor({ address, method, accessToken, refreshToken, expiresAt, client }: Pick<McpCredential, "address" | "method" | "accessToken"> & Partial<Pick<McpCredential, "refreshToken" | "expiresAt" | "client">>) {
    this.address = address;
    this.method = method;
    this.accessToken = accessToken;
    if (refreshToken !== undefined) this.refreshToken = refreshToken;
    if (expiresAt !== undefined) this.expiresAt = expiresAt;
    if (client !== undefined) this.client = client;
  }
}
