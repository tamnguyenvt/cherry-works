import type { CharterRoot } from "../../models/charter/CharterRoot.js";
import { McpPrimitive } from "../../models/charter/primitive/McpPrimitive.js";
import { MCP_AUTH_METHODS } from "../../models/McpAuthMethod.js";
import type { ShortStrings } from "../../models/helper.js";
import { originKeyOf, type McpOrigin, type McpToolDefinition } from "../../models/output/common/McpOrigin.js";

/**
 * Every mcp origin the charter's mcps reach, each once, whichever layer declared it
 * (FR-145).
 *
 * One per address and `path`: the repository and a vendor may call one mcp origin
 * by two names, and it is one mcp origin under both. What is held is where it is and
 * how it is signed in to — every way any mcp there allows — the name
 * each id is served under, and nothing an mcp's own file already says but the
 * tools it declares, as `toolsByOriginKey` says the mcp origin listed them, sorted by
 * name (EVAL-FR-031).
 */
export function mcpOriginsOf(
  charter: CharterRoot,
  shortMcpIds: ShortStrings,
  toolsByOriginKey: ReadonlyMap<string, readonly McpToolDefinition[]> = new Map(),
): readonly McpOrigin[] {
  const mcpsByKey = new Map<string, McpPrimitive[]>();
  for (const primitive of [...charter.primitives].sort((one, another) => (one.headers.id < another.headers.id ? -1 : 1))) {
    if (!(primitive instanceof McpPrimitive)) continue;
    const key = originKeyOf({ address: primitive.address, path: primitive.headers.path });
    mcpsByKey.set(key, [...(mcpsByKey.get(key) ?? []), primitive]);
  }

  return [...mcpsByKey.entries()]
    .sort(([oneKey], [anotherKey]) => (oneKey < anotherKey ? -1 : 1))
    .map(([key, mcpsAtOrigin]) => {
      const [firstMcp] = mcpsAtOrigin as [(typeof mcpsAtOrigin)[number], ...typeof mcpsAtOrigin];
      const { endpoint, command, args = [], path } = firstMcp.headers;
      const tokenEnv = mcpsAtOrigin.find((one) => one.headers.tokenEnv !== undefined)?.headers.tokenEnv;
      const auths = new Set(mcpsAtOrigin.flatMap((one) => one.headers.auth ?? []));
      const declaredTools = new Set(mcpsAtOrigin.flatMap((one) => one.headers.tools));
      const listedTools = toolsByOriginKey.get(key);

      return {
        ids: mcpsAtOrigin.map((one) => one.headers.id),
        names: Object.fromEntries(mcpsAtOrigin.map((one) => [one.headers.id, shortMcpIds[one.headers.id] as string])),
        address: firstMcp.address,
        ...(endpoint === undefined ? {} : { endpoint }),
        ...(command === undefined ? {} : { command: { command, args, ...(tokenEnv === undefined ? {} : { tokenEnv }) } }),
        ...(path === undefined ? {} : { path }),
        auth: MCP_AUTH_METHODS.filter((auth) => auths.has(auth)),
        ...(listedTools !== undefined && {
          tools: listedTools.filter(({ name }) => declaredTools.has(name)).sort((one, other) => one.name.localeCompare(other.name)),
        }),
      };
    });
}
