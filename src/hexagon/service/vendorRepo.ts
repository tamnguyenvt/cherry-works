import { DomainFault, VendorFault } from "../domain/models/DomainFault.js";
import { KINDS } from "../domain/models/charter/primitive/Primitive.js";
import { SkillPrimitive } from "../domain/models/charter/primitive/SkillPrimitive.js";
import { CHARTERS_FOLDER, charterVendorPrimitiveOf, SKILL_FILE, SKILLS_FOLDER, skillFilesOf, skillVendorPrimitiveOf, type VendorPrimitive } from "../domain/models/vendor/VendorPrimitive.js";
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

/** One vendor folder a source fills, as it was fetched, before anything of
 *  it is installed: the folder it lands in, the folder of the source its
 *  charter is checked out of — none for skills, each checked out on its own —
 *  and the primitives it holds, a charter's or the skills chosen, each
 *  converted. */
interface FetchedVendor {
  readonly folder: string;
  readonly sourceCharterFolder?: string;
  readonly vendorPrimitives: readonly VendorPrimitive[];
}

/** One vendor folder a source filled: the folder, and the primitives installed
 *  there — a charter's every one, or the skills chosen (CORE-FR-184,
 *  CORE-FR-196). */
export interface VendorInstall {
  readonly folder: string;
  readonly vendorPrimitives: readonly VendorPrimitive[];
}

/**
 * Every folder a vendor was installed as, under the repository: each source
 * under its owner's folder, `team/charter` (FR-050), each charter picked from
 * a source of many under that source's folder, `acme/charters/baseline`
 * (CORE-FR-196), and each folder an earlier version installed a source as,
 * named by its repository alone, read as it was and never moved (FR-180).
 *
 * Which is which is read off what a folder holds: a source holds kind folders
 * and its README, an owner holds the folders of its repositories, and a source
 * of many holds a folder per charter picked, named as no kind is
 * (CORE-FR-197), beside the kind folders of the skills taken from it. An
 * earlier name carries no owner, so the two never meet under one name.
 */
