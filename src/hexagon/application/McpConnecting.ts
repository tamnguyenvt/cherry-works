import { DomainFault } from "../domain/models/DomainFault.js";
import { isSecureEndpoint } from "../domain/models/charter/primitive/McpPrimitive.js";
import type { McpOrigin } from "../domain/models/output/common/McpOrigin.js";
import { credentialFor, readCredential, writeCredential } from "../service/credentialRepo.js";
import { loadMcpOrigins, loadMcpTools } from "../service/mcpOriginsRepo.js";
import type { ForConnectingMcps } from "../port/driver/ForConnectingMcps.js";
import type { DataDTOs } from "../port/driver/dtos/index.js";
import type { ForAuthorizing } from "../port/zdriven/ForAuthorizing.js";
import { UnauthorizedMcpFault, type ForCallingMcpServers, type McpServerConnection } from "../port/zdriven/ForCallingMcpServers.js";
import type { ForKeepingSecrets } from "../port/zdriven/ForKeepingSecrets.js";
import type { ForParsingYaml } from "../port/zdriven/ForParsingYaml.js";
import type { ForReadingFiles } from "../port/zdriven/ForReadingFiles.js";

/** How long one place has to answer when the server starts (FR-154). */
const CONNECT_TIMEOUT_MS = 10_000;

/** Where a call to one served name goes: the place, the identity declaring the
 *  tool, and the tool's name there. */
interface ToolRoute {
  readonly origin: McpOrigin;
  readonly identity: string;
  readonly upstream: string;
  readonly connection: McpServerConnection;
}

/** What one run reached, made once: what the agent is shown, where each served
 *  name goes, and each declared tool of a place not reached, under why. */
interface McpServing {
  readonly servedTools: DataDTOs.ServedTools;
  readonly toolRoutes: ReadonlyMap<string, ToolRoute>;
  readonly unreachableTools: ReadonlyMap<string, string>;
  readonly connections: readonly McpServerConnection[];
}

/** An answer no place gave: why the call reached nothing, as the agent reads a
 *  tool's error. */
