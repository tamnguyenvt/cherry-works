import { DomainFault } from "../domain/models/DomainFault.js";
import { isSecureEndpoint } from "../domain/models/charter/primitive/McpPrimitive.js";
import type { McpOrigin } from "../domain/models/output/common/McpOrigin.js";
import type { ForAuthorizing, OAuthGrant } from "../port/zdriven/ForAuthorizing.js";
import type { ForKeepingSecrets } from "../port/zdriven/ForKeepingSecrets.js";

/**
 * One developer's sign-in at one address, as the credential store keeps it:
 * one JSON value under the address (data-model §17.3).
 *
 * Not a domain type: no port carries it into the hexagon and no DTO holds it,
 * so no driver can show one (SC-036). It is read here, and handed on as the
 * access token a call is made with.
 */
export interface Credential {
  readonly address: string;
  readonly method: "oauth" | "token";
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly expiresAt?: string;
  readonly client?: OAuthGrant["client"];
}

/** The credential kept under this address, or `undefined` where none is. One
 *  that does not read as a credential is none: signing in again replaces it. */
export async function readCredential(secrets: ForKeepingSecrets, address: string): Promise<Credential | undefined> {
  const secret = await secrets.readSecret(address);
  if (secret === undefined) return undefined;
  try {
    const credential = JSON.parse(secret) as Credential;
    return typeof credential?.accessToken === "string" ? credential : undefined;
  } catch {
    return undefined;
  }
}

/** Keep this credential under its address, replacing what was there. */
export async function writeCredential(secrets: ForKeepingSecrets, credential: Credential): Promise<void> {
  await secrets.writeSecret(credential.address, JSON.stringify(credential));
}

/**
 * The access token a call to this place is made with: the developer's own,
 * renewed first where it has expired, asking nobody (FR-151, SC-035).
 *
 * A place nobody signed in to, or whose credential expired and cannot be
 * renewed, is refused naming the command that signs in again there. A renewal
 * is kept, so the next call uses it rather than renewing again. A place at
 * plain `http` on another machine is refused before anything is read: the
 * credential would travel in the clear.
 *
 * `refused` says the place has just refused this credential, so it is renewed
 * whatever its expiry says.
 */
export async function credentialFor(
  secrets: ForKeepingSecrets,
  authorizing: ForAuthorizing,
  origin: McpOrigin,
  { refused = false }: { readonly refused?: boolean } = {},
): Promise<string> {
  if (origin.endpoint !== undefined && !isSecureEndpoint(origin.endpoint))
    throw new DomainFault(`${origin.address} is plain http to another machine, so no credential is sent there.`, 'Declare its endpoint as https://, then run "cw build".');
  const signInAgain = `Run "cw mcp auth ${origin.ids[0] ?? ""}" at a terminal to sign in there.`;
  const credential = await readCredential(secrets, origin.address);
  if (credential === undefined) throw new DomainFault(`You are not signed in to ${origin.address}.`, signInAgain);

  // A credential the place has just refused is renewed as an expired one is:
  // the place knows better than `expiresAt` (FR-151).
  const expired = refused || (credential.expiresAt !== undefined && Date.parse(credential.expiresAt) <= Date.now());
  if (!expired) return credential.accessToken;

  const { address, method, client, ...tokens } = credential;
  const renewedGrant =
    origin.endpoint !== undefined && client !== undefined && tokens.refreshToken !== undefined
      ? await authorizing.renew(origin.endpoint, { ...tokens, client })
      : undefined;
  if (renewedGrant === undefined)
    throw new DomainFault(`Your sign-in to ${address} has expired and could not be renewed.`, signInAgain);

  await writeCredential(secrets, { address, method, ...renewedGrant });
  return renewedGrant.accessToken;
}
