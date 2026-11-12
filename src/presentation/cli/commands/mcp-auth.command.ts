import prompts from "prompts";
import type { CharterDTOs } from "#module/charter/module.js";
import type { FaultDTOs } from "#module/shared/module.js";
import {
  type Command,
  type Context,
  EXIT_FAILURE,
  EXIT_OK,
  type OptionSpec,
  type Options,
  type Outcome,
} from "./command.interface.js";
import { printFault } from "./helper.js";

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

  async runCommand({ charterAuthoringApp }: Context, { id, status }: Options<typeof OPTIONS>): Promise<Outcome> {
    const signInStatusesDTO = await charterAuthoringApp.listSignInStatuses();
    if (signInStatusesDTO.type === "Fault")
      return { exitCode: EXIT_FAILURE, problemText: printFault(signInStatusesDTO) };
    const signInStatuses = signInStatusesDTO.data.signInStatuses.map((signInStatusDTO) => signInStatusDTO.data);

    if (status)
      return {
        exitCode: EXIT_OK,
        resultText:
          signInStatuses.length === 0
            ? "No mcp in the charter takes a sign-in.\n"
            : signInStatuses
                .map(({ address, ids, signedIn: isSignedIn, method }) =>
                  [
                    address,
                    `  ${ids.join(", ")}`,
                    `  ${isSignedIn ? `signed in by ${method}` : "not signed in"}`,
                    "",
                  ].join("\n"),
                )
                .join(""),
      };

    let unsignedStatuses: readonly CharterDTOs.SignInStatus["data"][];
    if (id === undefined) unsignedStatuses = signInStatuses.filter((signInStatus) => !signInStatus.signedIn);
    else {
      const signInStatus = signInStatuses.find((signInStatus) => signInStatus.ids.includes(id));
      if (signInStatus === undefined)
        return {
          exitCode: EXIT_FAILURE,
          problemText: `No mcp in the charter that takes a sign-in is ${id}.\n  Run "cw mcp auth --status" to see every mcp that does.\n`,
        };
      unsignedStatuses = [signInStatus];
    }

    if (unsignedStatuses.length === 0)
      return {
        exitCode: EXIT_OK,
        resultText:
          signInStatuses.length === 0
            ? "No mcp in the charter takes a sign-in.\n"
            : `You are signed in at every address: ${signInStatuses.length}.\n`,
      };

    if (!process.stdin.isTTY)
      return {
        exitCode: EXIT_FAILURE,
        problemText: [
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
              choices: auth.map((signInMethod) => ({
                title: signInMethod === "oauth" ? "in the browser (OAuth)" : "with a token",
                value: signInMethod,
              })),
            })
          : { method: auth[0] };
      let signInStatusDTO: CharterDTOs.SignInStatus | FaultDTOs.Fault;
      if (method === "oauth")
        signInStatusDTO = await charterAuthoringApp.signInWithOAuth(address, (authorizationUrl) =>
          process.stderr.write(`  Open this address to sign in, then come back here:\n  ${authorizationUrl}\n`),
        );
      else if (method === "token") {
        const { token } = await prompts({ type: "invisible", name: "token", message: "Token?" });
        if (token === undefined) return { exitCode: EXIT_FAILURE, problemText: printInterruptProblem(address) };
        signInStatusDTO = await charterAuthoringApp.signInWithToken(address, token);
      } else return { exitCode: EXIT_FAILURE, problemText: printInterruptProblem(address) };
      if (signInStatusDTO.type === "Fault") return { exitCode: EXIT_FAILURE, problemText: printFault(signInStatusDTO) };
    }

    return {
      exitCode: EXIT_OK,
      resultText: `Signed in at ${unsignedStatuses.map(({ address }) => address).join(", ")}.\n`,
    };
  }
}

/** A prompt left unanswered, written out for the terminal: what was signed in
 *  before it is kept. */
function printInterruptProblem(address: string): string {
  return `This was stopped before signing in at ${address}; what was signed in before it is kept.\n  Run "cw mcp auth" again.\n`;
}
