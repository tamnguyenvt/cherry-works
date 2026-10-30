import { parse, stringify } from "smol-toml";
import { AdapterFault, type ForParsingToml } from "#hexagon/port/zdriven/ForParsingToml.js";

/** Preserve integer/float and local date/time types across parse/stringify. */
export class TomlParser implements ForParsingToml {
  parse(document: string): Readonly<Record<string, unknown>> {
    try {
      return parse(document, { integersAsBigInt: true });
    } catch (cause) {
      throw new AdapterFault(`TOML is not readable: ${(cause as Error).message.split("\n")[0]}`, "Correct the TOML syntax and build again.");
    }
  }

  stringify(table: Readonly<Record<string, unknown>>): string {
    try {
      return stringify(table, { numbersAsFloat: true });
    } catch (cause) {
      throw new AdapterFault(`TOML could not be serialized: ${(cause as Error).message.split("\n")[0]}`, "Check that the configuration contains supported TOML values.");
    }
  }
}
