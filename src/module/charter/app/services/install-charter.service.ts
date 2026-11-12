import { CHARTER_FOLDER_PATH } from "../../domain/constants.js";
import { ReservedCharterNameFault, UnexpectedSourceShapeFault } from "../../domain/models/charter.fault.js";
import { Primitives } from "../../domain/models/primitive/primitive.js";
import { type SourceCharter, VendorSource } from "../../domain/models/vendor/vendor-source.js";

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
      ...(holdsOwnCharter ? [`a charter in "${CHARTER_FOLDER_PATH}"`] : []),
      ...(heldCharterNames.length > 0 ? [`charters under "${VendorSource.chartersFolder}/"`] : []),
      ...(vendorSource.holdsSkills ? [`skills under "${VendorSource.skillsFolder}/"`] : []),
    ];
    if (heldShapes.length === 0)
      throw new UnexpectedSourceShapeFault(
        `${sourceUri} has no "${CHARTER_FOLDER_PATH}" and no ${VendorSource.skillFile} under "${VendorSource.skillsFolder}/", nor any charter under "${VendorSource.chartersFolder}/".`,
        `Check that the source holds "${CHARTER_FOLDER_PATH}", charters under "${VendorSource.chartersFolder}/" each in a folder holding its "${CHARTER_FOLDER_PATH}", or skills under "${VendorSource.skillsFolder}/" each in a folder holding its ${VendorSource.skillFile}, at the version asked for.`,
        { internal: false },
      );
    if (selectedCharterNames.length > 0 && heldCharterNames.length === 0)
      throw new UnexpectedSourceShapeFault(
        `${sourceUri} holds no "${VendorSource.chartersFolder}/": it holds ${heldShapes.join(" and ")}.`,
        "Run this again without --charter.",
        { internal: false },
      );
    if (selectedSkillIds.length > 0 && !vendorSource.holdsSkills)
      throw new UnexpectedSourceShapeFault(
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
        throw new UnexpectedSourceShapeFault(
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
      throw new UnexpectedSourceShapeFault(
        `${sourceUri} holds no charter ${unheldCharterNames.join(", ")}.`,
        `Pick one it holds: ${heldCharterNames.join(", ")}.`,
        { internal: false },
      );
    const pickedCharters = vendorSource.charters.filter(({ name }) => pickedCharterNames.includes(name));
    for (const sourceCharter of pickedCharters) {
      if ((Primitives.kinds as readonly string[]).includes(sourceCharter.name))
        throw new ReservedCharterNameFault(
          `"${sourceCharter.uri}" is named as a kind is, and a charter is never installed under a kind's name.`,
          `Rename "${sourceCharter.uri}" in the source, then pick it again.`,
          { internal: false },
        );
      if (sourceCharter.name === VendorSource.ownCharterName)
        throw new ReservedCharterNameFault(
          `"${sourceCharter.uri}" is named "${VendorSource.ownCharterName}", and its vendor folder would be the one the source's own charter is installed in.`,
          `Rename "${sourceCharter.uri}" in the source, then pick it again.`,
          { internal: false },
        );
      if (!sourceCharter.holdsCharter)
        throw new UnexpectedSourceShapeFault(
          `"${sourceCharter.uri}" holds no "${CHARTER_FOLDER_PATH}".`,
          `Pick a charter whose folder holds "${CHARTER_FOLDER_PATH}": ${heldCharterNames.filter((heldCharterName) => heldCharterName !== sourceCharter.name).join(", ")}.`,
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
      throw new UnexpectedSourceShapeFault(
        `${sharedIdSkills.map(({ uri }) => uri).join(", ")} declare one name, and a name is one skill.`,
        "Take the skills from a version of the source whose names are its own.",
        { internal: false },
      );
    const unheldSkillIds = selectedSkillIds.filter((skillId) => !heldSkillIds.includes(skillId));
    if (unheldSkillIds.length > 0)
      throw new UnexpectedSourceShapeFault(
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
}

/** The one InstallCharterService the composition root hands every use case that asks for it. */
export const installCharterService = new InstallCharterService();
