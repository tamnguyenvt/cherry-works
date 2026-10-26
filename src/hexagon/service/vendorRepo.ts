import { DomainFault, VendorFault } from "../domain/models/DomainFault.js";
import { KINDS } from "../domain/models/charter/primitive/Primitive.js";
import { SkillPrimitive } from "../domain/models/charter/primitive/SkillPrimitive.js";
import { charterVendorPrimitiveOf, SKILL_FILE, SKILLS_FOLDER, skillFilesOf, skillVendorPrimitiveOf, type VendorPrimitive } from "../domain/models/vendor/VendorPrimitive.js";
import { installedVendorFolderOf, vendorSourceOf } from "../domain/models/vendor/VendorSource.js";
import { CHARTER_DIRECTORY, VENDOR_DIRECTORY, vendorFolderIn } from "../domain/path.js";
import type { ForParsingYaml } from "../port/zdriven/ForParsingYaml.js";
import type { ForReadingFiles } from "../port/zdriven/ForReadingFiles.js";
import type { ForVCS } from "../port/zdriven/ForVCS.js";
import type { ForWritingFiles } from "../port/zdriven/ForWritingFiles.js";

/** One folder a vendor was installed as, and its name under the vendor
 *  folder: `team/charter`, or the one folder an earlier version named it by. */
export interface VendorFolder {
  readonly folder: URL;
  readonly vendorName: string;
}

/** What a vendor installed holds at its top, besides its kind folders: the
 *  source's README (FR-042). */
const VENDOR_README = "README.md";

/** One source as it was fetched, before anything of it is installed: the
 *  folder it lands in, whether it is a charter, and every primitive it holds —
 *  a charter's, or a skills repository's skills each converted. */
interface FetchedVendor {
  readonly folder: string;
  readonly isCharter: boolean;
  readonly vendorPrimitives: readonly VendorPrimitive[];
}

/** One source installed: the folder it landed in, and the primitives installed
 *  there — a charter's every one, or the skills chosen (CORE-FR-184). */
export interface VendorInstall {
  readonly folder: string;
  readonly vendorPrimitives: readonly VendorPrimitive[];
}

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
 * What one source holds at one commit fetched, and the folder it lands in.
 *
 * What the source is, is read off what it holds, with no flag naming it
 * (CORE-FR-193). A source holding a charter folder, where `cw init` put it, is
 * a charter, whatever skill folders it also holds. Vendoring is one level
 * deep: a charter source that installed vendors of its own is refused, since
 * its charter may lean on what they hold and that is not installed with it
 * (FR-170). A source holding none is a skills repository, each `SKILL.md`
 * under its `skills/` folder a skill converted (CORE-FR-185, CORE-FR-186); one holding neither is refused
 * (FR-042), and so is one any skill of which the charter cannot hold, or two of
 * which declare one name (CORE-FR-192).
 *
 * A folder holds one or the other, never both: a charter's folder holds its
 * README, a skills repository's holds its skills alone (CORE-FR-191).
 */
async function loadFetchedVendor(
  repo: URL,
  fileReaders: ForReadingFiles,
  vcs: ForVCS,
  yamlParser: ForParsingYaml,
  source: string,
  fetchedCommit: string,
): Promise<FetchedVendor> {
  const vendorName = vendorSourceOf(source).name;
  const folder = `${VENDOR_DIRECTORY}/${vendorName}`;
  const sourcePaths = await vcs.listFilesAt(repo, fetchedCommit);

  const folderUrl = new URL(`${folder}/`, repo);
  const installedFolderNames = (await fileReaders.listFolders(folderUrl)).map((installedFolder) => decodeURIComponent(installedFolder.href.split("/").at(-2) ?? ""));
  const holdsCharter =
    installedFolderNames.some((installedFolderName) => installedFolderName !== SkillPrimitive.kind) ||
    (await fileReaders.listFiles(folderUrl)).some(({ file }) => file.href.endsWith(`/${VENDOR_README}`));
  const holdsVendorSkills = !holdsCharter && installedFolderNames.includes(SkillPrimitive.kind);
  const reinstallFix = `Run "cw vendor remove ${vendorName}", then install it again.`;

  if (sourcePaths.some((sourcePath) => sourcePath.startsWith(`${CHARTER_DIRECTORY}/`))) {
    if (sourcePaths.some((sourcePath) => sourcePath.startsWith(`${VENDOR_DIRECTORY}/`)))
      throw new VendorFault(`${source} holds "${VENDOR_DIRECTORY}", and vendoring is one level deep.`, `Remove "${VENDOR_DIRECTORY}" from the source, or install a version without it.`);
    if (holdsVendorSkills) throw new VendorFault(`${folder} holds skills taken from ${source}, which holds a charter now.`, reinstallFix);
    const charterIndexPaths = sourcePaths.filter((sourcePath) => sourcePath.startsWith(`${CHARTER_DIRECTORY}/`) && sourcePath.endsWith(`/${SkillPrimitive.index}`));
    const vendorPrimitives = await Promise.all(
      charterIndexPaths.map(async (indexPath) => charterVendorPrimitiveOf(await vcs.readFileAt(repo, fetchedCommit, indexPath), indexPath, CHARTER_DIRECTORY, yamlParser)),
    );
    return { folder, isCharter: true, vendorPrimitives };
  }

  const skillFiles = skillFilesOf(sourcePaths);
  if (skillFiles.length === 0)
    throw new VendorFault(
      `${source} has no "${CHARTER_DIRECTORY}" and no ${SKILL_FILE} under "${SKILLS_FOLDER}/".`,
      `Check that the source holds "${CHARTER_DIRECTORY}", or skills under "${SKILLS_FOLDER}/" each in a folder holding its ${SKILL_FILE}, at the version asked for.`,
    );
  if (holdsCharter) throw new VendorFault(`${folder} holds a charter installed from ${source}, which holds skills alone now.`, reinstallFix);

  const vendorPrimitives = await Promise.all(
    skillFiles.map(async (skillFile) => skillVendorPrimitiveOf(await vcs.readFileAt(repo, fetchedCommit, skillFile), skillFile, yamlParser)),
  );
  const sharedIdPrimitives = vendorPrimitives.filter((vendorPrimitive) => vendorPrimitives.some((otherPrimitive) => otherPrimitive !== vendorPrimitive && otherPrimitive.id === vendorPrimitive.id));
  if (sharedIdPrimitives.length > 0)
    throw new VendorFault(
      `${sharedIdPrimitives.map(({ sourceFolder }) => `${sourceFolder}/${SKILL_FILE}`).join(", ")} declare one name, and a name is one skill.`,
      "Take the skills from a version of the source whose names are its own.",
    );
  return { folder, isCharter: false, vendorPrimitives: [...vendorPrimitives].sort((leftPrimitive, rightPrimitive) => leftPrimitive.id.localeCompare(rightPrimitive.id)) };
}

