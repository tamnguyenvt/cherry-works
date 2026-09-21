/** How one header value is written into the frontmatter. A list becomes
 *  `["a", "b"]`, with every entry in double quotes, because an unquoted glob
 *  such as `*.md` starts with `*`, which YAML reads as an alias. Any other value
 *  is written as it is. */
export function formatFrontmatterValue(value: unknown): string {
  return Array.isArray(value) ? `[${value.map((one) => JSON.stringify(one)).join(", ")}]` : String(value);
}
