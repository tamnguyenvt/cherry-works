import { OUT_DIRECTORY } from "../../../path.js";
import type { Projection } from "../ProjectionPolicy.js";
import type { McpAuthMethod } from "../../McpAuthMethod.js";

/**
 * One address and `path`, once, however many mcps declare it (FR-145).
 *
 * Where a place is and how a developer signs in to it, and nothing else: what
 * each mcp there lets the agent use is its own, and the catalogue already lists
 * every mcp. Keyed by where it is rather than by what it is called, because the
 * repository and a vendor may call one place by two names.
 */
export interface McpOrigin {
  /** Every mcp at this address and path, sorted. */
  readonly identities: readonly string[];
  /** The name each of those identities is served under, its tools as
   *  `<name>__<tool>`: made once, by the build that wrote the bodies naming
   *  it, so the server reads it rather than making it again (FR-145). */
  readonly names: Readonly<Record<string, string>>;
  readonly address: string;
  readonly endpoint?: string;
  readonly command?: { readonly command: string; readonly args: readonly string[]; readonly tokenEnv?: string };
  readonly path?: string;
  /** Every way any identity here lets a developer sign in. */
  readonly auth: readonly McpAuthMethod[];
}

/** Every place the charter's mcps reach, each once: what `cw mcp serve` and
 *  `cw mcp auth` read, since neither reads a charter (FR-145). Ordered by
 *  address, then path (SC-007). */
export class McpOrigins {
  constructor(readonly origins: readonly McpOrigin[]) {}

  /** The file it is put down as, in the output folder: generated, and the
   *  charter's alone. Indented, since it is committed and read in diffs when a
   *  place moves (SC-038). */
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
