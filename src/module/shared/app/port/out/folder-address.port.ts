import { NoFolderAddressFault } from "../../../domain/models/adapter.fault.js";

/** What an address that names no folder is refused with, named again here so
 *  it names this port and nothing behind it. */
export { NoFolderAddressFault };

declare const folderBrand: unique symbol;

/**
 * A URL that names a folder rather than a file.
 *
 * A plain `URL` cannot say which it is — `file:///repo/.cw/charter` and
 * `file:///repo/.cw/charter/` are both valid, and only the second resolves
 * `guide/no-any.md` under it — so the distinction is a type the compiler can
 * hold, and `FolderAddress.parseFolderUrl` is the only way to obtain one.
 */
export type FolderURL = URL & { readonly [folderBrand]: true };

/**
 * DRIVEN PORT — the address an adapter is set up on: a repository's, or the
 * developer's home. Known to the adapters and to what sets them up, never to
 * the hexagon's use cases (CORE-FR-217, CORE-FR-218); what one must be is the
 * contract every adapter keeps alike (SDK-FR-010).
 */
export class FolderAddress {
  /** A folder URL from a URL or its text, refused unless its path starts at
   *  `/` (SDK-FR-010) and already ends in the separator a folder needs. Refused
   *  rather than corrected: adding the separator would make
   *  `file:///repo/.cw/charter` and a URL that really does name a file
   *  indistinguishable, and the caller is the one that knows which it meant. */
  static parseFolderUrl(askedAddress: URL | string): FolderURL {
    const askedURL = new URL(askedAddress);
    // An opaque path, as `mailto:` has, holds no folder: only a hierarchical one starts at its root (SDK-FR-010).
    if (!askedURL.pathname.startsWith("/")) {
      const folderAddress = FolderAddress.cleanFolderAddress(askedURL);
      // With a host, the path can start at its root; an opaque one, as `mailto:` has, can only be written again.
      const fixFolderAddress = FolderAddress.cleanFolderAddress(askedURL);
      if (askedURL.host !== "") fixFolderAddress.pathname = "/";
      throw new NoFolderAddressFault(
        `"${folderAddress.href}" names no folder: its path does not start at "/".`,
        `Write an address whose path starts at "/" and ends in its separator, as in "${askedURL.host === "" ? "file:///work/my-repo/" : fixFolderAddress.href}".`,
        { internal: false },
      );
    }
    if (!askedURL.pathname.endsWith("/")) {
      const folderAddress = FolderAddress.cleanFolderAddress(askedURL);
      const fixFolderAddress = FolderAddress.cleanFolderAddress(askedURL);
      fixFolderAddress.pathname += "/";
      throw new NoFolderAddressFault(
        `"${folderAddress.href}" names a file, and a folder is what is wanted here.`,
        `Write it with the separator a folder ends in, as in "${fixFolderAddress.href}".`,
        { internal: false },
      );
    }
    return askedURL as FolderURL;
  }

  /** The path of an address on this machine's disk, a `file:` one with no
   *  host, as the disk names it; none for any other address (SDK-FR-011). */
  static findLocalPath(url: URL): string | undefined {
    return url.protocol === "file:" && url.host === "" ? decodeURIComponent(url.pathname) : undefined;
  }

  /** The address of the folder a URL names, the user name, password, query and
   *  fragment it carries left out: they say how a folder is reached, not which
   *  folder it is, and are never answered. */
  static cleanFolderAddress(url: URL): URL {
    const folderAddress = new URL(url);
    folderAddress.username = "";
    folderAddress.password = "";
    folderAddress.search = "";
    folderAddress.hash = "";
    return folderAddress;
  }
}
