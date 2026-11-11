import { CharterFolder } from "../../domain/models/charter/charter-folder.js";
import { VendorsFolder } from "../../domain/models/charter/vendors-folder.js";
import { VendorFault } from "../../domain/models/charter.fault.js";
import { Primitives } from "../../domain/models/primitive/primitive.js";
import { SkillPrimitive } from "../../domain/models/primitive/skill-primitive.js";
import { CopyPlan, ProjectionPlan, WritePlan } from "../../domain/models/projection/projection-plan.js";
import { VendorRoot } from "../../domain/models/vendor/vendor-root.js";
import { type SourceCharter, VendorSource } from "../../domain/models/vendor/vendor-source.js";
import type { ForManagingCharter } from "../port/out/managing-charter.port.js";

/** The name a source's own charter, and the skills taken from it, are
 *  installed under beside the charters picked from it. */
const ROOT_NAME = "root";

export class InstallCharterService {
  /**
   * What one source holds at the commit fetched, filtered to what is
   * installed of it, every refusal raised before anything is.
   *
   * What the source is, is read off what it holds, with no flag naming it
   * (CORE-FR-193). With neither `selectedCharterNames` nor `selectedSkillIds`, the first shape it
   * holds is taken, in this order: its one charter, where `cw init` put it;
   * else every charter it keeps apart (CORE-FR-195); else every skill it
   * publishes, each converted (CORE-FR-185, CORE-FR-186). `selectedCharterNames`
   * reads the charters kept apart alone and `selectedSkillIds` the skills alone,
   * whatever else the source holds, and both may be given; a flag for a shape
   * it does not hold is refused, saying which shapes it holds. A source
   * holding none is refused (FR-042).
   *
   * Vendoring is one level deep: a charter that installed vendors of its own is refused,
   * since it may lean on what they hold and that is not installed with it
   * (FR-170). So is a charter named that the source does not hold, one named as
   * a kind is or holding no charter (CORE-FR-197), a skill named that the
   * source does not hold (CORE-FR-188), and skills any of which the charter
   * cannot hold, or two of which declare one name (CORE-FR-192).
   *
   * Whatever `root` held is written over by what is installed into it.
   */
  filterSource(
    vendorSource: VendorSource,
    selectedSkillIds: readonly string[],
    selectedCharterNames: readonly string[],
  ): VendorSource {
    const {
      origin: { sourceUri },
      ownCharter,
    } = vendorSource;

    const heldCharterNames = vendorSource.charters.map(({ name }) => name);
    const holdsOwnCharter = ownCharter !== undefined;
    const heldShapes = [
      ...(holdsOwnCharter ? [`a charter in "${CharterFolder.path}"`] : []),
      ...(heldCharterNames.length > 0 ? [`charters under "${VendorSource.chartersFolder}/"`] : []),
      ...(vendorSource.holdsSkills ? [`skills under "${VendorSource.skillsFolder}/"`] : []),
    ];
    if (heldShapes.length === 0)
      throw new VendorFault(
        `${sourceUri} has no "${CharterFolder.path}" and no ${VendorSource.skillFile} under "${VendorSource.skillsFolder}/", nor any charter under "${VendorSource.chartersFolder}/".`,
        `Check that the source holds "${CharterFolder.path}", charters under "${VendorSource.chartersFolder}/" each in a folder holding its "${CharterFolder.path}", or skills under "${VendorSource.skillsFolder}/" each in a folder holding its ${VendorSource.skillFile}, at the version asked for.`,
        { internal: false },
      );
    if (selectedCharterNames.length > 0 && heldCharterNames.length === 0)
      throw new VendorFault(
        `${sourceUri} holds no "${VendorSource.chartersFolder}/": it holds ${heldShapes.join(" and ")}.`,
        "Run this again without --charter.",
        { internal: false },
      );
    if (selectedSkillIds.length > 0 && !vendorSource.holdsSkills)
      throw new VendorFault(
        `${sourceUri} holds no "${VendorSource.skillsFolder}/": it holds ${heldShapes.join(" and ")}.`,
        "Run this again without --skill.",
        { internal: false },
      );

    const isTakingOwnCharter = holdsOwnCharter && selectedCharterNames.length === 0 && selectedSkillIds.length === 0;
    const pickedCharterNames =
      selectedCharterNames.length > 0
        ? selectedCharterNames
        : !holdsOwnCharter && selectedSkillIds.length === 0
          ? heldCharterNames
          : [];
    const isTakingSkills = selectedSkillIds.length > 0 || (!holdsOwnCharter && heldCharterNames.length === 0);

    // A charter that installed vendors of its own is refused (FR-170).
    const assertOneLevelDeep = (sourceCharter: SourceCharter) => {
      if (sourceCharter.holdsVendors)
        throw new VendorFault(
          `${sourceUri} holds "${sourceCharter.vendorsUri}", and vendoring is one level deep.`,
          `Remove "${sourceCharter.vendorsUri}" from the source, or install a version without it.`,
          { internal: false },
        );
    };

    if (isTakingOwnCharter) {
      assertOneLevelDeep(ownCharter);
      return new VendorSource(vendorSource.origin, vendorSource.commit, ownCharter, [], [], []);
    }

    const unheldCharterNames = pickedCharterNames.filter((charterName) => !heldCharterNames.includes(charterName));
    if (unheldCharterNames.length > 0)
      throw new VendorFault(
        `${sourceUri} holds no charter ${unheldCharterNames.join(", ")}.`,
        `Pick one it holds: ${heldCharterNames.join(", ")}.`,
        { internal: false },
      );
    const pickedCharters = vendorSource.charters.filter(({ name }) => pickedCharterNames.includes(name));
    for (const sourceCharter of pickedCharters) {
      if ((Primitives.kinds as readonly string[]).includes(sourceCharter.name))
        throw new VendorFault(
          `"${sourceCharter.uri}" is named as a kind is, and a charter is never installed under a kind's name.`,
          `Rename "${sourceCharter.uri}" in the source, then pick it again.`,
          { internal: false },
        );
      if (sourceCharter.name === ROOT_NAME)
        throw new VendorFault(
          `"${sourceCharter.uri}" is named "${ROOT_NAME}", and its vendor folder would be the one the source's own charter is installed in.`,
          `Rename "${sourceCharter.uri}" in the source, then pick it again.`,
          { internal: false },
        );
      if (!sourceCharter.holdsCharter)
        throw new VendorFault(
          `"${sourceCharter.uri}" holds no "${CharterFolder.path}".`,
          `Pick a charter whose folder holds "${CharterFolder.path}": ${heldCharterNames.filter((heldCharterName) => heldCharterName !== sourceCharter.name).join(", ")}.`,
          { internal: false },
        );
      assertOneLevelDeep(sourceCharter);
    }
    if (!isTakingSkills)
      return new VendorSource(vendorSource.origin, vendorSource.commit, undefined, pickedCharters, [], []);

    const [skillFault] = vendorSource.skillFaults;
    if (skillFault !== undefined) throw skillFault;
    const heldSkillIds = vendorSource.skills.map(({ convertedSkill }) => convertedSkill.headers.id);
    const sharedIdSkills = vendorSource.skills.filter(
      ({ convertedSkill }) => heldSkillIds.filter((skillId) => skillId === convertedSkill.headers.id).length > 1,
    );
    if (sharedIdSkills.length > 0)
      throw new VendorFault(
        `${sharedIdSkills.map(({ uri }) => uri).join(", ")} declare one name, and a name is one skill.`,
        "Take the skills from a version of the source whose names are its own.",
        { internal: false },
      );
    const unheldSkillIds = selectedSkillIds.filter((skillId) => !heldSkillIds.includes(skillId));
    if (unheldSkillIds.length > 0)
      throw new VendorFault(
        `${sourceUri} holds no skill ${unheldSkillIds.join(", ")}.`,
        `Take one it holds: ${heldSkillIds.join(", ")}.`,
        { internal: false },
      );
    const pickedSkills = vendorSource.skills
      .filter(
        ({ convertedSkill }) => selectedSkillIds.length === 0 || selectedSkillIds.includes(convertedSkill.headers.id),
      )
      .sort((leftSkill, rightSkill) =>
        leftSkill.convertedSkill.headers.id.localeCompare(rightSkill.convertedSkill.headers.id),
      );
    return new VendorSource(vendorSource.origin, vendorSource.commit, undefined, pickedCharters, pickedSkills, []);
  }

