import { test } from "node:test";
import assert from "node:assert/strict";
import { Commander } from "../src/driver/cli/Commander.js";
import { COMMANDS } from "../src/driver/cli/commands/index.js";
import { EXIT_FAILURE, EXIT_OK } from "../src/driver/cli/commands/Command.js";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { CharterVendoring } from "../src/hexagon/application/CharterVendoring.js";
import { TestAuthoring } from "../src/hexagon/application/TestAuthoring.js";
import { primitiveOf } from "../src/hexagon/domain/models/charter/primitive/Primitive.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";
import { noMcpOriginsReached } from "./no-mcp-origins.js";
import { noSessionsKept } from "./no-sessions.js";
import { noEvaluationsRun } from "./no-evaluations.js";
import { noSensorsRun } from "./no-sensors.js";
import { InMemoryTokenCounter } from "../src/zdriven/InMemoryTokenCounter.js";
import { InMemoryAgentCli } from "../src/zdriven/InMemoryAgentCli.js";

const repoPath = new URL("file:///repo/");
const takenAt = (path: string) => new URL(`.cw/vendor/mattpocock/skills/${path}`, repoPath).href;

const skillMd = (headers: readonly string[], body = "Do it.") => ["---", ...headers, "---", "", body, ""].join("\n");

/** `mattpocock/skills` as a skills repository publishes it: two skills, one
 *  with an asset two folders down, and one under `node_modules` nobody takes. */
const mattpocockSkills = (): Record<string, string> => ({
  "skills/productivity/grill-me/SKILL.md": skillMd(
    ["name: grill-me", "description: A relentless interview to sharpen a plan or design.", "disable-model-invocation: true"],
    'Call the Skill tool with "grilling".',
  ),
  "skills/productivity/grill-me/agents/openai.yaml": "model: gpt\n",
  "skills/productivity/grilling/SKILL.md": skillMd(["name: grilling", "description: Grill the user relentlessly about a plan."], "Interview the user."),
  "node_modules/some-package/SKILL.md": skillMd(["name: some-package", "description: Not taken."]),
  "README.md": "# Skills\n",
});

/** One run of the command line over a repository and version control held in
 *  memory, and what it wrote. */
async function running(argv: readonly string[], held: InMemoryFileReaders, vcs: InMemoryVCS) {
  const said: string[] = [];
  const streams = [process.stdout, process.stderr] as const;
  const kept = streams.map((stream) => stream.write);
  for (const stream of streams)
    stream.write = ((text: string) => {
      said.push(String(text));
      return true;
    }) as typeof stream.write;
  try {
    const context = {
      cwd: "/repo",
      version: "0.0.0",
      charterAuthoringApp: new CharterAuthoring(repoPath, held, new YamlParser(), new InMemoryFileOutput(held), vcs, new InMemoryTokenCounter(), { claude: new InMemoryAgentCli() }),
      charterVendoringApp: new CharterVendoring(repoPath, held, vcs, new InMemoryFileOutput(held), new YamlParser()),
      testAuthoringApp: new TestAuthoring(repoPath, held, new InMemoryFileOutput(held)),
      mcpConnectingApp: noMcpOriginsReached, sessionReviewingApp: noSessionsKept, charterEvaluatingApp: noEvaluationsRun, sensorRunningApp: noSensorsRun,
    };
    const code = await new Commander(context, COMMANDS).run(argv);
    return { code, said: said.join("") };
  } finally {
    streams.forEach((stream, index) => (stream.write = kept[index] as typeof stream.write));
  }
}

/** A repository holding nothing yet, the files it is held in and version
 *  control over them, with `mattpocock/skills` published. */
function withSkillsPublished(sourceFiles: Record<string, string> = mattpocockSkills(), heldFiles: Record<string, string> = {}) {
  const held = new InMemoryFileReaders(heldFiles);
  const vcs = new InMemoryVCS(true, true, held);
  vcs.sourceFilesBySource["mattpocock/skills"] = sourceFiles;
  return { held, vcs };
}

/** The primitive a taken skill's index.md reads back as. */
const takenPrimitive = async (held: InMemoryFileReaders, skillId: string) => primitiveOf(await held.read(new URL(takenAt(`skill/${skillId}/index.md`))), new YamlParser());

