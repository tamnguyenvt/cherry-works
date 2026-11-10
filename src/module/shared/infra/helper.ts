import { AdapterFault } from "../app/port/out/writing-files.port.js";
import { FolderAddress } from "../app/port/out/folder-address.port.js";

/** A file's text, decoded where it was written as bytes, as a disk would. */
export function decodeContents(contents: string | Uint8Array): string {
  return typeof contents === "string" ? contents : new TextDecoder("utf-8", { ignoreBOM: true }).decode(contents);
}

/** A file's bytes, encoded where it was written as text, as a disk would, bytes as a copy of their own. */
export function encodeContents(contents: string | Uint8Array): Uint8Array {
  return typeof contents === "string" ? new TextEncoder().encode(contents) : contents.slice();
}

/** Where a path from a folder sits: each segment escaped as an address needs
 *  it, a `#` or a `%` in a file's name included; the empty path is the folder.
 *  A path starting at `/`, or stepping out of the folder with `..`, is
 *  refused: nothing an adapter is handed reaches past the folder it was set
 *  up on (CORE-FR-044). */
export function urlAt(folder: URL, path: string): URL {
  const pathUrl = new URL(path.split("/").map(encodeURIComponent).join("/"), folder);
  if (path.startsWith("/") || !pathUrl.href.startsWith(folderHrefOf(folder)))
    throw new AdapterFault(`"${path}" is no path inside the folder this was set up on.`, "Name a path from that folder, with no leading \"/\" and no \"..\" out of it.", { internal: false });
  return pathUrl;
}

/** The path from a folder of an address under it, as a person reads it; an
 *  address outside the folder has none, and is refused. */
export function pathFrom(folder: URL, url: URL): string {
  const folderHref = folderHrefOf(folder);
  if (!url.href.startsWith(folderHref))
    throw new AdapterFault(`"${FolderAddress.addressOf(url).href}" is not under "${FolderAddress.addressOf(folder).href}".`, "Name an address inside the folder the adapter was set up on.");
  return decodeURIComponent(url.href.slice(folderHref.length)).replace(/\/$/, "");
}

/** A folder's address as the files under it start: what it was reached by
 *  — a query, a fragment — is no part of where they are. */
function folderHrefOf(folder: URL): string {
  const folderAddress = new URL(folder);
  folderAddress.search = "";
  folderAddress.hash = "";
  return folderAddress.href;
}

/** The path from the repository of a path from a checkout of it. */
export function filePathOf(checkoutPath: string, path: string): string {
  return checkoutPath === "" ? path : `${checkoutPath}/${path}`;
}

/** The path from a checkout of the repository of a path from the repository. */
export function pathFromCheckout(checkoutPath: string, filePath: string): string {
  return checkoutPath === "" ? filePath : filePath.slice(checkoutPath.length + 1);
}


/** The path a checkout's files are read under, ending in its separator, or
 *  nothing where the checkout is the repository itself. */
export function checkoutPathOf(checkoutPath: string): string {
  return checkoutPath === "" ? "" : `${checkoutPath.replace(/\/$/, "")}/`;
}

/** One folder a vendor was installed as: its name under the vendor folder,
 *  `team/charter`, or the one folder an earlier version named it by, and where
 *  it sits from the repository. */
/**
 * Every folder a vendor was installed as, read off the paths of the files kept
 * under the vendor folder: each source under its owner's folder,
 * `team/charter` (FR-050), each charter picked from a source of many under
 * that source's folder, `acme/charters/baseline` (CORE-FR-196), and each folder
 * an earlier version installed a source as, named by its repository alone,
 * read as it was and never moved (FR-180).
 *
 * Which is which is read off what a folder holds: a source holds kind folders
 * and its README, an owner holds the folders of its repositories, and a source
 * of many holds a folder per charter picked, named as no kind is
 * (CORE-FR-197), beside the kind folders of the skills taken from it. An
 * earlier name carries no owner, so the two never meet under one name.
 */
/** What one folder under the vendor folder holds at its top, read off the
 *  paths of the files kept there: its folders' names and its files'. */
/**
 * One layer's primitives, read off the files under its charter folder
 * (FR-008, FR-023): a repository's own, a vendor's, or a source's.
 *
 * A file outside a kind's folder is no primitive: the catalogues and the
 * lockfile sit beside them, and a repository may keep a README of its own there
 * (FR-002). Going down from a kind's folder, the first index.md found is a
 * primitive, its kind the folder it is under and its id the folders between,
 * and every other file under its folder is one of its assets, another
 * index.md included (FR-141, FR-168). A markdown file under no primitive's
 * folder is handed over too, as kept on its own, for the charter to say
 * where it belongs.
 */
/** Every skill's `SKILL.md` of a source, by its path in it: each folder under
 *  `skills/`, at most three folders deep and under no `node_modules`, holding
 *  one. A folder holding one is a skill, so a `SKILL.md` below it is one of its
 *  files, never a skill of its own (CORE-FR-185). */
