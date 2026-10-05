import { OUT_DIRECTORY } from "../../../path.js";
import type { Projection } from "../ProjectionPolicy.js";
import type { McpAuthMethod } from "../../McpAuthMethod.js";

/** One tool as an mcp origin lists it: its name, what it does, and what it takes. */
export interface McpToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
}

/**
 * One address and `path`, once, however many mcps declare it (FR-145).
 *
 * Where an mcp origin is, how a developer signs in to it, and the tools it listed
 * when the build reached it: which of them each mcp there lets the agent use is
 * its own, and the catalogue already lists every mcp. Keyed by where it is rather than by what it is called, because the
 * repository and a vendor may call one mcp origin by two names.
 */
export interface McpOrigin {
  /** Every mcp at this address and path, sorted. */
  readonly ids: readonly string[];
  /** The name each of those ids is served under, its tools as
   *  `<name>__<tool>`: made once, by the build that wrote the bodies naming
   *  it, so the server reads it rather than making it again (FR-145). */
  readonly names: Readonly<Record<string, string>>;
  readonly address: string;
  readonly endpoint?: string;
  readonly command?: { readonly command: string; readonly args: readonly string[]; readonly tokenEnv?: string };
  readonly path?: string;
  /** Every way any mcp here lets a developer sign in. */
  readonly auth: readonly McpAuthMethod[];
  /** Each tool an mcp here declares, as the mcp origin listed it when the build
   *  reached it, by name: what the server lists without reaching the mcp origin
   *  (EVAL-FR-031). None in a list written before it was kept. */
  readonly tools?: readonly McpToolDefinition[];
}

/** What an mcp origin is told apart by: its address and path, never its name. */
export const originKeyOf = ({ address, path }: { readonly address: string; readonly path?: string | undefined }): string =>
  // Joined by a character neither side can hold: a path is one line, and an
  // address is an endpoint or a command line.
  `${address}\n${path ?? ""}`;

/** Every mcp origin the charter's mcps reach, each once: what `cw mcp serve` and
 *  `cw mcp auth` read, since neither reads a charter (FR-145). Ordered by
 *  address, then path (SC-007). */
export class McpOrigins {
  constructor(readonly origins: readonly McpOrigin[]) {}

  /** The file it is put down as, in the output folder: generated, and the
   *  charter's alone. Indented, since it is committed and read in diffs when a
   *  mcp origin moves (SC-038). */
  get projections(): readonly Projection[] {
    return [
      {
        file: `${OUT_DIRECTORY}/mcp-origins.json`,
        contents: `${JSON.stringify({ origins: this.origins }, undefined, 2)}\n`,
        projectionPolicy: "replace",
        executable: false,
      },
    ];
  }
}