test("a skill named is taken from a skills repository into its owner and repository's vendor folder, and nothing is built (CORE-FR-184, CORE-FR-185, CORE-SC-049)", async () => {
  const { held, vcs } = withSkillsPublished();

  const { code, said } = await running(["vendor", "add", "mattpocock/skills", "--skill", "grill-me"], held, vcs);

  assert.equal(code, EXIT_OK, said);
  assert.equal((await takenPrimitive(held, "grill-me")).headers.id, "grill-me");
  await assert.rejects(() => held.read(new URL(takenAt("skill/grilling/index.md"))), "only the skill named is taken");
  await assert.rejects(() => held.read(new URL(takenAt("skill/grill-me/SKILL.md"))), "the SKILL.md is converted, not kept beside it");
  assert.match(said, /grill-me/);
  assert.match(said, /\.cw\/vendor\/mattpocock\/skills/);
  assert.match(said, /cw build/);
  assert.equal(vcs.removed.length, 0);
});

test("a SKILL.md is converted: its name the id and the one trigger, its description kept, disable-model-invocation kept, its body as written (CORE-FR-186)", async () => {
  const { held, vcs } = withSkillsPublished();

  await running(["vendor", "add", "mattpocock/skills", "--skill", "grill-me"], held, vcs);

  const primitive = await takenPrimitive(held, "grill-me");
  assert.equal(primitive.kind, "skill");
  assert.deepEqual(primitive.headers, {
    id: "grill-me",
    description: "A relentless interview to sharpen a plan or design.",
    triggers: ["grill-me"],
    "disable-model-invocation": true,
  });
  assert.equal(primitive.body, 'Call the Skill tool with "grilling".');
});

test("user-invocable: false is kept as disable-user-invocation: true, and every header the charter has no field for is left out and named (CORE-FR-186)", async () => {
  const { held, vcs } = withSkillsPublished({
    "skills/step/SKILL.md": skillMd(["name: step", "description: One step.", "user-invocable: false", "license: MIT", "allowed-tools: Read"]),
  });

  const { code, said } = await running(["vendor", "add", "mattpocock/skills"], held, vcs);

  assert.equal(code, EXIT_OK, said);
  assert.deepEqual((await takenPrimitive(held, "step")).headers, {
    id: "step",
    description: "One step.",
    triggers: ["step"],
    "disable-user-invocation": true,
  });
  assert.match(said, /license/);
  assert.match(said, /allowed-tools/);
});

test("every file beside a SKILL.md arrives as an asset of the primitive, at the same path (CORE-FR-187)", async () => {
  const { held, vcs } = withSkillsPublished();

  await running(["vendor", "add", "mattpocock/skills", "--skill", "grill-me"], held, vcs);

  assert.equal(await held.read(new URL(takenAt("skill/grill-me/agents/openai.yaml"))), "model: gpt\n");
});

test("a skills repository given with no --skill has every skill it holds taken, but none under node_modules (CORE-FR-185, CORE-FR-188)", async () => {
  const { held, vcs } = withSkillsPublished();

  const { code } = await running(["vendor", "add", "mattpocock/skills"], held, vcs);

  assert.equal(code, EXIT_OK);
  assert.equal((await takenPrimitive(held, "grill-me")).headers.id, "grill-me");
  assert.equal((await takenPrimitive(held, "grilling")).headers.id, "grilling");
  await assert.rejects(() => held.read(new URL(takenAt("skill/some-package/index.md"))));
});

test("a --skill the source does not hold installs nothing, naming the skills it holds (CORE-FR-188)", async () => {
  const { held, vcs } = withSkillsPublished();

  const { code, said } = await running(["vendor", "add", "mattpocock/skills", "--skill", "grill-me", "--skill", "nothing-here"], held, vcs);

  assert.equal(code, EXIT_FAILURE);
  assert.match(said, /nothing-here/);
  assert.match(said, /grill-me, grilling/);
  await assert.rejects(() => held.read(new URL(takenAt("skill/grill-me/index.md"))));
});

test("taking one skill leaves the others in its folder as they were, and taking one again replaces it whole (CORE-FR-189)", async () => {
  const { held, vcs } = withSkillsPublished();
  await running(["vendor", "add", "mattpocock/skills", "--skill", "grill-me"], held, vcs);
  held.write(new URL(takenAt("skill/grill-me/stale.md")), "From before.\n");

  await running(["vendor", "add", "mattpocock/skills", "--skill", "grilling"], held, vcs);
  assert.equal(await held.read(new URL(takenAt("skill/grill-me/stale.md"))), "From before.\n");
  assert.equal((await takenPrimitive(held, "grilling")).headers.id, "grilling");

  await running(["vendor", "add", "mattpocock/skills", "--skill", "grill-me"], held, vcs);
  await assert.rejects(() => held.read(new URL(takenAt("skill/grill-me/stale.md"))));
  assert.equal((await takenPrimitive(held, "grill-me")).headers.id, "grill-me");
});

