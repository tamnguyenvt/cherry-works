import type { CharterRoot } from "../charter/charter-root.js";
import { McpPrimitive } from "../primitive/mcp-primitive.js";
import { McpAuthMethod } from "../mcp/mcp-auth-method.js";
import type { ShortStrings } from "../../helper.js";
import { McpOrigin, type McpToolDefinition, McpOrigins } from "./mcp-origin.js";

/** Makes the list of mcp origins a build writes. */
export class McpOriginsFactory {
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
  static create(
    charter: CharterRoot,
    shortMcpIds: ShortStrings,
    toolsByOriginKey: ReadonlyMap<string, readonly McpToolDefinition[]> = new Map(),
  ): readonly McpOrigin[] {
    const mcpsByKey = new Map<string, McpPrimitive[]>();
    for (const primitive of [...charter.primitives].sort((leftPrimitive, rightPrimitive) => (leftPrimitive.headers.id < rightPrimitive.headers.id ? -1 : 1))) {
      if (!(primitive instanceof McpPrimitive)) continue;
      const key = McpOrigins.originKeyOf({ address: primitive.address, path: primitive.headers.path });
      mcpsByKey.set(key, [...(mcpsByKey.get(key) ?? []), primitive]);
    }

    return [...mcpsByKey.entries()]
      .sort(([oneKey], [anotherKey]) => (oneKey < anotherKey ? -1 : 1))
      .map(([key, mcpsAtOrigin]) => {
        const [firstMcp] = mcpsAtOrigin as [(typeof mcpsAtOrigin)[number], ...typeof mcpsAtOrigin];
        const { endpoint, command, args = [], path } = firstMcp.headers;
        const tokenEnv = mcpsAtOrigin.find((mcpPrimitive) => mcpPrimitive.headers.tokenEnv !== undefined)?.headers.tokenEnv;
        const auths = new Set(mcpsAtOrigin.flatMap((mcpPrimitive) => mcpPrimitive.headers.auth ?? []));
        const declaredTools = new Set(mcpsAtOrigin.flatMap((mcpPrimitive) => mcpPrimitive.headers.tools));
        const listedTools = toolsByOriginKey.get(key);

        return new McpOrigin({
          ids: mcpsAtOrigin.map((mcpPrimitive) => mcpPrimitive.headers.id),
          names: Object.fromEntries(mcpsAtOrigin.map((mcpPrimitive) => [mcpPrimitive.headers.id, shortMcpIds[mcpPrimitive.headers.id] as string])),
          address: firstMcp.address,
          ...(endpoint === undefined ? {} : { endpoint }),
          ...(command === undefined ? {} : { command: { command, args, ...(tokenEnv === undefined ? {} : { tokenEnv }) } }),
          ...(path === undefined ? {} : { path }),
          auth: McpAuthMethod.names.filter((auth) => auths.has(auth)),
          ...(listedTools !== undefined && {
            tools: listedTools.filter(({ name }) => declaredTools.has(name)).sort((leftTool, rightTool) => leftTool.name.localeCompare(rightTool.name)),
          }),
        });
      });
  }

  private constructor() {}
}
