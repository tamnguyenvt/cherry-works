export { AdapterFault } from "./AdapterFault.js";

/** TOML notation at the adapter boundary. Values retain TOML types such as
 * dates and bigint integers; the hexagon never imports a parser library. */
export interface ForParsingToml {
  parse(document: string): Readonly<Record<string, unknown>>;
  stringify(table: Readonly<Record<string, unknown>>): string;
}