const errorAnswerOf = (text: string): DataDTOs.ToolAnswer => ({
  type: "ToolAnswer",
  data: { content: [{ type: "text", text }], isError: true },
});

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
  readonly #yamlParser: ForParsingYaml;
  readonly #mcpServers: ForCallingMcpServers;
  #mcpServing: Promise<McpServing> | undefined;

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

  async served(): Promise<DataDTOs.ServedTools> {
    return (await this.#serving()).servedTools;
  }

  async call(name: string, args: Readonly<Record<string, unknown>>): Promise<DataDTOs.ToolAnswer> {
    const { toolRoutes, unreachableTools } = await this.#serving();
    const toolRoute = toolRoutes.get(name);
    if (toolRoute === undefined)
      return errorAnswerOf(unreachableTools.get(name) ?? `"${name}" is not a tool this server serves; call one it listed.`);

    const { origin, identity, upstream, connection } = toolRoute;
    const signInAgain = `${origin.address} refused your credential. Run "cw mcp auth ${identity}" at a terminal to sign in there again.`;
    // A local command was handed its token when it started; only a place at an
    // endpoint is sent one with each call, renewed first where it has expired.
    const accessTokenOf = (refused: boolean) =>
      origin.endpoint === undefined ? Promise.resolve(undefined) : credentialFor(this.#secrets, this.#authorizing, origin, { refused });
    try {
      try {
        return { type: "ToolAnswer", data: await connection.callTool(upstream, args, await accessTokenOf(false)) };
      } catch (raised) {
        if (!(raised instanceof UnauthorizedMcpFault)) throw raised;
        // Refused once: renewed and tried again, and a second refusal, or a
        // renewal that cannot be made, is the developer's to sign in again.
        const renewedToken = await accessTokenOf(true).catch(() => undefined);
        if (renewedToken === undefined) return errorAnswerOf(signInAgain);
        return { type: "ToolAnswer", data: await connection.callTool(upstream, args, renewedToken) };
      }
    } catch (raised) {
      if (raised instanceof UnauthorizedMcpFault) return errorAnswerOf(signInAgain);
      if (raised instanceof DomainFault) return errorAnswerOf(`${raised.message} ${raised.fix}`);
      throw raised;
    }
  }

  async stopServing(): Promise<void> {
    if (this.#mcpServing === undefined) return;
    const { connections } = await this.#mcpServing;
    await Promise.all(connections.map((connection) => connection.close()));
  }

  /**
   * Every place the last build listed, reached at once and once per run
   * (FR-152). What each lists is kept where one of its identities
   * declares it, renamed `<prefix>__<tool>`; a place down or not signed in to,
   * and a declared tool its place lacks, is said and left out, and the rest
   * are served (FR-153, FR-154, SC-039).
   */
  #serving(): Promise<McpServing> {
    this.#mcpServing ??= (async () => {
      const origins = await loadMcpOrigins(this.#repoPath, this.#fileReader);
      const toolsByIdentity = await loadMcpTools(this.#repoPath, this.#fileReader, this.#yamlParser);

      const problems: string[] = [];
      const servedTools: DataDTOs.ServedTool[] = [];
      const toolRoutes = new Map<string, ToolRoute>();
      const unreachableTools = new Map<string, string>();
      const connections: McpServerConnection[] = [];

      const reachedPlaces = await Promise.all(
        origins.map(async (origin) => {
          try {
            const accessToken = origin.auth.length > 0 ? await credentialFor(this.#secrets, this.#authorizing, origin) : undefined;
            return { origin, connection: await this.#mcpServers.connect(origin, accessToken, CONNECT_TIMEOUT_MS) };
          } catch (raised) {
            if (!(raised instanceof DomainFault)) throw raised;
            return { origin, reason: `${raised.message} ${raised.fix}` };
          }
        }),
      );

      for (const { origin, connection, reason } of reachedPlaces) {
        if (connection !== undefined) connections.push(connection);
        else problems.push(`${origin.identities.join(", ")}: ${reason}`);

        for (const identity of origin.identities) {
          const declaredTools = toolsByIdentity.get(identity);
          if (declaredTools === undefined) {
            problems.push(`${identity} has no compiled document under .cw/out/, so none of its tools is served. Run "cw build".`);
            continue;
          }
          // The name the build served this identity under and wrote into
          // every body naming it (FR-145); a list without one is from before.
          const identityName = origin.names?.[identity];
          if (identityName === undefined) {
            problems.push(`${identity} has no served name in .cw/out/mcp-origins.json, so none of its tools is served. Run "cw build" again.`);
            continue;
          }
          for (const tool of declaredTools) {
            const servedName = `${identityName}__${tool}`;
            if (connection === undefined) {
              unreachableTools.set(servedName, reason ?? "");
              continue;
            }
            const upstreamTool = connection.tools.find(({ name }) => name === tool);
            if (upstreamTool === undefined) {
              problems.push(`${identity} declares "${tool}", which ${origin.address} does not have; it is not served.`);
              continue;
            }
            const placeName = origin.path === undefined ? identity : `${identity} — ${origin.path}`;
            servedTools.push({
              type: "ServedTool",
              data: {
                name: servedName,
                description: `[${placeName}] ${upstreamTool.description ?? ""}`.trimEnd(),
                inputSchema: upstreamTool.inputSchema,
              },
            });
            toolRoutes.set(servedName, { origin, identity, upstream: tool, connection });
          }
        }
      }

      return {
        servedTools: {
          type: "ServedTools",
          data: { tools: servedTools.sort((one, other) => one.data.name.localeCompare(other.data.name)), problems },
        },
        toolRoutes,
        unreachableTools,
        connections,
      };
    })();
    return this.#mcpServing;
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
