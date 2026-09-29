import { McpConnecting } from "../src/hexagon/application/McpConnecting.js";
import { InMemoryAuthorizing } from "../src/zdriven/InMemoryAuthorizing.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryMcpServers } from "../src/zdriven/InMemoryMcpServers.js";
import { InMemorySecrets } from "../src/zdriven/InMemorySecrets.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";

/** What the places are reached through where a test asks nothing of them: a
 *  context always carries every use case, and this one lists no place. */
export const noPlacesReached = new McpConnecting(
  new URL("file:///repo/"),
  new InMemoryFileReaders({}),
  new InMemorySecrets(),
  new InMemoryAuthorizing(),
  new YamlParser(),
  new InMemoryMcpServers(),
);
