import { parse, stringify } from "smol-toml";
import { UnreadableTomlFault, UnwritableTomlFault } from "../models/charter.fault.js";

/**
 * LIBRARY — TOML, the notation an agent's configuration is kept in. It knows
 * about TOML text and tables and nothing about a charter, which is why the
 * domain asks it rather than importing the parser itself. Values keep their
 * TOML types: dates, and integers as bigint.
 */

/** The table one TOML document holds. A document that does not parse raises
 *  a fault the person corrects. */
export function parseTomlTable(document: string): Readonly<Record<string, unknown>> {
  try {
    return parse(document, { integersAsBigInt: true });
  } catch (cause) {
    throw new UnreadableTomlFault(
      `TOML is not readable: ${(cause as Error).message.split("\n")[0]}`,
      "Correct the TOML syntax and build again.",
      { internal: false },
    );
  }
}

/** One table written as TOML, its integers and floats kept apart. */
export function writeTomlText(table: Readonly<Record<string, unknown>>): string {
  try {
    return stringify(table, { numbersAsFloat: true });
  } catch (cause) {
    throw new UnwritableTomlFault(
      "TOML could not be serialized.",
      "Check that the configuration contains supported TOML values.",
      { internal: false, cause },
    );
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
export function mergeTomlText(currentText: string | undefined, charterText: string, place: string): string {
  let currentTable: Readonly<Record<string, unknown>>;
  try {
    currentTable = parseTomlTable(currentText ?? "");
  } catch (cause) {
    throw new UnreadableTomlFault(
      `"${place}" is not readable TOML: ${(cause as Error).message}`,
      "Correct that file before building; no files have been written.",
      { internal: false },
    );
  }
  const mergedTable = mergeTomlTables(currentTable, parseTomlTable(charterText));
  return currentText !== undefined && isSameTomlValue(currentTable, mergedTable)
    ? currentText
    : writeTomlText(mergedTable);
}

/** TOML tables exclude scalar objects such as dates. */
function isTomlTable(tomlValue: unknown): tomlValue is Record<string, unknown> {
  return (
    typeof tomlValue === "object" &&
    tomlValue !== null &&
    (Object.getPrototypeOf(tomlValue) === Object.prototype || Object.getPrototypeOf(tomlValue) === null)
  );
}

/** Structural equality ignores table key order and preserves TOML scalar types. */
function isSameTomlValue(leftValue: unknown, rightValue: unknown): boolean {
  if (Object.is(leftValue, rightValue)) return true;
  if (leftValue instanceof Date && rightValue instanceof Date)
    return leftValue.toISOString() === rightValue.toISOString();
  if (Array.isArray(leftValue) && Array.isArray(rightValue))
    return (
      leftValue.length === rightValue.length &&
      leftValue.every((leftEntry, entryIndex) => isSameTomlValue(leftEntry, rightValue[entryIndex]))
    );
  if (isTomlTable(leftValue) && isTomlTable(rightValue))
    return (
      Object.keys(leftValue).length === Object.keys(rightValue).length &&
      Object.entries(leftValue).every(
        ([tableKey, tableValue]) =>
          Object.hasOwn(rightValue, tableKey) && isSameTomlValue(tableValue, rightValue[tableKey]),
      )
    );
  return false;
}

/** Tables merge recursively. Array-table entries append unless an equal entry already exists;
 * scalar arrays (for example command args) are replaced as one value. */
function mergeTomlTables(
  current: Readonly<Record<string, unknown>>,
  desired: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return Object.fromEntries(
    [...new Set([...Object.keys(current), ...Object.keys(desired)])].map((tableKey) => {
      if (!Object.hasOwn(desired, tableKey)) return [tableKey, current[tableKey]];
      const currentValue = current[tableKey];
      const desiredValue = desired[tableKey];
      if (isTomlTable(currentValue) && isTomlTable(desiredValue))
        return [tableKey, mergeTomlTables(currentValue, desiredValue)];
      if (
        Array.isArray(currentValue) &&
        Array.isArray(desiredValue) &&
        desiredValue.length > 0 &&
        currentValue.every(isTomlTable) &&
        desiredValue.every(isTomlTable)
      )
        return [
          tableKey,
          [
            ...currentValue,
            ...desiredValue.filter(
              (desiredEntry) => !currentValue.some((currentEntry) => isSameTomlValue(currentEntry, desiredEntry)),
            ),
          ],
        ];
      return [tableKey, desiredValue];
    }),
  );
}
