/** What an adapter answering this port raises when the store refuses, named
 *  again here so it names this port and nothing behind it. */
export { DrivenFault } from "./DrivenFault.js";

/**
 * DRIVEN PORT — the credential store. One secret under one key: read, write,
 * remove (FR-149).
 *
 * A secret is a string here and nothing more. What it holds — a token, a
 * credential with its renewal — is the caller's to parse, so no domain type
 * and no DTO carries one, and no driver can show one (SC-036). Where it is
 * kept is the adapter's business: the operating system's own store, or a
 * test's map.
 */
export interface ForKeepingSecrets {
  /** The secret kept under this key, or `undefined` where none is. */
  readSecret(key: string): Promise<string | undefined>;

  /** Keep this secret under this key, replacing whatever was there. */
  writeSecret(key: string, secret: string): Promise<void>;

  /** Take away the secret under this key. A key with nothing under it is
   *  removed without complaint: what was asked for is already true. */
  removeSecret(key: string): Promise<void>;
}