  /** The name each charter of a source filtered is installed as: the
   *  source's own under `root`, each kept apart under its own name
   *  (CORE-FR-196). */
  get rootName(): typeof ROOT_NAME {
    return ROOT_NAME;
  }

  /**
   * What installing a source filtered would do, decided and not yet done:
   * each charter's primitives copied whole, as the source holds them, the
   * source's own under `root` and each kept apart under its own name
   * (CORE-FR-042, CORE-FR-196); each skill's folder copied under `root` and
   * its index.md written as the skill it converts to, its `SKILL.md` taken
   * away once it is down (CORE-FR-186). Each replaces what stood there before
   * it, and nothing else (CORE-FR-189).
   */
  planInstall(vendorSource: VendorSource): ProjectionPlan<WritePlan | CopyPlan> {
    const primitivesFolderOf = (charterName: string) =>
      `${VendorsFolder.path}/${vendorSource.origin.name}/${charterName}/${VendorRoot.primitivesFolder}`;
    const projectionPlan: (WritePlan | CopyPlan)[] = [];
    const cleanupPlan: WritePlan[] = [];
    if (vendorSource.ownCharter !== undefined)
      projectionPlan.push(new CopyPlan(vendorSource.ownCharter.sourceFolder, primitivesFolderOf(ROOT_NAME)));
    for (const { name, sourceFolder } of vendorSource.charters)
      projectionPlan.push(new CopyPlan(sourceFolder, primitivesFolderOf(name)));
    for (const { convertedSkill, sourceFolder } of vendorSource.skills) {
      const skillFolder = `${primitivesFolderOf(ROOT_NAME)}/${SkillPrimitive.kind}/${convertedSkill.headers.id}`;
      const [indexPath, skillFilePath] = [
        `${skillFolder}/${SkillPrimitive.index}`,
        `${skillFolder}/${VendorSource.skillFile}`,
      ];
      projectionPlan.push(
        new CopyPlan(sourceFolder, skillFolder),
        new WritePlan(indexPath, indexPath, convertedSkill.toMarkdown()),
      );
      cleanupPlan.push(new WritePlan(skillFilePath, skillFilePath));
    }
    return new ProjectionPlan([], cleanupPlan, projectionPlan);
  }

  /** The plan put down off the commit of the source it was planned from, in
   *  order, then what it takes away. */
  async executePlan(
    vendorSource: VendorSource,
    projectionPlan: ProjectionPlan<WritePlan | CopyPlan>,
    charterRepository: ForManagingCharter,
  ): Promise<void> {
    await charterRepository.storeVendor(vendorSource, projectionPlan);
  }
}

/** The one InstallCharterService the composition root hands every use case that asks for it. */
export const installCharterService = new InstallCharterService();
