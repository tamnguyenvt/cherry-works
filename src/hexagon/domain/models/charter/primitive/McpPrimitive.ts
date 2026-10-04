import { z } from "zod";
import { BasePrimitive, CommonHeadersSchema, headersOf, GoodArraySchema, GoodLineSchema, type RequiredHeaders, type AssetFile } from "./BasePrimitive.js";
import type { PrimitiveLayer } from "../PrimitiveLayer.js";
import { MCP_AUTH_METHODS } from "../../McpAuthMethod.js";

/**
 * Whether a developer's credential may be sent to this endpoint: `https`, or
 * plain `http` only to this machine, for a server under test. Anything else
 * would send it in the clear.
 *
 * Read as a URL rather than matched as text, so the host checked is the host
 * reached: `http://localhost:1@elsewhere/` is `elsewhere`.
 */
export function isSecureEndpoint(endpoint: string): boolean {
  if (!URL.canParse(endpoint)) return false;
  const endpointURL = new URL(endpoint);
  return endpointURL.protocol === "https:" || (endpointURL.protocol === "http:" && ["127.0.0.1", "localhost"].includes(endpointURL.hostname));
}

/**
 * One MCP server, a place where a primitive's reasons are kept outside the
 * repository: reached at an `endpoint`, or started as a `command` (FR-142).
 *
 * One object refined rather than a union of the two shapes, so every header it
 * takes is still read off its `shape` (FR-039); which of the two a file holds,
 * and what that shape asks for beside it, is the refinement's to say.
 */
export const McpHeadersSchema = CommonHeadersSchema.extend({
  /** Reached over HTTP. Plain `http` only to this machine, for a server under
   *  test: anything else would send a developer's credential in the clear. */
  endpoint: GoodLineSchema
    .refine(isSecureEndpoint, {
      message: `"endpoint" is an https:// URL, or http:// to 127.0.0.1 or localhost for a server under test.`,
    })
    .optional(),
  /** Started as a local process, spoken to over its standard input and output. */
  command: GoodLineSchema.optional(),
  args: z.array(GoodLineSchema).readonly().optional(),
  auth: z.array(z.enum(MCP_AUTH_METHODS)).min(1).readonly().optional(),
  /** The environment variable a command reads its token from. */
  tokenEnv: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).optional(),
  /** The place inside that server: a repository, a database, a channel. */
  path: GoodLineSchema.optional(),
  /** The server's tools the agent may use there, by the server's own names. */
  tools: GoodArraySchema,
}).superRefine((headers, context) => {
  const addFault = (message: string) => context.addIssue({ code: "custom", message });
  const { endpoint, command, args, auth, tokenEnv } = headers;

  if (endpoint !== undefined && command !== undefined)
    return addFault(`This declares both "endpoint" and "command"; an mcp is one server, reached one way.`);
  if (endpoint === undefined && command === undefined)
    return addFault(`This declares neither "endpoint" nor "command", so there is no server to reach.`);

  if (endpoint !== undefined) {
    if (auth === undefined) addFault(`An endpoint says how a developer signs in to it: "auth" of oauth, token or both.`);
    if (args !== undefined) addFault(`"args" are a command's; an endpoint takes none.`);
    if (tokenEnv !== undefined) addFault(`"tokenEnv" is where a command reads its token; an endpoint takes none.`);
    return;
  }

  const takesToken = auth !== undefined;
  if (takesToken && (auth.length !== 1 || auth[0] !== "token"))
    addFault(`A command signs in by token alone: "auth: [token]", or no "auth" for one that takes none.`);
  if (takesToken && tokenEnv === undefined) addFault(`A command taking a token names where it reads it: "tokenEnv".`);
  if (!takesToken && tokenEnv !== undefined) addFault(`"tokenEnv" is read only by a command taking a token: add "auth: [token]", or drop it.`);
});
export type McpHeaders = Readonly<z.infer<typeof McpHeadersSchema>>;

export class McpPrimitive extends BasePrimitive<McpHeaders> {
  static readonly kind = "mcp" as const;
  readonly kind = McpPrimitive.kind;

  /** What this kind requires beyond the common headers. `endpoint` or
   *  `command` is required too, but which depends on the shape, so the schema's
   *  refinement says it rather than this (FR-004, FR-039). */
  static override readonly requires = { tools: "list" } as const satisfies RequiredHeaders;

  /** The schema its headers are read by: what `headersOf` refuses a file
   *  against, and what says the shape of every header this kind takes, required
   *  or not (FR-004). */
  static override readonly schema = McpHeadersSchema;

  /** When a reader of this charter is to open this kind at all, said
   *  where the kind's contract is: the neutral surface lists one
   *  line per kind and none of them is written down twice (FR-002). */
  static readonly activatesWhen =
    "a primitive's body names it as `[[<id>]]` — a place outside the repository, reached through `cw mcp serve`";

  /** An mcp reached at an endpoint, as an author writes one: what a refused
   *  header is fixed with. */
  static readonly sample: McpHeaders = {
    id: "mfbs/billing",
    description: "Billing service code and pull requests.",
    endpoint: "https://api.githubcopilot.com/mcp/",
    path: "moneyforward/billing-service",
    auth: ["oauth", "token"],
    tools: ["get_file_contents", "search_code", "list_pull_requests"],
  };

  /** The same place started as a local process: what a refused file declaring
   *  `command` is held up against, since that is the shape it was nearer. */
  static readonly commandSample: McpHeaders = {
    id: "mfbs/billing",
    description: "Billing service code and pull requests.",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    tokenEnv: "GITHUB_PERSONAL_ACCESS_TOKEN",
    auth: ["token"],
    path: "moneyforward/billing-service",
    tools: ["get_file_contents", "search_code", "list_pull_requests"],
  };

  /** What a developer signs in to, and what places are told apart by beside
   *  their `path`: the endpoint, or the command followed by each of its
   *  arguments. The refinement has already held that one of the two is here
   *  (FR-142). */
  get address(): string {
    const { endpoint, command, args = [] } = this.headers;
    return endpoint ?? [command, ...args].join(" ");
  }

  /** One mcp, or every fault its headers have, shown the sample of the shape
   *  it declared (FR-004, FR-142). */
  static of(record: Readonly<Record<string, unknown>>, body: string, assets: readonly AssetFile[] = [], primitiveLayer?: PrimitiveLayer): McpPrimitive {
    const nearerSample = record.command === undefined ? McpPrimitive.sample : McpPrimitive.commandSample;
    return new McpPrimitive(headersOf({ kind: McpPrimitive.kind, sample: nearerSample }, McpHeadersSchema, record), body, assets, primitiveLayer);
  }
}
