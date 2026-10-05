import { DomainFault } from "../domain/models/DomainFault.js";
import { isSecureEndpoint } from "../domain/models/charter/primitive/McpPrimitive.js";
import type { McpOrigin } from "../domain/models/output/common/McpOrigin.js";
import { credentialFor, readCredential, writeCredential } from "../service/credentialRepo.js";
import { loadMcpOrigins, loadMcpTools } from "../service/mcpOriginsRepo.js";
import type { ForConnectingMcps } from "../port/driver/ForConnectingMcps.js";
import type { DataDTOs } from "../port/driver/dtos/index.js";
import type { ForAuthorizing } from "../port/zdriven/ForAuthorizing.js";
import { UnauthorizedMcpFault, type ForCallingMcpServers } from "../port/zdriven/ForCallingMcpServers.js";
import type { ForKeepingSecrets } from "../port/zdriven/ForKeepingSecrets.js";
import type { ForParsingYaml } from "../port/zdriven/ForParsingYaml.js";
import type { ForReadingFiles } from "../port/zdriven/ForReadingFiles.js";

/** How long one mcp origin has to answer when the server starts (FR-154). */
const CONNECT_TIMEOUT_MS = 10_000;

/** One tool an mcp declares, under the name it is served by: the mcp origin it is
 *  at, the id declaring it, and its name there. */
interface DeclaredTool {
  readonly origin: McpOrigin;
  readonly id: string;
  readonly tool: string;
  readonly servedName: string;
}

/** An answer no mcp origin gave: why the call reached nothing, as the agent reads a
 *  tool's error. */
const errorAnswerOf = (text: string): DataDTOs.ToolAnswer => ({
  type: "ToolAnswer",
  data: { content: [{ type: "text", text }], isError: true },
});

/**
 * APPLICATION SERVICE — the mcp origins the last build listed, signed in to by the
 * developer running it (FR-148 – FR-151).
 *
 * Reads `.cw/out/mcp-origins.json` and no charter, every time it is asked:
 * every tool is listed off what the build kept there, and an mcp origin is reached
 * only for a call, and let go once it has answered (EVAL-FR-031). Holds no port that writes a file: what it keeps
 * goes to the credential store, so nothing it does can change the repository
 * (FR-149).
 */
export class McpConnecting implements ForConnectingMcps {
  readonly #repoPath: URL;
  readonly #fileReader: ForReadingFiles;
  readonly #secrets: ForKeepingSecrets;
  readonly #authorizing: ForAuthorizing;
  readonly #yamlParser: ForParsingYaml;
  readonly #mcpServers: ForCallingMcpServers;

  constructor(
    repoPath: URL,
    fileReader: ForReadingFiles,
    secrets: ForKeepingSecrets,
    authorizing: ForAuthorizing,
    yamlParser: ForParsingYaml,
    mcpServers: ForCallingMcpServers,
  ) {
    this.#repoPath = repoPath;
    this.#fileReader = fileReader;
    this.#secrets = secrets;
    this.#authorizing = authorizing;
    this.#yamlParser = yamlParser;
    this.#mcpServers = mcpServers;
  }

