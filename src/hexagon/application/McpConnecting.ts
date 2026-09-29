import { DomainFault } from "../domain/models/DomainFault.js";
import { isSecureEndpoint } from "../domain/models/charter/primitive/McpPrimitive.js";
import type { McpOrigin } from "../domain/models/output/common/McpOrigin.js";
import { readCredential, writeCredential } from "../service/credentialRepo.js";
import { loadMcpOrigins } from "../service/mcpOriginsRepo.js";
import type { ForConnectingMcps } from "../port/driver/ForConnectingMcps.js";
import type { DataDTOs } from "../port/driver/dtos/index.js";
import type { ForAuthorizing } from "../port/zdriven/ForAuthorizing.js";
import type { ForKeepingSecrets } from "../port/zdriven/ForKeepingSecrets.js";
import type { ForReadingFiles } from "../port/zdriven/ForReadingFiles.js";

/**
 * APPLICATION SERVICE — the places the last build listed, signed in to by the
 * developer running it (FR-148 – FR-151).
 *
 * Reads `.cw/out/mcp-origins.json` and no charter. Holds no port that writes a
 * file: what it keeps goes to the credential store, so nothing it does can
 * change the repository (FR-149).
 */
export class McpConnecting implements ForConnectingMcps {
  readonly #repoPath: URL;
  readonly #fileReader: ForReadingFiles;
  readonly #secrets: ForKeepingSecrets;
  readonly #authorizing: ForAuthorizing;

  constructor(repoPath: URL, fileReader: ForReadingFiles, secrets: ForKeepingSecrets, authorizing: ForAuthorizing) {
    this.#repoPath = repoPath;
    this.#fileReader = fileReader;
    this.#secrets = secrets;
    this.#authorizing = authorizing;
  }

  async signInStatus(): Promise<readonly DataDTOs.SignInStatus[]> {
    return Promise.all(
      (await this.#signInAddresses()).map(async ({ address, identities, auth }) => {
        const credential = await readCredential(this.#secrets, address);
        return {
          type: "SignInStatus" as const,
          data: { address, identities, auth, signedIn: credential !== undefined, ...(credential && { method: credential.method }) },
        };
      }),
    );
  }

  async signInWithToken(address: string, token: string): Promise<void> {
    await this.#addressTaking(address, "token");
    if (token.trim() === "") throw new DomainFault(`No token was given for ${address}, so nothing was kept.`, 'Run "cw mcp auth" again and paste the token.');
    await writeCredential(this.#secrets, { address, method: "token", accessToken: token });
  }

  async signInWithOAuth(address: string, showAuthorizationUrl: (authorizationUrl: string) => void): Promise<void> {
    await this.#addressTaking(address, "oauth");
    const oauthGrant = await this.#authorizing.authorize(address, showAuthorizationUrl);
    await writeCredential(this.#secrets, { address, method: "oauth", ...oauthGrant });
  }

  /**
   * Every address a developer signs in to, once, ordered by address (plan
   * §19.5): one address is one account at one service, whatever path each
   * place there names. A local command taking no token signs in to nothing and
   * is left out.
   */
  async #signInAddresses(): Promise<readonly Pick<McpOrigin, "address" | "endpoint" | "identities" | "auth">[]> {
    const origins = await loadMcpOrigins(this.#repoPath, this.#fileReader);
    const addresses = new Map<string, { endpoint?: string; identities: Set<string>; auth: Set<McpOrigin["auth"][number]> }>();
    for (const { address, endpoint, identities, auth } of origins.filter((one) => one.auth.length > 0)) {
      const signInAddress = addresses.get(address) ?? { ...(endpoint !== undefined && { endpoint }), identities: new Set(), auth: new Set() };
      identities.forEach((identity) => signInAddress.identities.add(identity));
      auth.forEach((method) => signInAddress.auth.add(method));
      addresses.set(address, signInAddress);
    }
    return [...addresses]
      .sort(([one], [other]) => one.localeCompare(other))
      .map(([address, { endpoint, identities, auth }]) => ({
        address,
        ...(endpoint !== undefined && { endpoint }),
        identities: [...identities].sort(),
        auth: (["oauth", "token"] as const).filter((method) => auth.has(method)),
      }));
  }

  /** Refused where no place is at this address, or none there allows signing
   *  in this way: a credential nothing would use is not kept. Refused too where
   *  the address is plain `http` to another machine, whatever the build said:
   *  the list is a committed file, and a credential sent there travels in the
   *  clear. */
  async #addressTaking(address: string, method: McpOrigin["auth"][number]): Promise<void> {
    const signInAddress = (await this.#signInAddresses()).find((one) => one.address === address);
    if (signInAddress === undefined)
      throw new DomainFault(`No place the last build listed is at ${address}.`, 'Run "cw mcp auth --status" to see every address, or "cw build" if the charter changed.');
    if (signInAddress.endpoint !== undefined && !isSecureEndpoint(signInAddress.endpoint))
      throw new DomainFault(
        `${address} is plain http to another machine, so no credential is sent there.`,
        'Declare its endpoint as https://, then run "cw build".',
      );
    if (!signInAddress.auth.includes(method))
      throw new DomainFault(
        `${address} is not signed in to by ${method}; it allows ${signInAddress.auth.join(" or ")}.`,
        `Sign in there by ${signInAddress.auth.join(" or ")}.`,
      );
  }
}
