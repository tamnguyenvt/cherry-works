import { OutputPart } from "./output-part.js";
import type { McpAuthMethodName } from "../mcp/mcp-auth-method.js";

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
export class McpOrigin {
  /** Every mcp at this address and path, sorted. */
  declare readonly ids: readonly string[];
  /** The name each of those ids is served under, its tools as
   *  `<name>__<tool>`: made once, by the build that wrote the bodies naming
   *  it, so the server reads it rather than making it again (FR-145). */
  declare readonly names: Readonly<Record<string, string>>;
  declare readonly address: string;
  declare readonly endpoint?: string;
  declare readonly command?: { readonly command: string; readonly args: readonly string[]; readonly tokenEnv?: string };
  declare readonly path?: string;
  /** Every way any mcp here lets a developer sign in. */
  declare readonly auth: readonly McpAuthMethodName[];
  /** Each tool an mcp here declares, as the mcp origin listed it when the build
   *  reached it, by name: what the server lists without reaching the mcp origin
   *  (EVAL-FR-031). None in a list written before it was kept. */
  declare readonly tools?: readonly McpToolDefinition[];

  constructor(fields: McpOrigin) {
    Object.assign(this, fields);
  }
}

/** What an mcp origin is told apart by: its address and path, never its name. */
const originKeyOf = ({ address, path }: { readonly address: string; readonly path?: string | undefined }): string =>
  // Joined by a character neither side can hold: a path is one line, and an
  // address is an endpoint or a command line.
  `${address}\n${path ?? ""}`;

/** Every mcp origin the charter's mcps reach, each once: what `cw mcp serve` and
 *  `cw mcp auth` read, since neither reads a charter (FR-145). Ordered by
 *  address, then path (SC-007). */
export class McpOrigins {
  static get originKeyOf(): typeof originKeyOf {
    return originKeyOf;
  }

  constructor(readonly origins: readonly McpOrigin[]) {}

  /** What it is among the parts of a build's output: the whole charter's,
   *  every host's. */
  static get outputPart(): OutputPart {
    return OutputPart.ofCharter("mcp-origins", "mcp-origins.json");
  }

  get outputPart(): OutputPart {
    return McpOrigins.outputPart;
  }

  /** What it holds: generated, and the charter's alone. Indented, since it is
   *  committed and read in diffs when a mcp origin moves (SC-038). */
  get text(): string {
    return `${JSON.stringify({ origins: this.origins }, undefined, 2)}\n`;
  }
}
