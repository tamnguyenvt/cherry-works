import { parse, stringify } from "smol-toml";
import { UnreadableTomlFault, UnwritableTomlFault } from "../models/domain.fault.js";

/**
 * LIBRARY — TOML, the notation an agent's configuration is kept in. It knows
 * about TOML text and tables and nothing about a charter or a module, which is why the
 * domain asks it rather than importing the parser itself. Values keep their
 * TOML types: dates, and integers as bigint.
 */
export class TomlLib {
  /** The table one TOML document holds. A document that does not parse raises
   *  a fault the person corrects. */
  static parseTomlTable(tomlText: string): Readonly<Record<string, unknown>> {
    try {
      return parse(tomlText, { integersAsBigInt: true });
    } catch (cause) {
      throw new UnreadableTomlFault(
        `TOML is not readable: ${(cause as Error).message.split("\n")[0]}`,
        "Correct the TOML syntax and build again.",
        { internal: false },
      );
    }
  }

  /** One table written as TOML, its integers and floats kept apart. */
  static writeTomlText(table: Readonly<Record<string, unknown>>): string {
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
   * is the charter's whole, and so is every entry the charter gives of a table
   * `replacedEntryTablePaths` names by its dotted path, the file's own entries
   * under the same keys dropped. A file that is not TOML is refused, naming
   * where it is.
   */
  static mergeTomlText(
    currentText: string | undefined,
    charterText: string,
    filePath: string,
    replacedEntryTablePaths: readonly string[] = [],
  ): string {
    let currentTable: Readonly<Record<string, unknown>>;
    try {
      currentTable = parse(currentText ?? "", { integersAsBigInt: true });
    } catch (cause) {
      throw new UnreadableTomlFault(
        `"${filePath}" is not readable TOML: ${(cause as Error).message.split("\n")[0]}`,
        "Correct that file before building; no files have been written.",
        { internal: false, cause },
      );
    }
    const mergedTable = TomlLib.#mergeTomlTables(
      currentTable,
      TomlLib.parseTomlTable(charterText),
      "",
      replacedEntryTablePaths,
    );
    return currentText !== undefined && TomlLib.#isSameTomlValue(currentTable, mergedTable)
      ? currentText
      : TomlLib.writeTomlText(mergedTable);
  }

  /** TOML tables exclude scalar objects such as dates. */
  static #isTomlTable(tomlValue: unknown): tomlValue is Record<string, unknown> {
    return (
      typeof tomlValue === "object" &&
      tomlValue !== null &&
      (Object.getPrototypeOf(tomlValue) === Object.prototype || Object.getPrototypeOf(tomlValue) === null)
    );
  }

  /** Structural equality ignores table key order and preserves TOML scalar types. */
  static #isSameTomlValue(leftValue: unknown, rightValue: unknown): boolean {
    if (Object.is(leftValue, rightValue)) return true;
    if (leftValue instanceof Date && rightValue instanceof Date)
      return leftValue.toISOString() === rightValue.toISOString();
    if (Array.isArray(leftValue) && Array.isArray(rightValue))
      return (
        leftValue.length === rightValue.length &&
        leftValue.every((leftEntry, entryIndex) => TomlLib.#isSameTomlValue(leftEntry, rightValue[entryIndex]))
      );
    if (TomlLib.#isTomlTable(leftValue) && TomlLib.#isTomlTable(rightValue))
      return (
        Object.keys(leftValue).length === Object.keys(rightValue).length &&
        Object.entries(leftValue).every(
          ([tableKey, tableValue]) =>
            Object.hasOwn(rightValue, tableKey) && TomlLib.#isSameTomlValue(tableValue, rightValue[tableKey]),
        )
      );
    return false;
  }

  /** Tables merge recursively. Array-table entries append unless an equal entry already exists;
   * scalar arrays (for example command args) are replaced as one value, and so is every entry
   * of a table at a path `replacedEntryTablePaths` names. */
  static #mergeTomlTables(
    currentTable: Readonly<Record<string, unknown>>,
    desiredTable: Readonly<Record<string, unknown>>,
    tablePath: string,
    replacedEntryTablePaths: readonly string[],
  ): Record<string, unknown> {
    return Object.fromEntries(
      [...new Set([...Object.keys(currentTable), ...Object.keys(desiredTable)])].map((tableKey) => {
        if (!Object.hasOwn(desiredTable, tableKey)) return [tableKey, currentTable[tableKey]];
        const currentValue = currentTable[tableKey];
        const desiredValue = desiredTable[tableKey];
        if (replacedEntryTablePaths.includes(tablePath)) return [tableKey, desiredValue];
        if (TomlLib.#isTomlTable(currentValue) && TomlLib.#isTomlTable(desiredValue))
          return [
            tableKey,
            TomlLib.#mergeTomlTables(
              currentValue,
              desiredValue,
              tablePath === "" ? tableKey : `${tablePath}.${tableKey}`,
              replacedEntryTablePaths,
            ),
          ];
        if (
          Array.isArray(currentValue) &&
          Array.isArray(desiredValue) &&
          desiredValue.length > 0 &&
          currentValue.every((tomlValue) => TomlLib.#isTomlTable(tomlValue)) &&
          desiredValue.every((tomlValue) => TomlLib.#isTomlTable(tomlValue))
        )
          return [
            tableKey,
            [
              ...currentValue,
              ...desiredValue.filter(
                (desiredEntry) =>
                  !currentValue.some((currentEntry) => TomlLib.#isSameTomlValue(currentEntry, desiredEntry)),
              ),
            ],
          ];
        return [tableKey, desiredValue];
      }),
    );
  }

  private constructor() {}
}
