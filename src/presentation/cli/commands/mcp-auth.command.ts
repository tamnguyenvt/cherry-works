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
import {
  formatHeading,
  formatMention,
  formatStatusLine,
  refuseCommand,
  reportFault,
  writeLaidOutText,
} from "./helper.js";

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

  async runCommand(
    { charterAuthoringApp, isAtTerminal }: Context,
    { id, status: isStatusOnly }: Options<typeof OPTIONS>,
  ): Promise<Outcome> {
    const signInStatusesDTO = await charterAuthoringApp.listSignInStatuses();
    if (signInStatusesDTO.type === "Fault") return reportFault(signInStatusesDTO);
    const signInStatuses = signInStatusesDTO.data.signInStatuses.map((signInStatusDTO) => signInStatusDTO.data);

    if (isStatusOnly)
      return {
        exitCode: EXIT_OK,
        resultText:
          signInStatuses.length === 0
            ? "No mcp in the charter takes a sign-in.\n"
            : signInStatuses
                .map(({ address, ids, signedIn: isSignedIn, method }) =>
                  [
                    formatHeading(formatMention(address)),
                    `  ${ids.map(formatMention).join(", ")}`,
                    `  ${isSignedIn ? formatStatusLine("good", `signed in by ${method}`) : formatStatusLine("todo", "not signed in")}`,
                    "",
                  ].join("\n"),
                )
                .join(""),
        answerDTO: signInStatusesDTO,
      };

    let unsignedStatuses: readonly CharterDTOs.SignInStatus["data"][];
    if (id === undefined) unsignedStatuses = signInStatuses.filter((signInStatus) => !signInStatus.signedIn);
    else {
      const signInStatus = signInStatuses.find((signInStatus) => signInStatus.ids.includes(id));
      if (signInStatus === undefined)
        return reportFault(
          refuseCommand(
            "UnknownMcpFault",
            `No mcp in the charter that takes a sign-in is ${id}.`,
            `Run "cw mcp auth --status" to see every mcp that does.`,
          ),
        );
      unsignedStatuses = [signInStatus];
    }

    if (unsignedStatuses.length === 0)
      return {
        exitCode: EXIT_OK,
        resultText:
          signInStatuses.length === 0
            ? "No mcp in the charter takes a sign-in.\n"
            : `You are signed in at every address: ${signInStatuses.length}.\n`,
        answerDTO: signInStatusesDTO,
      };

    if (!isAtTerminal)
      return {
        exitCode: EXIT_FAILURE,
        problemText: [
          formatStatusLine("fault", "Not signed in at:"),
          ...unsignedStatuses.map(({ address }) => `  ${formatMention(address)}`),
          '  Run "cw mcp auth" at a terminal to sign in; nothing is asked without one.',
          "",
        ].join("\n"),
        answerDTO: refuseCommand(
          "NoTerminalFault",
          `Not signed in at: ${unsignedStatuses.map(({ address }) => address).join(", ")}.`,
          'Run "cw mcp auth" at a terminal to sign in; nothing is asked without one.',
        ),
      };

    for (const { address, ids, auth } of unsignedStatuses) {
      writeLaidOutText(
        process.stderr,
        `${formatHeading(formatMention(address))}\n  ${ids.map(formatMention).join(", ")}\n`,
      );
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
      let signInStatusDTO: CharterDTOs.SignInStatus | FaultDTOs.Fault | undefined;
      if (method === "oauth")
        signInStatusDTO = await charterAuthoringApp.signInWithOAuth(address, (authorizationUrl) =>
          writeLaidOutText(
            process.stderr,
            `  Open this address to sign in, then come back here:\n  ${formatMention(authorizationUrl)}\n`,
          ),
        );
      else if (method === "token") {
        const { token } = await prompts({ type: "invisible", name: "token", message: "Token?" });
        if (token !== undefined) signInStatusDTO = await charterAuthoringApp.signInWithToken(address, token);
      }
      // A prompt left unanswered: what was signed in before it is kept.
      if (signInStatusDTO === undefined)
        return reportFault(
          refuseCommand(
            "StoppedPromptFault",
            `This was stopped before signing in at ${address}; what was signed in before it is kept.`,
            'Run "cw mcp auth" again.',
          ),
        );
      if (signInStatusDTO.type === "Fault") return reportFault(signInStatusDTO);
    }

    return {
      exitCode: EXIT_OK,
      resultText: `${formatStatusLine("good", `Signed in at ${unsignedStatuses.map(({ address }) => formatMention(address)).join(", ")}.`)}\n`,
    };
  }
}
