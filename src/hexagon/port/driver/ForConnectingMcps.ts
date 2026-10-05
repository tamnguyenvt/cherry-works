import type { DataDTOs } from "./dtos/index.js";

/**
 * DRIVER PORT — the mcp origins the last build listed, as a developer reaches them
 * (FR-148 – FR-154).
 *
 * Apart from `ForManagingCharter` because it reads no charter: what it reaches
 * is `.cw/out/mcp-origins.json`, the list the last build wrote, and what it
 * keeps is on this machine rather than in the repository. It holds no port that
 * writes a file, so nothing on it can change the repository.
 */
export interface ForConnectingMcps {
  /**
   * Every address that takes a sign-in, ordered by address, and whether the
   * developer has signed in there (FR-150). Asks nothing and changes nothing: a
   * credential past its expiry is still signed in, since it is renewed when it
   * is used.
   *
   * Refused where the last build wrote no list of mcp origins, saying to build.
   */
  signInStatus(): Promise<readonly DataDTOs.SignInStatus[]>;

  /**
   * Keep this token as the developer's credential at this address, replacing
   * whatever was kept there (FR-148, FR-149). Refused, keeping nothing, for an
   * address no mcp origin is at, one that takes no token, or an empty token.
   */
  signInWithToken(address: string, token: string): Promise<void>;

  /**
   * Sign in at this address in the developer's browser, and keep what the mcp origin
   * issued (FR-148). `showAuthorizationUrl` is handed the address to open.
   * Refused, keeping nothing, for an address no mcp origin is at or one that takes
   * no OAuth sign-in.
   */
  signInWithOAuth(address: string, showAuthorizationUrl: (authorizationUrl: string) => void): Promise<void>;

  /**
   * Every tool the mcp origins declare that a call can reach, under its served
   * name, and what was left out and why (FR-153, FR-154). Read off the tools
   * the last build kept in the list of mcp origins each time it is asked, reaching
   * no mcp origin (EVAL-FR-031).
   *
   * Refused where the last build wrote no list of mcp origins, saying to build.
   */
  tools(): Promise<DataDTOs.ServedTools>;

  /**
   * Forward one call by its served name to its mcp origin, under the developer's
   * own credential, and answer what the mcp origin answered as it came (FR-154);
   * the mcp origin is reached for this call and let go once it answered. A
   * name that was not served, or whose mcp origin is down or not signed in to, is
   * answered as an error saying why, and reaches no mcp origin.
   */
  call(name: string, args: Readonly<Record<string, unknown>>): Promise<DataDTOs.ToolAnswer>;
}
