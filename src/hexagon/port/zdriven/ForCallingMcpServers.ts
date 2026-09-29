import { DrivenFault } from "./DrivenFault.js";

/** What an adapter answering this port raises when a place cannot be reached
 *  or started, named again here so it names this port and nothing behind it. */
export { DrivenFault };

/** What an adapter raises when a place refuses the credential a call was made
 *  with (`401`): the one refusal the caller can do something about, by renewing
 *  and asking again (FR-151). */
export class UnauthorizedMcpFault extends DrivenFault {}

/** Where one place is, as the list of places holds it: reached at an endpoint,
 *  or started as a local command reading its token from `tokenEnv`. */
export interface McpServerAddress {
  readonly address: string;
  readonly endpoint?: string;
  readonly command?: { readonly command: string; readonly args: readonly string[]; readonly tokenEnv?: string };
}

/** One tool as its place lists it, by the place's own name, its input schema as
 *  it came. */
export interface UpstreamTool {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
}

/** What a place answered a call with, as it came: content, `isError` and all.
 *  Not read by the hexagon: the server decides what may be called, not what an
 *  answer means (FR-154). */
export type ToolAnswer = Readonly<Record<string, unknown>>;

/** One place reached: what it listed when it was reached, and calls to it. */
export interface McpServerConnection {
  readonly tools: readonly UpstreamTool[];

  /**
   * Call one of the place's tools by its own name. `accessToken` is sent with
   * this call to a place at an endpoint; a local command was handed its token
   * when it started, and ignores it.
   *
   * Raises `UnauthorizedMcpFault` where the place refuses the credential, and a
   * `DrivenFault` where the call fails on the way.
   */
  callTool(name: string, args: Readonly<Record<string, unknown>>, accessToken: string | undefined): Promise<ToolAnswer>;

  /** Let go of the place: a local command it started is stopped. */
  close(): Promise<void>;
}

/**
 * DRIVEN PORT — the MCP servers a charter's places are (FR-152 – FR-154).
 *
 * The protocol, its transports and the processes a local command runs in are
 * the adapter's business; the hexagon hands it where a place is and the
 * developer's token, and gets back what the place lists and answers.
 */
export interface ForCallingMcpServers {
  /**
   * Reach one place, and ask it what tools it has, within `timeoutMs`. A local
   * command is started, `accessToken` in the variable its `tokenEnv` names and
   * in no other way.
   *
   * Raises a `DrivenFault` naming the address where the place cannot be
   * reached or started, or does not answer in time.
   */
  connect(mcpServerAddress: McpServerAddress, accessToken: string | undefined, timeoutMs: number): Promise<McpServerConnection>;
}
