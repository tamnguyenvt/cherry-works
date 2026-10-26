import { DomainFault } from "../domain/models/DomainFault.js";
import { KINDS } from "../domain/models/charter/primitive/Primitive.js";
import { installedVendorFolderOf, vendorSourceOf } from "../domain/models/vendor/VendorSource.js";
import { CHARTER_DIRECTORY, VENDOR_DIRECTORY, vendorFolderIn } from "../domain/path.js";
import type { ForReadingFiles } from "../port/zdriven/ForReadingFiles.js";
import type { ForVCS } from "../port/zdriven/ForVCS.js";

/** One folder a vendor was installed as, and its name under the vendor
 *  folder: `team/charter`, or the one folder an earlier version named it by. */
export interface VendorFolder {
  readonly folder: URL;
  readonly vendorName: string;
}

/** What a vendor installed holds at its top, besides its kind folders: the
 *  source's README (FR-042). */
const VENDOR_README = "README.md";

/**
 * Every folder a vendor was installed as, under the repository: each source
 * under its owner's folder, `team/charter` (FR-050), and each folder an
 * earlier version installed a source as, named by its repository alone, read
 * as it was and never moved (FR-180).
 *
 * Which is which is read off what a folder holds: a source holds kind folders
 * and its README, an owner holds the folders of its repositories. An earlier
 * name carries no owner, so the two never meet under one name.
 */
export async function loadVendorFolders(repo: URL, fileReaders: ForReadingFiles): Promise<readonly VendorFolder[]> {
  const installedFolders = await fileReaders.listFolders(vendorFolderIn(repo));
  const vendorFolders = await Promise.all(
    installedFolders.map(async (folder): Promise<readonly VendorFolder[]> => {
      const ownerName = decodeURIComponent(folder.href.split("/").at(-2) ?? "");
      const childFolders = await fileReaders.listFolders(folder);
      const childFolderNames = childFolders.map((childFolder) => decodeURIComponent(childFolder.href.split("/").at(-2) ?? ""));
      const isSource =
        childFolderNames.some((childFolderName) => (KINDS as readonly string[]).includes(childFolderName)) ||
        (await fileReaders.listFiles(folder)).some(({ file }) => file.href.endsWith(`/${VENDOR_README}`));
      if (isSource) return [{ folder, vendorName: ownerName }];
      return childFolders.map((childFolder, index) => ({ folder: childFolder, vendorName: `${ownerName}/${childFolderNames[index]}` }));
    }),
  );
  return vendorFolders.flat().sort((leftFolder, rightFolder) => leftFolder.vendorName.localeCompare(rightFolder.vendorName));
}

/** Every folder a vendor was installed as, under the repository, sorted: read
 *  the way the charter finds its vendor layers, so what is listed is what the
 *  charter reads (FR-053). */
export async function loadVendorNames(repo: URL, fileReaders: ForReadingFiles): Promise<readonly string[]> {
  return (await loadVendorFolders(repo, fileReaders)).map(({ vendorName }) => `${VENDOR_DIRECTORY}/${vendorName}`);
}

/**
 * The questions asked before installing or removing touches anything.
 *
 * Both need a repository, since a vendor is fetched by it and lives in it.
 * Only removing commits, so only removing asks for nothing in hand, saying
 * `because`: a commit made while somebody's work is in the index would carry
 * that work along with it, and whoever is holding it is the one who decides
 * what to do with it. Installing leaves what it fetched in the working tree,
 * beside whatever is there.
 */
async function ensureVCSReady(repo: URL, vcs: ForVCS, because?: string): Promise<void> {
  if (!(await vcs.isInstalled(repo)))
    throw new DomainFault(
      "This folder is not inside a git repository, and a vendor lives in one.",
      'Run "git init" here, or run this again where your repository is.',
    );

  if (because !== undefined && !(await vcs.isClean(repo)))
    throw new DomainFault(
      `This repository has work in hand, and ${because}.`,
      "Commit or stash what you are holding, then run this again.",
    );
}

/**
 * Install the charter of one source under the folder of its owner and its
 * repository, pinned
 * to this version where one is named, with the source's README beside it, left
 * unstaged and uncommitted for the user to read; and answer that folder
 * (FR-042, FR-047, FR-050).
 *
 * What is taken is the source's own charter folder, where `cw init` put it,
 * and nothing else: a repository without one is not a charter, and is refused
 * rather than installed whole. Vendoring is one level deep: a source that
 * installed vendors of its own is refused too, since its charter may lean on
 * what they hold and that is not installed with it.
 */
export async function addVendor(repo: URL, vcs: ForVCS, source: string, version?: string): Promise<string> {
  await ensureVCSReady(repo, vcs);
  const folder = `${VENDOR_DIRECTORY}/${vendorSourceOf(source).name}`;
  return vcs.subtreeAdd(source, [CHARTER_DIRECTORY, "README.md"], repo, folder, version, VENDOR_DIRECTORY);
}

/** Take the folder one vendor was installed as away, as a commit version
 *  control makes; and answer that folder (FR-047). The folder is named as it is
 *  listed: owner and repository, or the one folder an earlier version named it
 *  by (FR-180). */
export async function removeVendor(repo: URL, vcs: ForVCS, name: string): Promise<string> {
  await ensureVCSReady(repo, vcs, "removing a vendor commits that it is gone");
  const folder = `${VENDOR_DIRECTORY}/${installedVendorFolderOf(name)}`;
  await vcs.removeSubFolder(repo, folder);
  return folder;
}

/**
 * Which installed charters this repository is holding a change to, named by the
 * folder each was installed as (FR-040, SC-008).
 *
 * Version control answers it: a vendor is committed once its install is
 * read, so what differs from the last commit is what somebody edited here, or
 * an install not yet committed, and `git checkout` is what undoes it. A vendor changed in ten files is one drifted vendor, so the folder is what
 * comes back rather than the files, and the files are read where every other
 * uncommitted change is.
 */
export async function driftedVendors(repo: URL, vcs: ForVCS): Promise<readonly string[]> {
  const changed = await vcs.changedUnder(repo, VENDOR_DIRECTORY);
  const vendorNames = changed.map((path) => {
    const [ownerName = "", childName = ""] = path.slice(`${VENDOR_DIRECTORY}/`.length).split("/");
    const isSource = childName === VENDOR_README || (KINDS as readonly string[]).includes(childName);
    return isSource ? ownerName : `${ownerName}/${childName}`;
  });
  return [...new Set(vendorNames.filter((vendorName) => vendorName !== "" && !vendorName.endsWith("/")))].sort();
}