test("a folder holding a charter takes no skill, and a folder holding taken skills takes no charter (CORE-FR-191)", async () => {
  const charterHeld = withSkillsPublished(mattpocockSkills(), { [takenAt("README.md")]: "# A charter\n", [takenAt("guide/no-any/index.md")]: "x" });

  const skillsOverCharter = await running(["vendor", "add", "mattpocock/skills"], charterHeld.held, charterHeld.vcs);

  assert.equal(skillsOverCharter.code, EXIT_FAILURE);
  assert.match(skillsOverCharter.said, /\.cw\/vendor\/mattpocock\/skills/);
  await assert.rejects(() => charterHeld.held.read(new URL(takenAt("skill/grill-me/index.md"))));

  const skillsHeld = withSkillsPublished({ ".cw/charter/guide/no-any/index.md": "x" }, { [takenAt("skill/grill-me/index.md")]: "x" });

  const charterOverSkills = await running(["vendor", "add", "mattpocock/skills"], skillsHeld.held, skillsHeld.vcs);

  assert.equal(charterOverSkills.code, EXIT_FAILURE);
  assert.match(charterOverSkills.said, /\.cw\/vendor\/mattpocock\/skills/);
  assert.deepEqual(skillsHeld.vcs.checkedOut, []);
});

test("a SKILL.md with no description, a name that is no id, or a name two folders declare installs nothing, naming the files (CORE-FR-192)", async () => {
  for (const [sourceFiles, namedFile] of [
    [{ "skills/a/SKILL.md": skillMd(["name: a"]) }, "skills/a/SKILL.md"],
    [{ "skills/b/SKILL.md": skillMd(["description: No name."]) }, "skills/b/SKILL.md"],
    [{ "skills/c/SKILL.md": skillMd(["name: Not An Id", "description: Spaced."]) }, "skills/c/SKILL.md"],
    [{ "skills/d/SKILL.md": skillMd(["name: same", "description: One."]), "skills/other/d/SKILL.md": skillMd(["name: same", "description: Two."]) }, "skills/other/d/SKILL.md"],
  ] as const) {
    const { held, vcs } = withSkillsPublished(sourceFiles);

    const { code, said } = await running(["vendor", "add", "mattpocock/skills"], held, vcs);

    assert.equal(code, EXIT_FAILURE, namedFile);
    assert.match(said, new RegExp(namedFile.replace(/\./g, "\\.")), namedFile);
    assert.deepEqual(await held.readFilesRecursively(new URL(".cw/vendor/", repoPath)), [], namedFile);
  }
});

test("a source that cannot be reached is refused in git's words, and work in hand does not stop a skill being taken (CORE-FR-190)", async () => {
  const unreachable = withSkillsPublished();
  unreachable.vcs.unreachableSources.push("mattpocock/skills");

  const refused = await running(["vendor", "add", "mattpocock/skills"], unreachable.held, unreachable.vcs);

  assert.equal(refused.code, EXIT_FAILURE);
  assert.match(refused.said, /could not be fetched/);

  const held = new InMemoryFileReaders({});
  const workInHand = new InMemoryVCS(true, false, held);
  workInHand.sourceFilesBySource["mattpocock/skills"] = mattpocockSkills();

  const taken = await running(["vendor", "add", "mattpocock/skills", "--skill", "grill-me"], held, workInHand);

  assert.equal(taken.code, EXIT_OK, taken.said);
  assert.equal((await takenPrimitive(held, "grill-me")).headers.id, "grill-me");
});

