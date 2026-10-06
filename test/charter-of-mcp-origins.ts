import type { McpOrigin } from "../src/hexagon/domain/models/output/common/McpOrigin.js";

/** The mcp primitives that declare these mcp origins, one file per id under
 *  `.cw/charter/mcp/`, keyed by URL: what signing in reads (FR-148), where a
 *  build would have listed the same mcp origins in `.cw/out/mcp-origins.json`. */
export function charterFilesOf(origins: readonly McpOrigin[], repoHref = "file:///repo/"): Record<string, string> {
  return Object.fromEntries(
    origins.flatMap(({ ids, endpoint, command, path, auth }) =>
      ids.map((id) => [
        `${repoHref}.cw/charter/mcp/${id}/index.md`,
        [
          "---",
          "kind: mcp",
          `id: ${id}`,
          `description: The mcp origin ${id} reaches.`,
          ...(endpoint === undefined ? [] : [`endpoint: ${endpoint}`]),
          ...(command === undefined ? [] : [`command: ${command.command}`, `args: ${JSON.stringify(command.args)}`]),
          ...(path === undefined ? [] : [`path: ${path}`]),
          ...(auth.length === 0 ? [] : [`auth: ${JSON.stringify(auth)}`]),
          'tools: ["get_file_contents"]',
          "---",
          "",
          `The mcp origin ${id} reaches.`,
          "",
        ].join("\n"),
      ]),
    ),
  );
}
