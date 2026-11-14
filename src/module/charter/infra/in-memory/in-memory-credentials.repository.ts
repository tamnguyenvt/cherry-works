import type { ForStoringCredentials, McpCredential } from "../../app/port/out/storing-credentials.port.js";
import { parseCredentialSecret } from "../helper.js";

/** Credentials held in memory, each as the JSON secret the keychain would keep
 *  under its address: a test looks into `secretByAddress` to see what was kept, and
 *  nothing reaches the machine's credential store. */
export class InMemoryCredentialsRepository implements ForStoringCredentials {
  readonly secretByAddress = new Map<string, string>();

  async readCredential(address: string): Promise<McpCredential | undefined> {
    const secret = this.secretByAddress.get(address);
    return secret === undefined ? undefined : parseCredentialSecret(secret);
  }

  async writeCredential(credential: McpCredential): Promise<void> {
    this.secretByAddress.set(credential.address, JSON.stringify(credential));
  }
}
