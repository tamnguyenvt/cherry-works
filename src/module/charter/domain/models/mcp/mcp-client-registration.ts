/** What an mcp origin's authorization server registered `cw` as, and which
 *  server that was: a registration is presented to the server it came from
 *  and no other. */
export class McpClientRegistration {
  readonly clientId: string;
  readonly clientSecret?: string;
  readonly issuer: string;

  constructor({
    clientId,
    clientSecret,
    issuer,
  }: Pick<McpClientRegistration, "clientId" | "issuer"> & Partial<Pick<McpClientRegistration, "clientSecret">>) {
    this.clientId = clientId;
    if (clientSecret !== undefined) this.clientSecret = clientSecret;
    this.issuer = issuer;
  }
}
