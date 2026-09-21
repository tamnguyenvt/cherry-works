import { DEFAULT_PORT, startPortal } from "../../portal/server.js";
import { EXIT_OK, type Command, type Context, type Options, type Outcome } from "./Command.js";

const OPTIONS = {
  port: {
    type: "number",
    describe: "Which port to serve on, the next free one when it is taken",
    default: DEFAULT_PORT,
  },
} as const;

/**
 * `cw portal`: serve this repository's charter to a browser on this machine
 * (FR-001 – FR-004).
 *
 * A folder that is not a repository, and a repository never set up, are
 * refused before anything is served, saying which and what to run (FR-004).
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

  async run({ charterAuthoringApp }: Context, { port }: Options<typeof OPTIONS>): Promise<Outcome> {
    await charterAuthoringApp.ensureRepoReady();
    const { address } = await startPortal(
      new URL("./", import.meta.resolve("#portal/index.html")),
      charterAuthoringApp,
      port,
    );
    return { code: EXIT_OK, result: `The portal is at ${address}\nPress Ctrl+C to stop it.\n` };
  }
}
