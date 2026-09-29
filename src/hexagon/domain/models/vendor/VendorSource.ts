import { VendorFault } from "../DomainFault.js";

/** A charter this repository installs rather than authors: the source as it
 *  was typed, handed to version control as it is, and the name of the folder
 *  it lands in under the vendor folder (FR-049, FR-050). */
export class VendorSource {
  constructor(
    readonly source: string,
    readonly name: string,
  ) {}
}

/**
 * The vendor source a source names: the last thing the address names, without
 * a trailing `.git`, is what it is called here, and the address itself is
 * version control's to read (FR-050).
 *
 * Refused where that is no folder — empty, `.` or `..` — since only a crafted
 * address names one, and the folder would sit on the vendor folder itself or
 * above it (FR-044).
 */
export function vendorSourceOf(source: string): VendorSource {
  const name = source.replace(/\.git$/, "").split(/[/:\\]/).filter(Boolean).at(-1) ?? "";
  if (name === "." || name === ".." || name === "") throw new VendorFault(`Invalid path "${source}".`, "Use correct git path.");
  return new VendorSource(source, name);
}
