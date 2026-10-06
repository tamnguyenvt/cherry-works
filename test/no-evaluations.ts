import { CharterEvaluating } from "../src/hexagon/application/CharterEvaluating.js";
import { InMemoryAgentCli } from "../src/zdriven/InMemoryAgentCli.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
import { InMemoryPromptfoo } from "../src/zdriven/InMemoryPromptfoo.js";
import { InMemoryReporter } from "../src/zdriven/InMemoryReporter.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";

const noFiles = new InMemoryFileReaders({});

/** What the charter is evaluated through where a test asks nothing of it: a
 *  context always carries every use case, and this one holds no case. */
export const noEvaluationsRun = new CharterEvaluating(
  new URL("file:///repo/"),
  noFiles,
  new YamlParser(),
  new InMemoryFileOutput(noFiles),
  new InMemoryVCS(),
  { claude: new InMemoryAgentCli() },
  new InMemoryPromptfoo(),
  new InMemoryReporter(),
);
