import type { McpAuthMethod } from "./mcp-auth-method.value-object.js";
import type { McpClientRegistration } from "./mcp-client-registration.js";

/**
 * One developer's sign-in at one address, as the credential store keeps it.
 *
 * No DTO holds it, so no driver can show one (SC-036): it is read, and handed
 * on as the access token a call is made with.
 */
export class McpCredential {
  readonly address: string;
  readonly method: McpAuthMethod;
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly expiresAt?: string;
  readonly client?: McpClientRegistration;

  constructor({
    address,
    method,
    accessToken,
    refreshToken,
    expiresAt,
    client,
  }: Pick<McpCredential, "address" | "method" | "accessToken"> &
    Partial<Pick<McpCredential, "refreshToken" | "expiresAt" | "client">>) {
    this.address = address;
    this.method = method;
    this.accessToken = accessToken;
    if (refreshToken !== undefined) this.refreshToken = refreshToken;
    if (expiresAt !== undefined) this.expiresAt = expiresAt;
    if (client !== undefined) this.client = client;
  }
}
