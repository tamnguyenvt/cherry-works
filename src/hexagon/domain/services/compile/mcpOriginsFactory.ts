import type { CharterRoot } from "../../models/charter/CharterRoot.js";
import { McpPrimitive } from "../../models/charter/primitive/McpPrimitive.js";
import { MCP_AUTH_METHODS } from "../../models/McpAuthMethod.js";
import type { ShortStrings } from "../../models/helper.js";
import type { McpOrigin } from "../../models/output/common/McpOrigin.js";

/**
 * Every place the charter's mcps reach, each once, whichever layer declared it
 * (FR-145).
 *
 * One per address and `path`: the repository and a vendor may call one place
 * by two names, and it is one place under both. What is held is where it is and
 * how it is signed in to — every way any identity there allows — the name
 * each identity is served under, and nothing an mcp's own file already says.
 */
export function mcpOriginsOf(charter: CharterRoot, shortenMcpIdentities: ShortStrings): readonly McpOrigin[] {
  const mcpsByKey = new Map<string, { identity: string; primitive: McpPrimitive }[]>();
  for (const { identity, primitive } of [...charter.primitives].sort((one, another) => (one.identity < another.identity ? -1 : 1))) {
    if (primitive.kind !== McpPrimitive.kind) continue;
    // Joined by a character neither side can hold: a path is one line, and an
    // address is an endpoint or a command line.
    const key = `${primitive.address}\n${primitive.headers.path ?? ""}`;
    mcpsByKey.set(key, [...(mcpsByKey.get(key) ?? []), { identity, primitive }]);
  }

  return [...mcpsByKey.entries()]
    .sort(([oneKey], [anotherKey]) => (oneKey < anotherKey ? -1 : 1))
    .map(([, mcpsAtOrigin]) => {
      const [firstMcp] = mcpsAtOrigin as [(typeof mcpsAtOrigin)[number], ...typeof mcpsAtOrigin];
      const { endpoint, command, args = [], path } = firstMcp.primitive.headers;
      const tokenEnv = mcpsAtOrigin.find((one) => one.primitive.headers.tokenEnv !== undefined)?.primitive.headers.tokenEnv;
      const auths = new Set(mcpsAtOrigin.flatMap((one) => one.primitive.headers.auth ?? []));

      return {
        identities: mcpsAtOrigin.map((one) => one.identity),
        names: Object.fromEntries(mcpsAtOrigin.map((one) => [one.identity, shortenMcpIdentities[one.identity] as string])),
        address: firstMcp.primitive.address,
        ...(endpoint === undefined ? {} : { endpoint }),
        ...(command === undefined ? {} : { command: { command, args, ...(tokenEnv === undefined ? {} : { tokenEnv }) } }),
        ...(path === undefined ? {} : { path }),
        auth: MCP_AUTH_METHODS.filter((auth) => auths.has(auth)),
      };
    });
}
