import type { Dirent } from "node:fs";
import { readdir } from "node:fs/promises";
import { StreamableHTTPError } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  AdapterFault,
  UnauthorizedMcpFault,
  UnreachableMcpOriginFault,
} from "../app/port/out/calling-mcp-servers.port.js";
import { FolderAddress } from "../app/port/out/folder-address.port.js";
import { UnreadableFolderFault } from "../app/port/out/reading-files.port.js";
import { PathOutsideFolderFault } from "../app/port/out/writing-files.port.js";

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
export function resolveFileUrl(folderUrl: URL, relativePath: string): URL {
  const pathUrl = new URL(relativePath.split("/").map(encodeURIComponent).join("/"), folderUrl);
  if (relativePath.startsWith("/") || !pathUrl.href.startsWith(cleanFolderHref(folderUrl)))
    throw new PathOutsideFolderFault(
      `"${relativePath}" is no path inside the folder this was set up on.`,
      'Name a path from that folder, with no leading "/" and no ".." out of it.',
      { internal: false },
    );
  return pathUrl;
}

/** The path from a folder of an address under it, as a person reads it; an
 *  address outside the folder has none, and is refused. */
export function findRelativePath(folderUrl: URL, fileUrl: URL): string {
  const folderHref = cleanFolderHref(folderUrl);
  if (!fileUrl.href.startsWith(folderHref))
    throw new PathOutsideFolderFault(
      `"${FolderAddress.cleanFolderAddress(fileUrl).href}" is not under "${FolderAddress.cleanFolderAddress(folderUrl).href}".`,
      "Name an address inside the folder the adapter was set up on.",
    );
  return decodeURIComponent(fileUrl.href.slice(folderHref.length)).replace(/\/$/, "");
}

/** A folder's address as the files under it start: what it was reached by
 *  — a query, a fragment — is no part of where they are. */
function cleanFolderHref(folderUrl: URL): string {
  const folderAddress = new URL(folderUrl);
  folderAddress.search = "";
  folderAddress.hash = "";
  return folderAddress.href;
}

/** The path from the repository of a path from a checkout of it. */
export function resolveRepoPath(checkoutPath: string, repoRelativePath: string): string {
  return checkoutPath === "" ? repoRelativePath : `${checkoutPath}/${repoRelativePath}`;
}

/** The path from a checkout of the repository of a path from the repository. */
export function resolveCheckoutPath(checkoutPath: string, filePath: string): string {
  return checkoutPath === "" ? filePath : filePath.slice(checkoutPath.length + 1);
}

/** The path a checkout's files are read under, ending in its separator, or
 *  nothing where the checkout is the repository itself. */
export function formatCheckoutFolder(checkoutPath: string): string {
  return checkoutPath === "" ? "" : `${checkoutPath.replace(/\/$/, "")}/`;
}

/** What one directory holds, and nothing where there is no such directory. */
export async function readFolderEntries(folderUrl: URL): Promise<readonly Dirent[]> {
  try {
    return await readdir(folderUrl, { withFileTypes: true });
  } catch (readError) {
    if ((readError as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new UnreadableFolderFault(
      `"${folderUrl.pathname}" could not be read.`,
      "Check that the folder can be read, and run this again.",
      {
        cause: readError,
      },
    );
  }
}

/** One directory inside another. */
export function resolveSubfolderUrl(folderUrl: URL, subfolderName: string): URL {
  return new URL(`${encodeURIComponent(subfolderName)}/`, folderUrl);
}

/** What the SDK raised, as this port raises it: a `401` the one refusal the
 *  caller can act on, anything else an `UnreachableMcpOriginFault` saying what failed where,
 *  what the SDK said kept as its cause for the log alone (SDK-FR-018). Never
 *  what was sent: a credential is not in any message. */
export function wrapMcpFault(raisedValue: unknown, failedCallText: string, fix: string): AdapterFault {
  if (raisedValue instanceof AdapterFault) return raisedValue;
  if (raisedValue instanceof StreamableHTTPError && raisedValue.code === 401)
    return new UnauthorizedMcpFault(
      `${failedCallText}: the mcp origin refused your credential.`,
      'Run "cw mcp auth" at a terminal to sign in there again.',
      { internal: false },
    );
  return new UnreachableMcpOriginFault(`${failedCallText}.`, fix, { internal: false, cause: raisedValue });
}
