import { chromium, type Page } from "playwright";
import { startPortal } from "../src/driver/portal/server.js";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { CharterVendoring } from "../src/hexagon/application/CharterVendoring.js";
import { TestAuthoring } from "../src/hexagon/application/TestAuthoring.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";
import { InMemoryTokenCounter } from "../src/zdriven/InMemoryTokenCounter.js";
import { InMemoryAgentCli } from "../src/zdriven/InMemoryAgentCli.js";

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
 *  Version control is held in memory too, and a test about vendoring hands
 *  over its own to say what each install commit records and to read what the
 *  page asked it to install or remove. */
export async function inTheBrowser(
  held: Record<string, string>,
  read: (page: Page, files: InMemoryFileReaders) => Promise<void>,
  vcs: InMemoryVCS = new InMemoryVCS(),
): Promise<void> {
  const files = new InMemoryFileReaders(held);
  const repoPath = new URL("file:///repo/");
  const engine = new CharterAuthoring(repoPath, files, new YamlParser(), new InMemoryFileOutput(files), vcs, new InMemoryTokenCounter(), { claude: new InMemoryAgentCli() });
  const charterVendoringApp = new CharterVendoring(repoPath, files, vcs);
  const testAuthoringApp = new TestAuthoring(repoPath, files, new InMemoryFileOutput(files));
  const { address, server } = await startPortal(
    new URL("../dist/portal/", import.meta.url),
    engine,
    charterVendoringApp,
    testAuthoringApp,
    PORT,
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
