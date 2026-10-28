import { SkillPrimitive } from "../charter/primitive/SkillPrimitive.js";
import { VendorFault } from "../DomainFault.js";
import type { ForParsingYaml } from "../../../port/zdriven/ForParsingYaml.js";

/** The file a skills repository keeps each skill in, the way `npx skills add`
 *  reads one (CORE-FR-185). */
export const SKILL_FILE = "SKILL.md";

/** The folder a skills repository keeps the skills it publishes in, the one
 *  `npx skills` looks in first; a `SKILL.md` anywhere else — a copy kept for the
 *  repository's own agent under `.claude/skills/`, say — is none of them
 *  (CORE-FR-185). */
export const SKILLS_FOLDER = "skills";

/** The folder a source of many charters keeps them in, one folder each named
 *  by it, laid out as a single-charter source holds its one:
 *  `charters/<name>/.cw/charter/` (CORE-FR-195). */
export const CHARTERS_FOLDER = "charters";

/** How many folders under `skills/` a skill's folder may sit, as `npx skills`
 *  walks it: `skills/<name>/`, `skills/<group>/<name>/`, and one group more
 *  (CORE-FR-185). */
const SKILLS_FOLDER_DEPTH = 3;

/** Where a skills repository keeps what it depends on, never a skill of its
 *  own (CORE-FR-185). */
const DEPENDENCIES_FOLDER = "node_modules";

/** The headers a `SKILL.md` declares that a charter skill holds, each under
 *  the charter's own name for it; every other is left out (CORE-FR-186). */
const CONVERTED_HEADERS = ["name", "description", "disable-model-invocation", "user-invocable"] as const;

/**
 * One primitive a vendor source holds, as it would be installed and as the
 * developer is shown it before choosing (CORE-FR-194): its kind, id and
 * description, and the folder of the source it sits in, every file under that
 * folder its own.
 *
 * A charter's primitive is installed as the source holds it. A skill a skills
 * repository keeps in a `SKILL.md` is installed as the skill primitive it
 * converts to, and says which of its headers the charter has no field for
 * (CORE-FR-186).
 */
export class VendorPrimitive {
  constructor(
    readonly kind: string,
    readonly id: string,
    readonly description: string,
    readonly sourceFolder: string,
    readonly convertedSkill?: SkillPrimitive,
    readonly leftOutHeaders: readonly string[] = [],
  ) {}
}

/** The headers and the body of a markdown file opening with a `---`
 *  frontmatter block, or nothing for a file that does not. */
function frontmatterOf(markdown: string, parser: ForParsingYaml): { headers: Readonly<Record<string, unknown>>; body: string } | undefined {
  const lines = markdown.replace(/^﻿/, "").split(/\r?\n/);
  const frontmatterEnd = lines[0]?.trim() === "---" ? lines.findIndex((line, index) => index > 0 && line.trim() === "---") : -1;
  if (frontmatterEnd === -1) return undefined;
  return {
    headers: parser.parse(lines.slice(1, frontmatterEnd).join("\n")),
    body: lines.slice(frontmatterEnd + 1).join("\n").replace(/^(\s*\n)+/, "").trimEnd(),
  };
}

/** Every skill's `SKILL.md` of a source, by its path in it: each folder under
 *  `skills/`, at most three folders deep and under no `node_modules`, holding
 *  one. A folder holding one is a skill, so a `SKILL.md` below it is one of its
 *  files, never a skill of its own (CORE-FR-185). */
export function skillFilesOf(sourcePaths: readonly string[]): readonly string[] {
  const skillFolders = sourcePaths
    .filter((sourcePath) => sourcePath.startsWith(`${SKILLS_FOLDER}/`) && sourcePath.endsWith(`/${SKILL_FILE}`))
    .map((skillFile) => skillFile.slice(0, -`/${SKILL_FILE}`.length))
    .filter((skillFolder) => {
      const folderNames = skillFolder.split("/");
      return folderNames.length - 1 <= SKILLS_FOLDER_DEPTH && !folderNames.includes(DEPENDENCIES_FOLDER);
    });
  return skillFolders
    .filter((skillFolder) => !skillFolders.some((outerFolder) => skillFolder.startsWith(`${outerFolder}/`)))
    .map((skillFolder) => `${skillFolder}/${SKILL_FILE}`);
}

/**
 * One primitive of a charter source, off its `index.md` at
 * `<charter folder>/<kind>/<id>/index.md`: its kind and id where it sits, and
 * the description its headers declare, empty where they declare none. Shown,
 * never refused: the charter is installed whole, as its source holds it
 * (CORE-FR-196).
 */
export function charterVendorPrimitiveOf(indexMd: string, indexPath: string, charterFolder: string, parser: ForParsingYaml): VendorPrimitive {
  const sourceFolder = indexPath.slice(0, indexPath.lastIndexOf("/"));
  const [kind = "", ...idFolders] = sourceFolder.slice(charterFolder.length + 1).split("/");
  let description = "";
  try {
    const declaredDescription = frontmatterOf(indexMd, parser)?.headers.description;
    if (typeof declaredDescription === "string") description = declaredDescription;
  } catch {
    // Headers that do not parse are the source's to fix; what is shown is still
    // where the primitive sits.
  }
  return new VendorPrimitive(kind, idFolders.join("/"), description, sourceFolder);
}

/**
 * The skill one `SKILL.md` converts to (CORE-FR-186): its `name` the id and
 * the one trigger, its `description` kept, `disable-model-invocation` kept,
 * `user-invocable: false` as `disable-user-invocation: true`, and its body as
 * written. A skill the charter cannot hold — no name, no description, a name
 * that is no id — is refused naming the file (CORE-FR-192).
 */
export function skillVendorPrimitiveOf(skillMd: string, skillFile: string, parser: ForParsingYaml): VendorPrimitive {
  const skillFrontmatter = frontmatterOf(skillMd, parser);
  if (skillFrontmatter === undefined)
    throw new VendorFault(`${skillFile} opens with no "---" frontmatter block.`, `Take a skill whose ${SKILL_FILE} declares its name and description.`);
  const { headers: skillHeaders, body } = skillFrontmatter;

  try {
    const skillPrimitive = SkillPrimitive.of(
      {
        id: skillHeaders.name,
        description: skillHeaders.description,
        triggers: [skillHeaders.name],
        ...(skillHeaders["disable-model-invocation"] === true ? { "disable-model-invocation": true } : {}),
        ...(skillHeaders["user-invocable"] === false ? { "disable-user-invocation": true } : {}),
      },
      body,
    );
    return new VendorPrimitive(
      SkillPrimitive.kind,
      skillPrimitive.headers.id,
      skillPrimitive.headers.description,
      skillFile.slice(0, -SKILL_FILE.length).replace(/\/$/, ""),
      skillPrimitive,
      Object.keys(skillHeaders).filter((header) => !(CONVERTED_HEADERS as readonly string[]).includes(header)),
    );
  } catch (raised) {
    const faultMessages = raised instanceof AggregateError ? raised.errors.map((fault: Error) => fault.message) : [`${raised}`];
    throw new VendorFault(
      `${skillFile} is no skill the charter can hold: ${faultMessages.join(" ")}`,
      `Take a skill whose ${SKILL_FILE} declares a "name" of lowercase words joined by "-", and a "description".`,
    );
  }
}