/**
 * Install one source under the folder of its owner and its repository, pinned
 * to this version where one is named, left unstaged and uncommitted for the
 * user to read, whatever else is in hand (FR-042, FR-047, FR-050,
 * CORE-FR-190). The source is fetched once, and what is installed is read off
 * that one commit.
 *
 * A charter is installed whole — its charter folder and its README, replacing
 * whatever the folder held — and `skillIds` is refused for it, since a charter
 * is no list of skills to choose from (CORE-FR-193). A skills repository's
 * skills `skillIds` names are installed, or every one where it names none,
 * asking nothing, each converted at `skill/<id>/` of the folder with every
 * file beside its `SKILL.md` (CORE-FR-186 to CORE-FR-188). A skill installed
 * again replaces the one before; the others are left as they were
 * (CORE-FR-189). Nothing is installed where any id named is not there.
 */
export async function addVendor(
  repo: URL,
  fileReaders: ForReadingFiles,
  fileWriter: ForWritingFiles,
  vcs: ForVCS,
  yamlParser: ForParsingYaml,
  source: string,
  version?: string,
  skillIds: readonly string[] = [],
): Promise<VendorInstall> {
  await ensureVCSReady(repo, vcs);
  vendorSourceOf(source);
  const fetchedCommit = await vcs.fetchCommit(source, repo, version);
  const { folder, isCharter, vendorPrimitives } = await loadFetchedVendor(repo, fileReaders, vcs, yamlParser, source, fetchedCommit);

  if (isCharter) {
    if (skillIds.length > 0)
      throw new VendorFault(`${source} holds a charter, and --skill is for skills repositories (compatible with npx skills), not a charter: a charter is installed whole.`, "Run this again without --skill.");
    await vcs.checkoutFolderAt(repo, fetchedCommit, CHARTER_DIRECTORY, folder);
    if ((await vcs.listFilesAt(repo, fetchedCommit)).includes(VENDOR_README))
      await fileWriter.write(new URL(`${folder}/${VENDOR_README}`, repo), await vcs.readFileAt(repo, fetchedCommit, VENDOR_README));
    return { folder, vendorPrimitives };
  }

  const heldSkillIds = vendorPrimitives.map(({ id }) => id);
  const unheldSkillIds = skillIds.filter((skillId) => !heldSkillIds.includes(skillId));
  if (unheldSkillIds.length > 0) throw new VendorFault(`${source} holds no skill ${unheldSkillIds.join(", ")}.`, `Take one it holds: ${heldSkillIds.join(", ")}.`);

  const chosenPrimitives = skillIds.length === 0 ? vendorPrimitives : vendorPrimitives.filter(({ id }) => skillIds.includes(id));
  for (const { id, sourceFolder, convertedSkill } of chosenPrimitives) {
    const skillFolder = `${folder}/${SkillPrimitive.kind}/${id}`;
    await vcs.checkoutFolderAt(repo, fetchedCommit, sourceFolder, skillFolder);
    await fileWriter.write(new URL(`${skillFolder}/${SkillPrimitive.index}`, repo), convertedSkill!.toMarkdown());
    await fileWriter.delete(new URL(`${skillFolder}/${SKILL_FILE}`, repo));
  }
  return { folder, vendorPrimitives: chosenPrimitives };
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
