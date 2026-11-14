import { DomainFault, UnsoundModelFault } from "../../../../shared/module.js";
import { vendorSourcePath } from "../../constants.js";
import { ContentHelper } from "../../helper.js";
import { InvalidSourceSkillFault } from "../charter.fault.js";
import { SkillPrimitive } from "../primitive/skill-primitive.js";
import type { RawVendorSource } from "./raw-vendor-source.js";
import { SourceSkill, VendorSource } from "./vendor-source.js";

/** The headers a `SKILL.md` declares that a charter skill holds, each under
 *  the charter's own name for it; every other is left out (CORE-FR-186). */
const CONVERTED_HEADERS = ["name", "description", "disable-model-invocation", "user-invocable"] as const;

/** Makes a source the engine reads out of what one commit of it holds. */
export class VendorSourceFactory {
  /**
   * Each skill converted to the skill the charter holds (CORE-FR-186): its
   * `name` the id and the one trigger, its `description` kept,
   * `disable-model-invocation` kept, `user-invocable: false` as
   * `disable-user-invocation: true`, and its body as written; every other
   * header left out, and named.
   *
   * A skill the charter cannot hold — no frontmatter, no name, no
   * description, a name that is no id — leaves a fault naming its file
   * (CORE-FR-192), held so that only taking skills is refused for it.
   */
  static create(rawVendorSource: RawVendorSource): VendorSource {
    const sourceSkills: SourceSkill[] = [];
    const skillFaults: DomainFault[] = [];
    for (const { text, assets, uri, sourceFolder } of rawVendorSource.rawSourceSkills) {
      try {
        const skillFrontmatter = ContentHelper.parseFrontmatter(text);
        if (skillFrontmatter === undefined)
          throw new InvalidSourceSkillFault(
            `${uri} opens with no "---" frontmatter block.`,
            `Take a skill whose ${vendorSourcePath.skillFileName} declares its name and description.`,
            { internal: false },
          );
        const { headers: skillHeaders, body } = skillFrontmatter;
        let convertedSkillPrimitive: SkillPrimitive;
        try {
          convertedSkillPrimitive = SkillPrimitive.of(
            {
              id: skillHeaders.name,
              description: skillHeaders.description,
              triggers: [skillHeaders.name],
              ...(skillHeaders["disable-model-invocation"] === true ? { "disable-model-invocation": true } : {}),
              ...(skillHeaders["user-invocable"] === false ? { "disable-user-invocation": true } : {}),
            },
            body,
          );
        } catch (raisedValue) {
          const faultMessages =
            raisedValue instanceof UnsoundModelFault
              ? raisedValue.faults.map((fault) => fault.message)
              : [`${raisedValue}`];
          throw new InvalidSourceSkillFault(
            `${uri} is no skill the charter can hold: ${faultMessages.join(" ")}`,
            `Take a skill whose ${vendorSourcePath.skillFileName} declares a "name" of lowercase words joined by "-", and a "description".`,
            { internal: false },
          );
        }
        const leftOutHeaders = Object.keys(skillHeaders).filter(
          (header) => !(CONVERTED_HEADERS as readonly string[]).includes(header),
        );
        sourceSkills.push(new SourceSkill(convertedSkillPrimitive, leftOutHeaders, assets, uri, sourceFolder));
      } catch (raisedValue) {
        // A `SKILL.md` not reading is that skill being wrong; anything else
        // is not ours to swallow.
        if (!(raisedValue instanceof DomainFault)) throw raisedValue;
        skillFaults.push(raisedValue);
      }
    }
    const { origin, commit, ownCharter, charters } = rawVendorSource;
    return new VendorSource(origin, commit, ownCharter, charters, sourceSkills, skillFaults);
  }

  private constructor() {}
}
