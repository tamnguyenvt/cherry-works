import type { McpCredential } from "../../../domain/models/mcp/mcp-credential.js";

/** The credential an adapter keeps, named again here so it imports nothing of
 *  the hexagon but its port. */
export { McpClientRegistration, McpCredential } from "../../../domain/models/mcp/mcp-credential.js";

/** What an adapter answering this port raises when the store refuses, named
 *  again here so it names this port and nothing behind it. */
export { AdapterFault } from "../../../../shared/module.js";

/** Keeps the credentials of the mcp origins, wherever they are kept: what a
 *  credential holds is never shown, and no DTO carries one (SC-036). */
export interface ForStoringCredentials {
  /** The credential kept under this address, or `undefined` where none is. One
   *  that does not read as a credential is none: signing in again replaces it. */
  readCredential(address: string): Promise<McpCredential | undefined>;

  /** Keep this credential under its address, replacing what was there. */
  writeCredential(credential: McpCredential): Promise<void>;
}
