import prompts from "prompts";
import { DomainFault } from "#hexagon/port/driver/ForManagingCharter.js";
import type { DataDTOs } from "#hexagon/port/driver/dtos/index.js";
import { EXIT_FAILURE, EXIT_OK, type Command, type Context, type OptionSpec, type Options, type Outcome } from "./Command.js";

/** What `cw mcp auth` takes: one id to sign in again for, or whether to
 *  say where the developer is signed in and do nothing else (FR-150). */
const OPTIONS = {
  id: {
    type: "string",
    describe: 'One mcp whose address to sign in to again, whatever you were signed in as: "github/billing"',
  },
  status: {
    type: "boolean",
    default: false,
    describe: "List each address, the mcps at it and whether you are signed in there, and change nothing",
  },
} as const satisfies OptionSpec;

/**
 * `cw mcp auth`: the developer signs in, as themselves, to every address the
 * charter holds that they have not signed in to yet (FR-148 – FR-150).
 *
 * The asking happens here, as it does in `cw add`: which way to sign in where
 * an address allows two, and a token at a prompt that does not show it. The
 * answers go to the use cases as they were given. Without a terminal nothing is
 * asked — which is also what keeps a token out of an agent's conversation when
 * an agent runs this — and the addresses still to sign in to are named.
 *
 * The address to open for an OAuth sign-in is printed on standard error while
 * the command waits, and never opened (plan §15). No token is printed.
 */
export class McpAuthCommand implements Command<typeof OPTIONS> {
  readonly name = "mcp auth [id]";
  readonly summary = "Sign in, as yourself, to every mcp origin the charter reaches";
  readonly options = OPTIONS;

  async run({ mcpConnectingApp }: Context, { id, status }: Options<typeof OPTIONS>): Promise<Outcome> {
    const signInStatuses = (await mcpConnectingApp.signInStatus()).map((one) => one.data);

    if (status)
      return {
        code: EXIT_OK,
        result:
          signInStatuses.length === 0
            ? "No mcp in the charter takes a sign-in.\n"
            : signInStatuses
                .map(({ address, ids, signedIn, method }) =>
                  [address, `  ${ids.join(", ")}`, `  ${signedIn ? `signed in by ${method}` : "not signed in"}`, ""].join("\n"),
                )
                .join(""),
      };

    let unsignedStatuses: readonly DataDTOs.SignInStatus["data"][];
    if (id === undefined) unsignedStatuses = signInStatuses.filter((one) => !one.signedIn);
    else {
      const signInStatus = signInStatuses.find((one) => one.ids.includes(id));
      if (signInStatus === undefined)
        throw new DomainFault(
          `No mcp in the charter that takes a sign-in is ${id}.`,
          'Run "cw mcp auth --status" to see every mcp that does.',
        );
      unsignedStatuses = [signInStatus];
    }

    if (unsignedStatuses.length === 0)
      return {
        code: EXIT_OK,
        result:
          signInStatuses.length === 0
            ? "No mcp in the charter takes a sign-in.\n"
            : `You are signed in at every address: ${signInStatuses.length}.\n`,
      };

    if (!process.stdin.isTTY)
      return {
        code: EXIT_FAILURE,
        problem: [
          "Not signed in at:",
          ...unsignedStatuses.map(({ address }) => `  ${address}`),
          '  Run "cw mcp auth" at a terminal to sign in; nothing is asked without one.',
          "",
        ].join("\n"),
      };

    for (const { address, ids, auth } of unsignedStatuses) {
      process.stderr.write(`${address}\n  ${ids.join(", ")}\n`);
      const { method } =
        auth.length > 1
          ? await prompts({
              type: "select",
              name: "method",
              message: "Sign in how?",
              choices: auth.map((one) => ({ title: one === "oauth" ? "in the browser (OAuth)" : "with a token", value: one })),
            })
          : { method: auth[0] };
      if (method === "oauth")
        await mcpConnectingApp.signInWithOAuth(address, (authorizationUrl) =>
          process.stderr.write(`  Open this address to sign in, then come back here:\n  ${authorizationUrl}\n`),
        );
      else if (method === "token") {
        const { token } = await prompts({ type: "invisible", name: "token", message: "Token?" });
        if (token === undefined) throwInterruptFault(address);
        await mcpConnectingApp.signInWithToken(address, token);
      } else throwInterruptFault(address);
    }

    return {
      code: EXIT_OK,
      result: `Signed in at ${unsignedStatuses.map(({ address }) => address).join(", ")}.\n`,
    };
  }
}

/** A prompt left unanswered: what was signed in before it is kept. */
function throwInterruptFault(address: string): never {
  throw new DomainFault(`This was stopped before signing in at ${address}; what was signed in before it is kept.`, 'Run "cw mcp auth" again.');
}