  async signInStatus(): Promise<readonly DataDTOs.SignInStatus[]> {
    return Promise.all(
      (await this.#signInAddresses()).map(async ({ address, ids, auth }) => {
        const credential = await readCredential(this.#secrets, address);
        return {
          type: "SignInStatus" as const,
          data: { address, ids, auth, signedIn: credential !== undefined, ...(credential && { method: credential.method }) },
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

  async tools(): Promise<DataDTOs.ServedTools> {
    const { declaredTools, problems } = await this.#declaredTools();
    const servedTools: DataDTOs.ServedTool[] = [];
    for (const { origin, id, tool, servedName } of declaredTools) {
      const keptTool = origin.tools?.find(({ name }) => name === tool);
      if (keptTool === undefined) {
        problems.push(`${id} declares "${tool}", which .cw/out/mcp-origins.json does not hold; it is not served. Run "cw build" again.`);
        continue;
      }
      const mcpOriginName = origin.path === undefined ? id : `${id} — ${origin.path}`;
      servedTools.push({
        type: "ServedTool",
        data: { name: servedName, description: `[${mcpOriginName}] ${keptTool.description}`.trimEnd(), inputSchema: keptTool.inputSchema },
      });
    }
    return { type: "ServedTools", data: { tools: servedTools.sort((one, other) => one.data.name.localeCompare(other.data.name)), problems } };
  }

  async call(name: string, args: Readonly<Record<string, unknown>>): Promise<DataDTOs.ToolAnswer> {
    const declaredTool = (await this.#declaredTools()).declaredTools.find(({ servedName }) => servedName === name);
    if (declaredTool === undefined) return errorAnswerOf(`"${name}" is not a tool this server serves; call one it listed.`);

    const { origin, id, tool } = declaredTool;
    const signInAgain = `${origin.address} refused your credential. Run "cw mcp auth ${id}" at a terminal to sign in there again.`;
    // A local command was handed its token when it started; only an mcp origin at an
    // endpoint is sent one with each call, renewed first where it has expired.
    const accessTokenOf = (refused: boolean) =>
      origin.endpoint === undefined ? Promise.resolve(undefined) : credentialFor(this.#secrets, this.#authorizing, origin, { refused });
    try {
      // Reached for this call alone, and let go once it answered, a local
      // command's process stopped whatever the answer came to.
      const connectToken = origin.auth.length > 0 ? await credentialFor(this.#secrets, this.#authorizing, origin) : undefined;
      const connection = await this.#mcpServers.connect(origin, connectToken, CONNECT_TIMEOUT_MS);
      try {
        return { type: "ToolAnswer", data: await connection.callTool(tool, args, await accessTokenOf(false)) };
      } catch (raised) {
        if (!(raised instanceof UnauthorizedMcpFault)) throw raised;
        // Refused once: renewed and tried again, and a second refusal, or a
        // renewal that cannot be made, is the developer's to sign in again.
        const renewedToken = await accessTokenOf(true).catch(() => undefined);
        if (renewedToken === undefined) return errorAnswerOf(signInAgain);
        return { type: "ToolAnswer", data: await connection.callTool(tool, args, renewedToken) };
      } finally {
        await connection.close();
      }
    } catch (raised) {
      if (raised instanceof UnauthorizedMcpFault) return errorAnswerOf(signInAgain);
      if (raised instanceof DomainFault) return errorAnswerOf(`${raised.message} ${raised.fix}`);
      throw raised;
    }
  }

  /**
   * Every tool the mcps the last build listed declare, under the name it is
   * served by, `<prefix>__<tool>` (FR-152, FR-153); an mcp whose compiled
   * document or served name is missing is said, naming the fix, and serves
   * nothing.
   */
  async #declaredTools(): Promise<{ readonly declaredTools: readonly DeclaredTool[]; readonly problems: string[] }> {
    const { origins } = await loadMcpOrigins(this.#repoPath, this.#fileReader);
    const toolsById = await loadMcpTools(this.#repoPath, this.#fileReader, this.#yamlParser);
    const problems: string[] = [];
    const declaredTools: DeclaredTool[] = [];
    for (const origin of origins)
      for (const id of origin.ids) {
        const tools = toolsById.get(id);
        if (tools === undefined) {
          problems.push(`${id} has no compiled document under .cw/out/, so none of its tools is served. Run "cw build".`);
          continue;
        }
        // The name the build served this id under and wrote into every body
        // naming it (FR-145); a list without one is from before.
        const servedPrefix = origin.names?.[id];
        if (servedPrefix === undefined) {
          problems.push(`${id} has no served name in .cw/out/mcp-origins.json, so none of its tools is served. Run "cw build" again.`);
          continue;
        }
        declaredTools.push(...tools.map((tool) => ({ origin, id, tool, servedName: `${servedPrefix}__${tool}` })));
      }
    return { declaredTools, problems };
  }

  /**
   * Every address a developer signs in to, once, ordered by address (plan
   * §19.5): one address is one account at one service, whatever path each
   * mcp origin there names. A local command taking no token signs in to nothing and
   * is left out.
   */
  async #signInAddresses(): Promise<readonly Pick<McpOrigin, "address" | "endpoint" | "ids" | "auth">[]> {
    const { origins } = await loadMcpOrigins(this.#repoPath, this.#fileReader);
    const addresses = new Map<string, { endpoint?: string; ids: Set<string>; auth: Set<McpOrigin["auth"][number]> }>();
    for (const { address, endpoint, ids, auth } of origins.filter((one) => one.auth.length > 0)) {
      const signInAddress = addresses.get(address) ?? { ...(endpoint !== undefined && { endpoint }), ids: new Set(), auth: new Set() };
      ids.forEach((id) => signInAddress.ids.add(id));
      auth.forEach((method) => signInAddress.auth.add(method));
      addresses.set(address, signInAddress);
    }
    return [...addresses]
      .sort(([one], [other]) => one.localeCompare(other))
      .map(([address, { endpoint, ids, auth }]) => ({
        address,
        ...(endpoint !== undefined && { endpoint }),
        ids: [...ids].sort(),
        auth: (["oauth", "token"] as const).filter((method) => auth.has(method)),
      }));
  }

  /** Refused where no mcp origin is at this address, or none there allows signing
   *  in this way: a credential nothing would use is not kept. Refused too where
   *  the address is plain `http` to another machine, whatever the build said:
   *  the list is a committed file, and a credential sent there travels in the
   *  clear. */
  async #addressTaking(address: string, method: McpOrigin["auth"][number]): Promise<void> {
    const signInAddress = (await this.#signInAddresses()).find((one) => one.address === address);
    if (signInAddress === undefined)
      throw new DomainFault(`No mcp origin the last build listed is at ${address}.`, 'Run "cw mcp auth --status" to see every address, or "cw build" if the charter changed.');
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
