import { chromium, type Page } from "playwright";
import { InMemorySources } from "../src/module/charter/infra/in-memory/in-memory-sources.adapter.js";
import { InMemoryTokenCounter } from "../src/module/charter/infra/in-memory/in-memory-token-counter.adapter.js";
import { InMemoryAgentCli } from "../src/module/runtime/infra/in-memory/in-memory-agent-cli.adapter.js";
import { InMemoryFileOutput } from "../src/module/shared/infra/in-memory/in-memory-file-output.adapter.js";
import { InMemoryFileReaders } from "../src/module/shared/infra/in-memory/in-memory-file-readers.adapter.js";
import { InMemoryReporter } from "../src/module/shared/infra/in-memory/in-memory-reporter.adapter.js";
import { wrapAppToShowPaths } from "../src/presentation/cli/commands/helper.js";
import { startPortal } from "../src/presentation/portal/portal.server.js";
import { startedPortalOf } from "./answer-of.js";
import { authoringCharterOf, buildingCharterOf, workspaceSettingsLoaderOf } from "./use-cases-of.js";

/** Clear of the default and of the other portal tests, so a portal left running
 *  here answers nothing they ask. */
const PORT = 47420;

/** The page as a browser reads it: the bundle `pnpm build` wrote, served by a
 *  real portal over the charter `held`, opened in headless Chromium at the
 *  address of the run — token and all, since the page is refused without it.
 *
 *  A page is tested the way it is used or not at all: the strings it renders
 *  are the ones the bundle produced, and a click is a click. Everything is
 *  closed again whatever the test did, so a failure leaves no browser behind.
 *
 *  `pnpm test` builds first, so what is opened here is this working tree.
 *
 *  The files are handed over beside the page, so a test that wants to know a
 *  view read the charter again can change what is on disk between two showings
 *  of it.
 *
 *  Version control is held in memory too, and a test about installing hands
 *  over its own to say what each install commit records and to read what the
 *  page asked it to install or remove. */
export async function inTheBrowser(
  held: Record<string, string>,
  read: (page: Page, files: InMemoryFileReaders) => Promise<void>,
  sourceFetcher: InMemorySources = new InMemorySources(),
): Promise<void> {
  const files = new InMemoryFileReaders(held);
  const charterAuthoringApp = authoringCharterOf(files, new InMemoryFileOutput(files), new InMemoryReporter(), {
    sourceFetcher,
  });
  const charterRuntimeApps = buildingCharterOf(
    files,
    new InMemoryFileOutput(files),
    new InMemoryTokenCounter(),
    { claude: new InMemoryAgentCli() },
    new InMemoryReporter(),
  );
  const { address, server } = startedPortalOf(
    await startPortal(
      new URL("../dist/portal/", import.meta.url),
      {
        charterAuthoringApp: wrapAppToShowPaths(charterAuthoringApp, "/repo"),
        charterBuildingApp: wrapAppToShowPaths(charterRuntimeApps, "/repo"),
      },
      workspaceSettingsLoaderOf(files),
      PORT,
    ),
  );
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(address.href);
    await read(page, files);
  } finally {
    await browser.close();
    server.close();
  }
}