test("a charter source given --skill takes only the skills named, and given none is installed whole, as before, its skill folders not taken (CORE-FR-193)", async () => {
  const charterSource = { ".cw/charter/guide/no-any/index.md": "x", "skills/grill-me/SKILL.md": skillMd(["name: grill-me", "description: Grill."]) };
  const withSkill = withSkillsPublished(charterSource);

  const taken = await running(["vendor", "add", "mattpocock/skills", "--skill", "grill-me"], withSkill.held, withSkill.vcs);

  assert.equal(taken.code, EXIT_OK, taken.said);
  assert.deepEqual(withSkill.vcs.checkedOut.map(({ fromFolder, intoSubFolder }) => [fromFolder, intoSubFolder]), [["skills/grill-me", ".cw/vendor/mattpocock/skills/skill/grill-me"]]);

  const withoutSkill = withSkillsPublished(charterSource);

  const installed = await running(["vendor", "add", "mattpocock/skills"], withoutSkill.held, withoutSkill.vcs);

  assert.equal(installed.code, EXIT_OK, installed.said);
  assert.deepEqual(withoutSkill.vcs.checkedOut.map(({ fromFolder, intoSubFolder }) => [fromFolder, intoSubFolder]), [[".cw/charter", ".cw/vendor/mattpocock/skills"]]);
  assert.equal(await withoutSkill.held.read(new URL(takenAt("README.md"))).catch(() => undefined), undefined, "the source published no README");
  await assert.rejects(() => withoutSkill.held.read(new URL(takenAt("skill/grill-me/index.md"))));
});

test("a skill is looked for under skills/ alone: copies kept for agents and SKILL.md files elsewhere are no skills, and clash with none (CORE-FR-185)", async () => {
  const { held, vcs } = withSkillsPublished({
    "skills/hyperframes-registry/SKILL.md": skillMd(["name: hyperframes-registry", "description: The registry."], "Read ./references/blocks.md."),
    "skills/hyperframes-registry/references/blocks.md": "# Blocks\n",
    ".claude/skills/seam-craft/SKILL.md": skillMd(["name: seam-craft", "description: For the repository's own agent."]),
    ".agents/skills/seam-craft/SKILL.md": skillMd(["name: seam-craft", "description: For the repository's own agent."]),
    "registry/blocks/orbit-card/SKILL.md": skillMd(["name: orbit-card", "description: A block."]),
    "SKILL.md": skillMd(["name: at-the-root", "description: At the root."]),
  });

  const { code, said } = await running(["vendor", "add", "mattpocock/skills"], held, vcs);

  assert.equal(code, EXIT_OK, said);
  assert.deepEqual(vcs.checkedOut.map(({ fromFolder }) => fromFolder), ["skills/hyperframes-registry"]);
  assert.equal(await held.read(new URL(takenAt("skill/hyperframes-registry/references/blocks.md"))), "# Blocks\n");
});

test("a skill is looked for at most three folders under skills/, and nothing below a skill's folder is another skill (CORE-FR-185)", async () => {
  const { held, vcs } = withSkillsPublished({
    "skills/one/SKILL.md": skillMd(["name: one", "description: One."]),
    "skills/one/examples/inner/SKILL.md": skillMd(["name: inner", "description: An example of one."]),
    "skills/group/two/SKILL.md": skillMd(["name: two", "description: Two."]),
    "skills/a/b/three/SKILL.md": skillMd(["name: three", "description: Three."]),
    "skills/a/b/c/four/SKILL.md": skillMd(["name: four", "description: Too deep."]),
  });

  const { code, said } = await running(["vendor", "add", "mattpocock/skills"], held, vcs);

  assert.equal(code, EXIT_OK, said);
  assert.deepEqual(vcs.checkedOut.map(({ fromFolder }) => fromFolder), ["skills/one", "skills/a/b/three", "skills/group/two"]);
  assert.equal(await held.read(new URL(takenAt("skill/one/examples/inner/SKILL.md"))), skillMd(["name: inner", "description: An example of one."]), "an inner SKILL.md is an asset of the skill above it");
});

test("a source holding no charter folder and no SKILL.md is refused, installing nothing (CORE-FR-042)", async () => {
  const { held, vcs } = withSkillsPublished({ "README.md": "# Notes\n", "SKILL.md": skillMd(["name: at-the-root", "description: Not under skills/."]) });

  const { code, said } = await running(["vendor", "add", "mattpocock/skills"], held, vcs);

  assert.equal(code, EXIT_FAILURE);
  assert.match(said, /no "\.cw\/charter" and no SKILL\.md/);
  assert.deepEqual(vcs.checkedOut, []);
});

test("a source is fetched once, and what is installed is read off that one commit (CORE-FR-184)", async () => {
  const { held, vcs } = withSkillsPublished();

  await running(["vendor", "add", "mattpocock/skills", "--ref", "v1", "--skill", "grill-me"], held, vcs);

  assert.deepEqual(vcs.fetched, [{ source: "mattpocock/skills", version: "v1" }], "fetched once");
  assert.deepEqual(vcs.checkedOut.map(({ commit }) => commit), ["mattpocock/skills@v1"]);
});
