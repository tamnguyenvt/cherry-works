import { DEFAULT_PORT, startPortal } from "../../portal/portal.server.js";
import { type Command, type Context, EXIT_FAILURE, EXIT_OK, type Options, type Outcome } from "./command.interface.js";

const OPTIONS = {
  port: {
    type: "number",
    describe: "Which port to serve on, the next free one when it is taken",
    default: DEFAULT_PORT,
  },
} as const;

/**
 * `cw portal`: serve this repository's charter to a browser on this machine
 * (CORE-FR-104 – CORE-FR-106).
 *
 * A repository never set up is refused before anything is served, saying what
 * to run; version control is not asked of it (CORE-FR-107).
 *
 * What it answers with is the address, token and all (plan §6). The run goes
 * on after that because the server does, until the process is interrupted:
 * nothing here waits, since an open server is what keeps the process alive.
 *
 * The page is the one `pnpm build` wrote into `dist/portal/`, found through the
 * package's `#portal/*` import, so it is the same folder whether this runs from
 * `dist/` or from source under `tsx` (plan §8).
 */
export class PortalCommand implements Command<typeof OPTIONS> {
  readonly name = "portal";
  readonly summary = "Serve this repository's charter to a browser on this machine";
  readonly options = OPTIONS;

  async runCommand(
    { charterAuthoringApp, charterBuildingApp, workspaceApp }: Context,
    { port }: Options<typeof OPTIONS>,
  ): Promise<Outcome> {
    // Setup writes the settings whatever it was answered: their absence is
    // what a repository never set up looks like (FR-037, CORE-FR-107).
    const workspaceSettingsDTO = await workspaceApp.readWorkspaceSettings();
    if (workspaceSettingsDTO.type === "Fault" || !workspaceSettingsDTO.data.isSetUp)
      return {
        exitCode: EXIT_FAILURE,
        problemText: 'This repository was never set up under a charter.\n  Run "cw init" first.\n',
      };
    const startedPortal = await startPortal(
      new URL("./", import.meta.resolve("#portal/index.html")),
      { charterAuthoringApp, charterBuildingApp },
      () => workspaceApp.readWorkspaceSettings(),
      port,
    );
    if (typeof startedPortal === "string") return { exitCode: EXIT_FAILURE, problemText: startedPortal };
    return { exitCode: EXIT_OK, resultText: `The portal is at ${startedPortal.address}\nPress Ctrl+C to stop it.\n` };
  }
}
