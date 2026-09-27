/** How one header value is written into the frontmatter. A list becomes
 *  `["a", "b"]`, with every entry in double quotes, because an unquoted glob
 *  such as `*.md` starts with `*`, which YAML reads as an alias. A line YAML
 *  would read as something other than that text — a list, a mapping, a comment,
 *  a quoted string, a boolean or a number — is written in double quotes too, so
 *  a sensor's `[ -z … ] || …` reads back as the command it is. Any other value
 *  is written as it is. */
export function formatFrontmatterValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((one) => JSON.stringify(one)).join(", ")}]`;
  const line = String(value);
  return YAML_READS_OTHERWISE.test(line) ? JSON.stringify(line) : line;
}

/** A line that, written unquoted after `header: `, YAML reads as something
 *  other than the line: one starting with an indicator, one holding `: ` or
 *  ` #`, one with space at either end, and one that is a boolean, a null or a
 *  number. */
const YAML_READS_OTHERWISE =
  /^[-?:,[\]{}#&*!|>'"%@`]|: | #|:$|^\s|\s$|^$|^(true|false|yes|no|on|off|null|~)$|^[-+]?(\d[\d_]*)?\.?\d+([eE][-+]?\d+)?$/i;
