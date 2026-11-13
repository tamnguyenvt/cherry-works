import { UnplaceableCharterOutputItemFault } from "../charter.fault.js";
import { BuiltSensors } from "./built-sensor.js";
import { Catalogue } from "./catalogue.js";
import { CharterMd } from "./charter-md.js";
import type { CharterOutputItem } from "./charter-output-item.js";
import { CompiledPrimitive } from "./compiled-primitive.js";
import { McpOrigins } from "./mcp-origin.js";

/**
 * Where each item of the compiled output lands inside it, and how one item's
 * text names another (CORE-FR-220, CORE-FR-221). The one place the output's
 * layout is known: an item is what it holds, and its path is asked of this.
 *
 * Where the output itself lands is no part of the engine's, so every path
 * into it is written under `cwOutFolderPlaceholder`, and whoever lays or
 * reads the output says where that is.
 */
export class OutputPath {
  /** What every path into the output starts with, in place of the folder it
   *  lands in. */
  readonly cwOutFolderPlaceholder = "$CW_OUT";

  /** The file every agent's entry file sends a reader to (FR-019, FR-051). */
  readonly charterMdFileName = "CHARTER.md";

  /** The mcp origins the last build listed (FR-145). */
  readonly mcpOriginsFileName = "mcp-origins.json";

  /** The sensors the last build compiled (FR-179). */
  readonly sensorsFileName = "sensors.json";

  /** Where this item lands inside the output, by what it is. */
  getPath(charterOutputItem: CharterOutputItem): string {
    if (charterOutputItem instanceof Catalogue) return this.getCatalogueFileName(charterOutputItem.agent?.name);
    if (charterOutputItem instanceof CharterMd) return this.charterMdFileName;
    if (charterOutputItem instanceof McpOrigins) return this.mcpOriginsFileName;
    if (charterOutputItem instanceof BuiltSensors) return this.sensorsFileName;
    if (charterOutputItem instanceof CompiledPrimitive)
      return this.getCompiledPrimitivePath(charterOutputItem.kind, charterOutputItem.id);
    throw new UnplaceableCharterOutputItemFault(
      `No path is known for ${charterOutputItem.constructor.name}.`,
      "Report it: every class of the compiled output has its path in OutputPath.getPath.",
    );
  }

  /** A catalogue's file: the listing every agent shares, `catalogue.json`, or
   *  one agent's own, named by the agent (FR-011). */
  getCatalogueFileName(agentName?: string): string {
    return agentName === undefined ? "catalogue.json" : `catalogue.${agentName}.json`;
  }

  /** Where the compiled primitive of this kind and id lands, every agent's:
   *  `guide/no-any/index.md`. */
  getCompiledPrimitivePath(kind: string, id: string): string {
    return `${kind}/${id}/index.md`;
  }

  /** This item named in another's text, as `getLinkTo` names its path. */
  getLink(charterOutputItem: CharterOutputItem, suffix = ""): string {
    return this.getLinkTo(this.getPath(charterOutputItem), suffix);
  }

  /**
   * The item at `path` named in another's text, where that item is not in
   * hand: `$CW_OUT/` and its path inside the output, then on by `suffix`, a
   * path from the item's own folder, where one is given: `./` or `../` before
   * it read as a link reads it, every character of it a URL's, a file's name
   * beside it otherwise.
   */
  getLinkTo(path: string, suffix = ""): string {
    const itemFolder = path.slice(0, path.lastIndexOf("/") + 1);
    if (/^\.{1,2}\//.test(suffix)) {
      // The folder this names is written as it is named.
      const resolvedUrl = new URL(suffix, `https://charter.invalid/${path}`);
      const encodedFolder = new URL(".", `https://charter.invalid/${path}`).pathname;
      const resolvedPath = resolvedUrl.pathname.startsWith(encodedFolder)
        ? `${itemFolder}${resolvedUrl.pathname.slice(encodedFolder.length)}`
        : resolvedUrl.pathname.slice(1);
      return `${this.cwOutFolderPlaceholder}/${resolvedPath}${resolvedUrl.search}${resolvedUrl.hash}`;
    }
    return `${this.cwOutFolderPlaceholder}/${suffix === "" ? path : `${itemFolder}${suffix}`}`;
  }
}
