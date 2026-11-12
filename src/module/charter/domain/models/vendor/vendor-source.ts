import type { DomainFault } from "../../../../shared/module.js";
import { ModelHelper } from "../../helper.js";
import type { AssetFile } from "../primitive/base-primitive.js";
import type { RawPrimitive } from "../primitive/raw-primitive.js";
import type { SkillPrimitive } from "../primitive/skill-primitive.js";
import type { VendorSourceOrigin } from "./vendor-source-origin.value-object.js";

/** The folder a source of many charters keeps them in, one folder each named
 *  by it, laid out as a single-charter source holds its one:
 *  `charters/<name>/.cw/charter/` (CORE-FR-195). */
const CHARTERS_FOLDER = "charters";
/** The name a source's own charter, and the skills taken from it, are
 *  installed under beside the charters picked from it. */
const OWN_CHARTER_NAME = "root";

/** The file a skills repository keeps each skill in, the way `npx skills add`
 *  reads one (CORE-FR-185). */
const SKILL_FILE = "SKILL.md";

/** The folder a skills repository keeps the skills it publishes in, the one
 *  `npx skills` looks in first; a `SKILL.md` anywhere else — a copy kept for the
 *  repository's own agent under `.claude/skills/`, say — is none of them
 *  (CORE-FR-185). */
const SKILLS_FOLDER = "skills";

/** One charter a source holds: its own, named by nothing, or one of many it
 *  keeps apart, named by its folder (CORE-FR-195); whether a charter is there
 *  at all, whether it installed vendors of its own (FR-170), and its
 *  primitives as the source keeps them. `uri` is where in the source it sits, and `vendorsUri` where its
 *  own vendors would, in the words of what read it: said back and never
 *  read. `sourceFolder` is where its primitives sit in the source, for what
 *  copies them. */
export class SourceCharter {
  constructor(
    readonly name: string,
    readonly holdsCharter: boolean,
    readonly holdsVendors: boolean,
    readonly rawPrimitives: readonly RawPrimitive[],
    readonly uri: string,
    readonly vendorsUri: string,
    readonly sourceFolder: string,
  ) {}

  /** The description one of its primitives declares, empty where it
   *  declares none. Shown, never refused: the charter is installed whole, as
   *  its source holds it (CORE-FR-196). */
  descriptionOf(rawPrimitive: RawPrimitive): string {
    try {
      const declaredDescription = ModelHelper.parseFrontmatter(rawPrimitive.text)?.headers.description;
      return typeof declaredDescription === "string" ? declaredDescription : "";
    } catch {
      // Headers that do not parse are the source's to fix; what is shown is
      // still where the primitive sits.
      return "";
    }
  }
}

/** One skill a skills repository keeps, converted (CORE-FR-185,
 *  CORE-FR-186): the skill it converts to, the headers its `SKILL.md`
 *  declares that the charter has no field for, every other file of its
 *  folder, where it sits in the source, said back and never read, and the
 *  folder it sits in, for what copies it. */
export class SourceSkill {
  constructor(
    readonly convertedSkill: SkillPrimitive,
    readonly leftOutHeaders: readonly string[],
    readonly assets: readonly AssetFile[],
    readonly uri: string,
    readonly sourceFolder: string,
  ) {}
}

/** What one commit of a source holds, read: its own charter, the charters it
 *  keeps apart, the skills it publishes, each converted, and why each skill
 *  that does not convert does not (CORE-FR-192, CORE-FR-193). `commit` is
 *  what was fetched, for what fetched it alone to read again. */
export class VendorSource {
  static get chartersFolder(): typeof CHARTERS_FOLDER {
    return CHARTERS_FOLDER;
  }

  static get ownCharterName(): typeof OWN_CHARTER_NAME {
    return OWN_CHARTER_NAME;
  }

  static get skillFile(): typeof SKILL_FILE {
    return SKILL_FILE;
  }

  static get skillsFolder(): typeof SKILLS_FOLDER {
    return SKILLS_FOLDER;
  }

  constructor(
    readonly origin: VendorSourceOrigin,
    readonly commit: string,
    readonly ownCharter: SourceCharter | undefined,
    readonly charters: readonly SourceCharter[],
    readonly skills: readonly SourceSkill[],
    /** Held rather than raised: a skill that does not convert refuses taking
     *  skills, and nothing else (CORE-FR-192). */
    readonly skillFaults: readonly DomainFault[],
  ) {}

  /** Whether it publishes any skill, converted or not (CORE-FR-185). */
  get holdsSkills(): boolean {
    return this.skills.length + this.skillFaults.length > 0;
  }
}
