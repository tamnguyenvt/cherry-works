import { vendorSourcePath } from "../../domain/constants.js";
import { ReservedCharterNameFault, UnexpectedSourceShapeFault } from "../../domain/models/charter.fault.js";
import { Primitives } from "../../domain/models/primitive/primitive.js";
import { type SourceCharter, VendorSource } from "../../domain/models/vendor/vendor-source.js";

export class InstallCharterService {
  /**
   * What one source holds at the commit fetched, filtered to what is
   * installed of it, every refusal raised before anything is.
   *
   * A source is a vendor when it holds charters under `charters/` or skills
   * under `skills/`; what it keeps at its root, a charter of its own among it,
   * is its authors' and never read (CORE-FR-193). With neither
   * `selectedCharterNames` nor `selectedSkillIds`, every charter and every
   * skill it holds is taken, each skill converted (CORE-FR-185,
   * CORE-FR-186). `selectedCharterNames` takes the charters named alone and
   * `selectedSkillIds` the skills named alone, and both may be given; a flag
   * for a shape it does not hold is refused, saying which shapes it holds. A
   * source holding neither is no vendor, and refused (FR-042).
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
    } = vendorSource;

    const heldCharterNames = vendorSource.charters.map(({ name }) => name);
    const heldShapes = [
      ...(heldCharterNames.length > 0 ? [`charters under "${vendorSourcePath.chartersFolderPath}/"`] : []),
      ...(vendorSource.hasSkills ? [`skills under "${vendorSourcePath.skillsFolderPath}/"`] : []),
    ];
    if (heldShapes.length === 0)
      throw new UnexpectedSourceShapeFault(
        `${sourceUri} is no vendor: it holds no charter under "${vendorSourcePath.chartersFolderPath}/" and no ${vendorSourcePath.skillFileName} under "${vendorSourcePath.skillsFolderPath}/".`,
        `Check that the source holds charters under "${vendorSourcePath.chartersFolderPath}/" each in a folder holding its "${vendorSourcePath.ownCharterFolderPath}", or skills under "${vendorSourcePath.skillsFolderPath}/" each in a folder holding its ${vendorSourcePath.skillFileName}, at the version asked for.`,
        { internal: false },
      );
    if (selectedCharterNames.length > 0 && heldCharterNames.length === 0)
      throw new UnexpectedSourceShapeFault(
        `${sourceUri} holds no "${vendorSourcePath.chartersFolderPath}/": it holds ${heldShapes.join(" and ")}.`,
        "Run this again without --charter.",
        { internal: false },
      );
    if (selectedSkillIds.length > 0 && !vendorSource.hasSkills)
      throw new UnexpectedSourceShapeFault(
        `${sourceUri} holds no "${vendorSourcePath.skillsFolderPath}/": it holds ${heldShapes.join(" and ")}.`,
        "Run this again without --skill.",
        { internal: false },
      );

    const isPickingNothing = selectedCharterNames.length === 0 && selectedSkillIds.length === 0;
    const pickedCharterNames = isPickingNothing ? heldCharterNames : selectedCharterNames;
    const isTakingSkills = selectedSkillIds.length > 0 || (isPickingNothing && vendorSource.hasSkills);

    // A charter that installed vendors of its own is refused (FR-170).
    const assertOneLevelDeep = (sourceCharter: SourceCharter) => {
      if (sourceCharter.hasVendors)
        throw new UnexpectedSourceShapeFault(
          `${sourceUri} holds "${sourceCharter.vendorsUri}", and vendoring is one level deep.`,
          `Remove "${sourceCharter.vendorsUri}" from the source, or install a version without it.`,
          { internal: false },
        );
    };

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
      if (sourceCharter.name === vendorSourcePath.ownCharterName)
        throw new ReservedCharterNameFault(
          `"${sourceCharter.uri}" is named "${vendorSourcePath.ownCharterName}", and its vendor folder would be the one the source's skills are installed in.`,
          `Rename "${sourceCharter.uri}" in the source, then pick it again.`,
          { internal: false },
        );
      if (!sourceCharter.hasCharter)
        throw new UnexpectedSourceShapeFault(
          `"${sourceCharter.uri}" holds no "${vendorSourcePath.ownCharterFolderPath}".`,
          `Pick a charter whose folder holds "${vendorSourcePath.ownCharterFolderPath}": ${heldCharterNames.filter((heldCharterName) => heldCharterName !== sourceCharter.name).join(", ")}.`,
          { internal: false },
        );
      assertOneLevelDeep(sourceCharter);
    }
    if (!isTakingSkills) return new VendorSource(vendorSource.origin, vendorSource.commit, pickedCharters, [], []);

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
    return new VendorSource(vendorSource.origin, vendorSource.commit, pickedCharters, pickedSkills, []);
  }
}

/** The one InstallCharterService the composition root hands every use case that asks for it. */
export const installCharterService = new InstallCharterService();
