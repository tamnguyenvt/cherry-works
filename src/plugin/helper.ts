/**
 * A host's settings, JSON the charter shares with the repository, with the
 * fields this charter speaks for put over the top of what is there now
 * (FR-018): every other one is the repository's and comes through untouched.
 * Field by field at every depth, so an entry of the repository's beside the
 * charter's under one key — a server of its own under `mcpServers` — stays
 * (FR-146); a list or a value is the charter's whole, so what it no longer
 * asks for goes.
 */
export function mergedSettingsText(currentText: string | undefined, charterText: string): string {
  const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
  const mergedJSON = (heldValue: unknown, charterValue: unknown): unknown =>
    isPlainObject(heldValue) && isPlainObject(charterValue)
      ? Object.fromEntries(
          [...new Set([...Object.keys(heldValue), ...Object.keys(charterValue)])].map((field) => [
            field,
            field in charterValue ? mergedJSON(heldValue[field], charterValue[field]) : heldValue[field],
          ]),
        )
      : charterValue;
  return `${JSON.stringify(mergedJSON(JSON.parse(currentText?.trim() || "{}"), JSON.parse(charterText)), undefined, 2)}\n`;
}

/**
 * A host's entry file, the repository's, with the charter's section written
 * in place between its first line and its last, or put at the end (FR-051).
 * A section says where it starts and ends itself, so nothing here knows what
 * a marker of the engine's looks like.
 */
export function mergedEntryFileText(currentText: string | undefined, sectionText: string): string {
  const heldText = currentText ?? "";
  const sectionLines = sectionText.trimEnd().split("\n");
  // Escaped, because a marker is a comment and a comment holds characters
  // a regular expression reads as its own.
  const [startPattern, endPattern] = [sectionLines.at(0) ?? "", sectionLines.at(-1) ?? ""].map((line) => line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const sectionPattern = new RegExp(`${startPattern}[\\s\\S]*?${endPattern}\\n?`, "g");

  // Nothing of this build's is in that file yet: the section goes after
  // whatever is there, and an empty file is the section alone.
  if (heldText.match(sectionPattern) === null) return heldText === "" ? sectionText : `${heldText.replace(/\n*$/, "\n")}\n${sectionText}`;

  // A file carrying the marker more than once — a merge conflict resolved
  // by keeping both sides — comes back with one, so a second build over it
  // changes nothing (SC-007).
  let isSectionWritten = false;
  return heldText.replace(sectionPattern, () => {
    if (isSectionWritten) return "";
    isSectionWritten = true;
    return sectionText;
  });
}
