import { parse, stringify } from "smol-toml";
import { DomainFault } from "../../../shared/module.js";

/**
 * LIBRARY — TOML, the notation an agent's configuration is kept in. It knows
 * about TOML text and tables and nothing about a charter, which is why the
 * domain asks it rather than importing the parser itself. Values keep their
 * TOML types: dates, and integers as bigint.
 */

/** The table one TOML document holds. A document that does not parse raises
 *  a fault the person corrects. */
export function tomlTableOf(document: string): Readonly<Record<string, unknown>> {
  try {
    return parse(document, { integersAsBigInt: true });
  } catch (cause) {
    throw new DomainFault(`TOML is not readable: ${(cause as Error).message.split("\n")[0]}`, "Correct the TOML syntax and build again.", { internal: false });
  }
}

/** One table written as TOML, its integers and floats kept apart. */
export function tomlTextOf(table: Readonly<Record<string, unknown>>): string {
  try {
    return stringify(table, { numbersAsFloat: true });
  } catch (cause) {
    throw new DomainFault("TOML could not be serialized.", "Check that the configuration contains supported TOML values.", { internal: false, cause });
  }
}

/**
 * What a TOML file holds once the charter's own table is written into it: the
 * file's text as it is where nothing it says changes, and otherwise the two
 * merged. Tables merge field by field at every depth; an entry of an array of
 * tables the file already holds is not added twice; a scalar or a scalar array
 * is the charter's whole. A file that is not TOML is refused, naming where it
 * is.
 */
export function mergedTomlText(currentText: string | undefined, charterText: string, place: string): string {
  let currentTable: Readonly<Record<string, unknown>>;
  try {
    currentTable = tomlTableOf(currentText ?? "");
  } catch (cause) {
    throw new DomainFault(`"${place}" is not readable TOML: ${(cause as Error).message}`, "Correct that file before building; no files have been written.", { internal: false });
  }
  const mergedTable = mergeTomlTables(currentTable, tomlTableOf(charterText));
  return currentText !== undefined && sameTomlValue(currentTable, mergedTable) ? currentText : tomlTextOf(mergedTable);
}

/** TOML tables exclude scalar objects such as dates. */
function isTomlTable(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

/** Structural equality ignores table key order and preserves TOML scalar types. */
function sameTomlValue(first: unknown, second: unknown): boolean {
  if (Object.is(first, second)) return true;
  if (first instanceof Date && second instanceof Date) return first.toISOString() === second.toISOString();
  if (Array.isArray(first) && Array.isArray(second))
    return first.length === second.length && first.every((value, index) => sameTomlValue(value, second[index]));
  if (isTomlTable(first) && isTomlTable(second))
    return Object.keys(first).length === Object.keys(second).length && Object.entries(first).every(([key, value]) => Object.hasOwn(second, key) && sameTomlValue(value, second[key]));
  return false;
}

/** Tables merge recursively. Array-table entries append unless an equal entry already exists;
 * scalar arrays (for example command args) are replaced as one value. */
function mergeTomlTables(current: Readonly<Record<string, unknown>>, desired: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries([...new Set([...Object.keys(current), ...Object.keys(desired)])].map((key) => {
    if (!Object.hasOwn(desired, key)) return [key, current[key]];
    const currentValue = current[key];
    const desiredValue = desired[key];
    if (isTomlTable(currentValue) && isTomlTable(desiredValue)) return [key, mergeTomlTables(currentValue, desiredValue)];
    if (Array.isArray(currentValue) && Array.isArray(desiredValue) && desiredValue.length > 0 && currentValue.every(isTomlTable) && desiredValue.every(isTomlTable)) return [key, [...currentValue, ...desiredValue.filter((desiredEntry) => !currentValue.some((currentEntry) => sameTomlValue(currentEntry, desiredEntry)))]];
    return [key, desiredValue];
  }));
}
