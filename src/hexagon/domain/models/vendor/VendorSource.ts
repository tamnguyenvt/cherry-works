import { VendorFault } from "../DomainFault.js";

/** A charter this repository installs rather than authors: the source as it
 *  was typed, handed to version control as it is, and the name of the folder
 *  it lands in under the vendor folder, its owner and its repository (FR-049,
 *  FR-050). */
export class VendorSource {
  constructor(
    readonly source: string,
    readonly name: string,
  ) {}
}

/**
 * The vendor source a source names: the last two folders of the path its
 * address names, its owner and its repository without a trailing `.git`, are
 * what it is called here — `team/charter` — and the address itself is
 * version control's to read (FR-050). What comes before the path, a scheme and
 * a host or a `user@host:`, is no part of the name.
 *
 * Refused where the path names no owner, or where either folder is no folder —
 * empty, `.` or `..` — since only a crafted address names one, and the folder
 * would sit on the vendor folder itself or above it (FR-044).
 */
export function vendorSourceOf(source: string): VendorSource {
  const addressPath = source
    .replace(/\.git$/, "")
    .replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, "")
    .replace(/^[^/\\:@]+@[^/\\:]+:/, "");
  const folderNames = addressPath.split(/[/\\]/).filter(Boolean).slice(-2);
  if (folderNames.length < 2 || folderNames.some((folderName) => folderName === "." || folderName === ".."))
    throw new VendorFault(`Invalid path "${source}".`, "Use correct git path, naming its owner and its repository.");
  return new VendorSource(source, folderNames.join("/"));
}

/**
 * The folder one vendor was installed as, named as `cw vendor list` names it
 * under the vendor folder: its owner and its repository, a charter picked from
 * a source of many under them (CORE-FR-196), or the one folder an earlier
 * version named it by (FR-050, FR-180).
 *
 * Refused where that is no such folder — more than three folders, or one that is
 * empty, `.` or `..` — so what is taken away is never outside the vendor folder
 * nor more than one vendor of it (FR-044).
 */
export function installedVendorFolderOf(name: string): string {
  const folderNames = name.split(/[/\\]/).filter(Boolean);
  if (folderNames.length === 0 || folderNames.length > 3 || folderNames.some((folderName) => folderName === "." || folderName === ".."))
    throw new VendorFault(`Invalid path "${name}".`, "Name the folder as cw vendor list names it under .cw/vendor/.");
  return folderNames.join("/");
}