export async function loadVendorFolders(repo: URL, fileReaders: ForReadingFiles): Promise<readonly VendorFolder[]> {
  const holdsReadme = async (folder: URL) => (await fileReaders.listFiles(folder)).some(({ file }) => file.href.endsWith(`/${VENDOR_README}`));

  const installedFolders = await fileReaders.listFolders(vendorFolderIn(repo));
  const vendorFolders = await Promise.all(
    installedFolders.map(async (folder): Promise<readonly VendorFolder[]> => {
      const ownerName = decodeURIComponent(folder.href.split("/").at(-2) ?? "");
      const childFolders = await fileReaders.listFolders(folder);
      const childFolderNames = childFolders.map((childFolder) => decodeURIComponent(childFolder.href.split("/").at(-2) ?? ""));
      const isSource = childFolderNames.some((childFolderName) => (KINDS as readonly string[]).includes(childFolderName)) || (await holdsReadme(folder));
      if (isSource) return [{ folder, vendorName: ownerName }];
      const repositoryVendorFolders = await Promise.all(
        childFolders.map(async (childFolder, index): Promise<readonly VendorFolder[]> => {
          const vendorName = `${ownerName}/${childFolderNames[index]}`;
          const repositoryFolders = await fileReaders.listFolders(childFolder);
          const pickedVendorFolders = repositoryFolders
            .map((repositoryFolder) => ({ folder: repositoryFolder, vendorName: `${vendorName}/${decodeURIComponent(repositoryFolder.href.split("/").at(-2) ?? "")}` }))
            .filter((pickedVendorFolder) => !(KINDS as readonly string[]).includes(pickedVendorFolder.vendorName.split("/").at(-1) ?? ""));
          const isRepositorySource = pickedVendorFolders.length === 0 || pickedVendorFolders.length < repositoryFolders.length || (await holdsReadme(childFolder));
          return [...(isRepositorySource ? [{ folder: childFolder, vendorName }] : []), ...pickedVendorFolders];
        }),
      );
      return repositoryVendorFolders.flat();
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
 * What one source holds at one commit fetched, as the vendor folders it fills,
 * every refusal raised before anything is installed.
 *
 * What the source is, is read off what it holds, with no flag naming it
 * (CORE-FR-193). With neither `charterNames` nor `skillIds`, the first shape it
 * holds is taken, in this order: its one charter folder, where `cw init` put
 * it; else every charter under its `charters/` folder (CORE-FR-195); else every
 * skill under its `skills/` folder, each `SKILL.md` a skill converted
 * (CORE-FR-185, CORE-FR-186). `charterNames` reads `charters/` alone and
 * `skillIds` `skills/` alone, whatever else the source holds, and both may be
 * given; a flag for a shape it does not hold is refused, saying which shapes
 * it holds. A source holding none is refused (FR-042).
 *
 * A charter lands in the folder of the source's owner and repository, and each
 * charter picked from a source of many in a folder of its own under it,
 * `<owner>/<repository>/<name>` (CORE-FR-196); skills land in the folder of
 * the source, beside the charters picked from it. Vendoring is one level deep:
 * a charter that installed vendors of its own is refused, since it may lean on
 * what they hold and that is not installed with it (FR-170). So is a charter
 * named that the source does not hold, a folder under `charters/` named as a
 * kind is or holding no charter folder (CORE-FR-197), a skill named that the
 * source does not hold (CORE-FR-188), and skills any of which the charter
 * cannot hold, or two of which declare one name (CORE-FR-192).
 *
 * A folder holds a charter or what was picked and taken from a source of many,
 * never both: a charter's folder holds its README and its kind folders alone
 * (CORE-FR-191).
 */
async function loadFetchedVendors(
  repo: URL,
  fileReaders: ForReadingFiles,
  vcs: ForVCS,
  yamlParser: ForParsingYaml,
  source: string,
  fetchedCommit: string,
  skillIds: readonly string[],
  charterNames: readonly string[],
): Promise<readonly FetchedVendor[]> {
  const vendorName = vendorSourceOf(source).name;
  const folder = `${VENDOR_DIRECTORY}/${vendorName}`;
  const sourcePaths = await vcs.listFilesAt(repo, fetchedCommit);

  const folderUrl = new URL(`${folder}/`, repo);
  const installedFolderNames = (await fileReaders.listFolders(folderUrl)).map((installedFolder) => decodeURIComponent(installedFolder.href.split("/").at(-2) ?? ""));
  const holdsCharter =
    installedFolderNames.some((installedFolderName) => installedFolderName !== SkillPrimitive.kind && (KINDS as readonly string[]).includes(installedFolderName)) ||
    (await fileReaders.listFiles(folderUrl)).some(({ file }) => file.href.endsWith(`/${VENDOR_README}`));
  const holdsPicked = !holdsCharter && installedFolderNames.length > 0;
  const reinstallFix = `Run "cw vendor remove ${vendorName}", then install it again.`;

  const heldCharterNames = [
    ...new Set(sourcePaths.filter((sourcePath) => sourcePath.startsWith(`${CHARTERS_FOLDER}/`) && sourcePath.split("/").length > 2).map((sourcePath) => sourcePath.split("/")[1] ?? "")),
  ].sort();
  const skillFiles = skillFilesOf(sourcePaths);
  const holdsOwnCharter = sourcePaths.some((sourcePath) => sourcePath.startsWith(`${CHARTER_DIRECTORY}/`));
  const heldShapes = [
    ...(holdsOwnCharter ? [`a charter in "${CHARTER_DIRECTORY}"`] : []),
    ...(heldCharterNames.length > 0 ? [`charters under "${CHARTERS_FOLDER}/"`] : []),
    ...(skillFiles.length > 0 ? [`skills under "${SKILLS_FOLDER}/"`] : []),
  ];
  if (heldShapes.length === 0)
    throw new VendorFault(
      `${source} has no "${CHARTER_DIRECTORY}" and no ${SKILL_FILE} under "${SKILLS_FOLDER}/", nor any charter under "${CHARTERS_FOLDER}/".`,
      `Check that the source holds "${CHARTER_DIRECTORY}", charters under "${CHARTERS_FOLDER}/" each in a folder holding its "${CHARTER_DIRECTORY}", or skills under "${SKILLS_FOLDER}/" each in a folder holding its ${SKILL_FILE}, at the version asked for.`,
    );
  if (charterNames.length > 0 && heldCharterNames.length === 0)
    throw new VendorFault(`${source} holds no "${CHARTERS_FOLDER}/": it holds ${heldShapes.join(" and ")}.`, "Run this again without --charter.");
  if (skillIds.length > 0 && skillFiles.length === 0)
    throw new VendorFault(`${source} holds no "${SKILLS_FOLDER}/": it holds ${heldShapes.join(" and ")}.`, "Run this again without --skill.");

  const isTakingOwnCharter = holdsOwnCharter && charterNames.length === 0 && skillIds.length === 0;
  const pickedCharterNames = charterNames.length > 0 ? charterNames : !holdsOwnCharter && skillIds.length === 0 ? heldCharterNames : [];
  const isTakingSkills = skillIds.length > 0 || (!holdsOwnCharter && heldCharterNames.length === 0);

  /** One charter of the source, at its charter folder, refused where it
   *  installed vendors of its own (FR-170). */
  const loadFetchedCharter = async (charterFolder: string, charterSource: string, charterVendorFolder: string): Promise<FetchedVendor> => {
    const sourceVendorFolder = `${charterSource === "" ? "" : `${charterSource}/`}${VENDOR_DIRECTORY}`;
    if (sourcePaths.some((sourcePath) => sourcePath.startsWith(`${sourceVendorFolder}/`)))
      throw new VendorFault(`${source} holds "${sourceVendorFolder}", and vendoring is one level deep.`, `Remove "${sourceVendorFolder}" from the source, or install a version without it.`);
    const charterIndexPaths = sourcePaths.filter((sourcePath) => sourcePath.startsWith(`${charterFolder}/`) && sourcePath.endsWith(`/${SkillPrimitive.index}`));
    const vendorPrimitives = await Promise.all(
      charterIndexPaths.map(async (indexPath) => charterVendorPrimitiveOf(await vcs.readFileAt(repo, fetchedCommit, indexPath), indexPath, charterFolder, yamlParser)),
    );
    return { folder: charterVendorFolder, sourceCharterFolder: charterFolder, vendorPrimitives };
  };

  if (isTakingOwnCharter) {
    if (holdsPicked)
      throw new VendorFault(
        `${folder} holds ${installedFolderNames.includes(SkillPrimitive.kind) ? "skills taken" : "charters picked"} from ${source}, which holds a charter of its own now.`,
        reinstallFix,
      );
    return [await loadFetchedCharter(CHARTER_DIRECTORY, "", folder)];
  }

  if (holdsCharter) throw new VendorFault(`${folder} holds a charter installed from ${source}, and nothing is picked or taken into a charter's folder.`, reinstallFix);

  const unheldCharterNames = pickedCharterNames.filter((charterName) => !heldCharterNames.includes(charterName));
  if (unheldCharterNames.length > 0) throw new VendorFault(`${source} holds no charter ${unheldCharterNames.join(", ")}.`, `Pick one it holds: ${heldCharterNames.join(", ")}.`);
  const fetchedCharters: FetchedVendor[] = [];
  for (const charterName of heldCharterNames.filter((heldCharterName) => pickedCharterNames.includes(heldCharterName))) {
    const charterSource = `${CHARTERS_FOLDER}/${charterName}`;
    if ((KINDS as readonly string[]).includes(charterName))
      throw new VendorFault(`"${charterSource}" is named as a kind is, and its vendor folder would be read as that kind's.`, `Rename "${charterSource}" in the source, then pick it again.`);
    if (!sourcePaths.some((sourcePath) => sourcePath.startsWith(`${charterSource}/${CHARTER_DIRECTORY}/`)))
      throw new VendorFault(`"${charterSource}" holds no "${CHARTER_DIRECTORY}".`, `Pick a charter whose folder holds "${CHARTER_DIRECTORY}": ${heldCharterNames.filter((heldCharterName) => heldCharterName !== charterName).join(", ")}.`);
    fetchedCharters.push(await loadFetchedCharter(`${charterSource}/${CHARTER_DIRECTORY}`, charterSource, `${folder}/${charterName}`));
  }
  if (!isTakingSkills) return fetchedCharters;

  const vendorPrimitives = await Promise.all(
    skillFiles.map(async (skillFile) => skillVendorPrimitiveOf(await vcs.readFileAt(repo, fetchedCommit, skillFile), skillFile, yamlParser)),
  );
  const sharedIdPrimitives = vendorPrimitives.filter((vendorPrimitive) => vendorPrimitives.some((otherPrimitive) => otherPrimitive !== vendorPrimitive && otherPrimitive.id === vendorPrimitive.id));
  if (sharedIdPrimitives.length > 0)
    throw new VendorFault(
      `${sharedIdPrimitives.map(({ sourceFolder }) => `${sourceFolder}/${SKILL_FILE}`).join(", ")} declare one name, and a name is one skill.`,
      "Take the skills from a version of the source whose names are its own.",
    );
  const heldSkillIds = vendorPrimitives.map(({ id }) => id);
  const unheldSkillIds = skillIds.filter((skillId) => !heldSkillIds.includes(skillId));
  if (unheldSkillIds.length > 0) throw new VendorFault(`${source} holds no skill ${unheldSkillIds.join(", ")}.`, `Take one it holds: ${heldSkillIds.join(", ")}.`);
  const chosenPrimitives = skillIds.length === 0 ? vendorPrimitives : vendorPrimitives.filter(({ id }) => skillIds.includes(id));
  return [...fetchedCharters, { folder, vendorPrimitives: [...chosenPrimitives].sort((leftPrimitive, rightPrimitive) => leftPrimitive.id.localeCompare(rightPrimitive.id)) }];
}

/**
 * Install one source under the folder of its owner and its repository, pinned
 * to this version where one is named, left unstaged and uncommitted for the
 * user to read, whatever else is in hand (FR-042, FR-047, FR-050,
 * CORE-FR-190). The source is fetched once, and what is installed is read off
 * that one commit; nothing is installed where anything it would install is
 * refused.
 *
 * A charter is installed whole — its charter folder and its README, replacing
 * whatever its folder held — the source's one charter, or each picked from a
 * source of many in a folder of its own, brought up to date and removed on its
 * own (CORE-FR-196). The skills `skillIds` names are installed, or every one
 * where the source's shape takes them and it names none, asking nothing, each
 * converted at `skill/<id>/` of the source's folder with every file beside its
 * `SKILL.md` (CORE-FR-186 to CORE-FR-188). A skill installed again replaces the
 * one before; the others are left as they were (CORE-FR-189).
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
  charterNames: readonly string[] = [],
): Promise<readonly VendorInstall[]> {
  await ensureVCSReady(repo, vcs);
  vendorSourceOf(source);
  const fetchedCommit = await vcs.fetchCommit(source, repo, version);
  const fetchedVendors = await loadFetchedVendors(repo, fileReaders, vcs, yamlParser, source, fetchedCommit, skillIds, charterNames);
  const sourcePaths = await vcs.listFilesAt(repo, fetchedCommit);

  for (const { folder, sourceCharterFolder, vendorPrimitives } of fetchedVendors) {
    if (sourceCharterFolder !== undefined) {
      await vcs.checkoutFolderAt(repo, fetchedCommit, sourceCharterFolder, folder);
      const readmePath = `${sourceCharterFolder.slice(0, -CHARTER_DIRECTORY.length)}${VENDOR_README}`;
      if (sourcePaths.includes(readmePath)) await fileWriter.write(new URL(`${folder}/${VENDOR_README}`, repo), await vcs.readFileAt(repo, fetchedCommit, readmePath));
      continue;
    }
    for (const { id, sourceFolder, convertedSkill } of vendorPrimitives) {
      const skillFolder = `${folder}/${SkillPrimitive.kind}/${id}`;
      await vcs.checkoutFolderAt(repo, fetchedCommit, sourceFolder, skillFolder);
      await fileWriter.write(new URL(`${skillFolder}/${SkillPrimitive.index}`, repo), convertedSkill!.toMarkdown());
      await fileWriter.delete(new URL(`${skillFolder}/${SKILL_FILE}`, repo));
    }
  }
  return fetchedVendors.map(({ folder, vendorPrimitives }) => ({ folder, vendorPrimitives }));
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
    const [ownerName = "", childName = "", grandchildName = ""] = path.slice(`${VENDOR_DIRECTORY}/`.length).split("/");
    const isSourcePathName = (fileName: string) => fileName === VENDOR_README || (KINDS as readonly string[]).includes(fileName);
    if (isSourcePathName(childName)) return ownerName;
    return isSourcePathName(grandchildName) ? `${ownerName}/${childName}` : `${ownerName}/${childName}/${grandchildName}`;
  });
  return [...new Set(vendorNames.filter((vendorName) => vendorName !== "" && !vendorName.endsWith("/")))].sort();
}
