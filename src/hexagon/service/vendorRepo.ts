import { VENDOR_DIRECTORY } from "../domain/path.js";
import type { ForVCS } from "../port/zdriven/ForVCS.js";

/**
 * Which installed charters this repository is holding a change to, named by the
 * folder each was installed as (FR-040, SC-008).
 *
 * Version control answers it: a vendor landed as a commit, so what differs from
 * that commit is what somebody edited here, and `git checkout` is what undoes
 * it. A vendor changed in ten files is one drifted vendor, so the folder is what
 * comes back rather than the files, and the files are read where every other
 * uncommitted change is.
 */
export async function driftedVendors(repo: URL, vcs: ForVCS): Promise<readonly string[]> {
  const changed = await vcs.changedUnder(repo, VENDOR_DIRECTORY);
  const names = changed
    .map((path) => path.slice(`${VENDOR_DIRECTORY}/`.length).split("/")[0])
    .filter((name): name is string => name !== undefined && name !== "");
  return [...new Set(names)].sort();
}
