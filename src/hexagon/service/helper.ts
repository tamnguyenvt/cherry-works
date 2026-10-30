/** TOML tables exclude scalar objects such as dates. */
export function isTomlTable(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

/** Structural equality ignores table key order and preserves TOML scalar types. */
export function sameTomlValue(first: unknown, second: unknown): boolean {
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
export function mergeTomlTables(current: Readonly<Record<string, unknown>>, desired: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries([...new Set([...Object.keys(current), ...Object.keys(desired)])].map((key) => {
    if (!Object.hasOwn(desired, key)) return [key, current[key]];
    const held = current[key];
    const written = desired[key];
    if (isTomlTable(held) && isTomlTable(written)) return [key, mergeTomlTables(held, written)];
    if (Array.isArray(held) && Array.isArray(written) && written.length > 0 && held.every(isTomlTable) && written.every(isTomlTable)) return [key, [...held, ...written.filter((entry) => !held.some((currentEntry) => sameTomlValue(currentEntry, entry)))]];
    return [key, written];
  }));
}
