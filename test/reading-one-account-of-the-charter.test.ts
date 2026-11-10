import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const coreSpecText = readFileSync(new URL("../specs/spec-core.md", import.meta.url), "utf8");
const evalSpecText = readFileSync(new URL("../specs/spec-eval.md", import.meta.url), "utf8");
const adrText = readFileSync(new URL("../specs/ADR.md", import.meta.url), "utf8");

/** The block under one heading, up to the next heading of the same rank or higher. */
const sectionTextOf = (specText: string, heading: string): string => {
  const startIndex = specText.indexOf(heading);
  assert.notEqual(startIndex, -1, heading);
  const headingRank = heading.match(/^#+/)?.[0].length ?? 0;
  const restText = specText.slice(startIndex + heading.length);
  const nextHeadingIndex = restText.search(new RegExp(`\\n#{1,${headingRank}} `));
  return specText.slice(startIndex, startIndex + heading.length + (nextHeadingIndex < 0 ? restText.length : nextHeadingIndex));
};

const storyTextOf = (heading: string): string => sectionTextOf(coreSpecText, heading);
const requirementTextOf = (requirementId: string): string => {
  const startIndex = coreSpecText.indexOf(`**${requirementId}**:`);
  assert.notEqual(startIndex, -1, requirementId);
  const lineEndIndex = coreSpecText.indexOf("\n", startIndex);
  return coreSpecText.slice(startIndex, lineEndIndex);
};

test("a story or an edge case about mixins and ids agrees with a body-only mixin and one id (CORE Story 40 scenario 1)", () => {
  const story26Text = storyTextOf("### CORE Story 26 -");
  const story26Scenario2Text = story26Text.slice(story26Text.indexOf("2. **Given** a guide and a skill of one id"), story26Text.indexOf("\n3. **Given**"));
  const mixinEdgeCaseText = coreSpecText.slice(coreSpecText.indexOf("- A mixin and its host"));
  const keptApartAnswerText = coreSpecText.slice(coreSpecText.indexOf("what keeps them apart now?"));
  const mcpNameAnswerText = coreSpecText.slice(coreSpecText.indexOf("Is the name of an `mcp` primitive its address?"), coreSpecText.indexOf("Is an mcp origin only"));

  assert.match(story26Scenario2Text, /collision two files claiming one id always are, naming both/);
  assert.equal(story26Scenario2Text.includes("they are two files, each in its host's folder for its kind"), false);
  assert.match(keptApartAnswerText, /same collision a skill and a playbook are/);
  assert.equal(keptApartAnswerText.slice(0, 400).includes("each in a folder of its own"), false);
  assert.equal(mcpNameAnswerText.includes("identity"), false);
  assert.equal(mcpNameAnswerText.includes("mcp:mfbs/billing"), false);
  assert.match(mcpNameAnswerText, /mfbs\/billing/);
  assert.match(mixinEdgeCaseText, /no field is merged: a mixin lends its body, not fields/);
  assert.equal(mixinEdgeCaseText.slice(0, 500).includes("the host wins"), false);
  assert.equal(mixinEdgeCaseText.slice(0, 500).includes("the values merge"), false);
  assert.match(requirementTextOf("CORE-FR-006"), /No field is merged: a mixin lends text, not fields/);
  assert.match(requirementTextOf("CORE-FR-015"), /An id MUST name one primitive in the whole charter, whatever its kind/);
});

test("health reporting and a guide with no globs agree on the three questions and a valid guide (CORE Story 40 scenario 2)", () => {
  const story6Text = storyTextOf("### CORE Story 6 -");
  const story7Text = storyTextOf("### CORE Story 7 -");
  const threeAnswersText = "which agents the repository chose, whether validation passes, and whether compiled output is out of date";

  const guideSentenceLineText = story6Text.slice(story6Text.indexOf("A guide with no globs is valid"), story6Text.indexOf("\n", story6Text.indexOf("A guide with no globs is valid")));

  assert.equal(story6Text.includes("a guide with no glob,"), false);
  assert.match(story6Text, /A guide with no globs is valid/);
  assert.match(guideSentenceLineText, /A guide with no globs is valid and comes up every turn/);
  assert.equal(story7Text.includes("four answers"), false);
  // How many answers there are is CORE-FR-080's to say, cited and not counted again.
  assert.equal(story7Text.includes("three answers"), false);
  assert.equal(story7Text.includes("vendors"), false);
  assert.equal(story7Text.includes("more than four primitives"), false);
  assert.equal(story7Text.includes(threeAnswersText), false);
  assert.equal(requirementTextOf("CORE-FR-121").includes(threeAnswersText), false);
  assert.match(story7Text, /the same answers `cw doctor` gives \(\[CORE-FR-080\]\(#core-fr-080\)\)/);
  assert.match(requirementTextOf("CORE-FR-121"), /the same answers `cw doctor` reports \(\[CORE-FR-080\]\(#core-fr-080\)\)/);
  assert.equal(requirementTextOf("CORE-FR-121").includes("four answers"), false);
  // The main context each chosen agent opens with is said beside the
  // answers, in the portal as in `cw doctor` (EVAL-FR-006).
  assert.match(story7Text, /main context each chosen agent opens a session with, against the ceiling \(\[EVAL-FR-006\]/);
  assert.match(story7Text, /the same main-context line per chosen agent \(\[EVAL-FR-006\]/);
  assert.match(requirementTextOf("CORE-FR-121"), /the same main-context line for each chosen agent \(\[EVAL-FR-006\]/);
  assert.match(requirementTextOf("CORE-FR-080"), /which agents the repository chose, whether validation passes, and whether compiled output is out of date/);
  assert.match(requirementTextOf("CORE-FR-081"), /say so rather than fail when the repository chose no agent/);
  assert.match(requirementTextOf("CORE-FR-081"), /MUST ask every one of its questions/);
  assert.match(requirementTextOf("CORE-FR-113"), /when that kind comes up, read off that kind's own contract/);
});

test("scope describes a primitive's folder, its binary assets and keeping a skill from the agent (CORE Story 40 scenario 3)", () => {
  const outOfScopeText = sectionTextOf(coreSpecText, "## Out of Scope");
  const skillFolderAnswerText = coreSpecText.slice(coreSpecText.indexOf("Does a skill become a folder"));
  const story4Text = storyTextOf("### CORE Story 4 -");
  const story4Scenario1Text = story4Text.slice(story4Text.indexOf("1. **Given** an initialized repository"), story4Text.indexOf("\n2. **Given**"));
  const primitiveEntityText = coreSpecText.slice(coreSpecText.indexOf("- **Primitive**:"), coreSpecText.indexOf("\n", coreSpecText.indexOf("- **Primitive**:")));

  assert.equal(outOfScopeText.includes("A skill kept as a folder holding its own files"), false);
  assert.equal(outOfScopeText.includes("kept as a template or among a script's files"), false);
  assert.equal(outOfScopeText.includes("Keeping a skill or a playbook from the agent itself"), false);
  assert.match(outOfScopeText, /A skill is a folder of its `index\.md` and its assets/);
  assert.match(outOfScopeText, /A binary file kept as an asset of a primitive, a script's files included, is copied whole/);
  assert.match(outOfScopeText, /kept from the agent with `disable-model-invocation: true`/);
  assert.match(skillFolderAnswerText, /It is a folder, as every primitive is/);
  assert.equal(coreSpecText.includes("A primitive is a markdown file with headers"), false);
  assert.equal(primitiveEntityText.includes("One authored markdown file"), false);
  assert.match(primitiveEntityText, /A folder `<kind>\/<id>` whose `index\.md` holds its headers/);
  assert.equal(story4Scenario1Text.includes("a markdown file appears"), false);
  assert.match(story4Scenario1Text, /`<kind>\/<id>\/index\.md` appears holding the answers and nothing else/);
  assert.equal(coreSpecText.includes("A skill kept as a folder of files would have needed"), false);
  assert.match(requirementTextOf("CORE-FR-168"), /Every file in a primitive's folder but its `index\.md`/);
  assert.match(requirementTextOf("CORE-FR-182"), /disable-model-invocation: true/);
  assert.match(requirementTextOf("CORE-FR-207"), /identical to its source, byte for byte/);
  assert.match(requirementTextOf("CORE-FR-208"), /MUST carry bytes as well as text/);
});

test("MCP serving and the catalogue agree on one entry, saved tools, a call and one name (CORE Story 40 scenario 4)", () => {
  const story16Text = storyTextOf("### CORE Story 16 -");
  const story19Text = storyTextOf("### CORE Story 19 -");
  const story20Text = storyTextOf("### CORE Story 20 -");
  const story21Text = storyTextOf("### CORE Story 21 -");
  const story27Text = storyTextOf("### CORE Story 27 -");
  const catalogueAnswerText = coreSpecText.slice(coreSpecText.indexOf("What does a catalogue entry hold?"));
  const noMcpEdgeCaseText = coreSpecText.slice(coreSpecText.indexOf("- A charter that declares no `mcp` primitive"));
  const unreachableEdgeCaseText = coreSpecText.slice(coreSpecText.indexOf("- An mcp origin the build cannot reach"));
  const story19OpeningText = story19Text.slice(0, story19Text.indexOf("**Why this priority**"));
  const story19IndependentTestText = story19Text.slice(story19Text.indexOf("**Independent Test**"), story19Text.indexOf("**Acceptance Scenarios**"));
  const story19Scenario1Text = story19Text.slice(story19Text.indexOf("1. **Given** a built charter"), story19Text.indexOf("\n2. **Given**"));
  const story19Scenario6Text = story19Text.slice(story19Text.indexOf("6. **Given** a tool an mcp declares"), story19Text.indexOf("\n7. **Given**"));
  const story20Scenario4Text = story20Text.slice(story20Text.indexOf("4. **Given** an `agent` whose `tools` lists an mcp"));
  const story27Scenario5Text = story27Text.slice(story27Text.indexOf("5. **Given** the catalogue"));
  const ontologyAnswerText = coreSpecText.slice(coreSpecText.indexOf("modelled as an ontology"), coreSpecText.indexOf("Does `cw` run a gateway"));
  const fewerOriginsAnswerText = coreSpecText.slice(coreSpecText.indexOf("Can a run be held to fewer"), coreSpecText.indexOf("### Session 2026-09-30"));
  const nameBecomesAnswerText = coreSpecText.slice(coreSpecText.indexOf("What does a name become where it is read?"), coreSpecText.indexOf("Which bodies are rewritten?"));
  const evalRequirementStartIndex = evalSpecText.indexOf("**EVAL-FR-031**:");
  assert.notEqual(evalRequirementStartIndex, -1, "EVAL-FR-031");
  const evalRequirementText = evalSpecText.slice(evalRequirementStartIndex, evalSpecText.indexOf("\n", evalRequirementStartIndex));

  assert.equal(coreSpecText.includes("catalog.json"), false);
  assert.match(story16Text, /catalogue\.json/);
  assert.match(story21Text, /catalogue\.json/);
  assert.match(coreSpecText, /one catalogue, `catalogue\.json`, and no reduced copy/);
  assert.match(catalogueAnswerText, /Kind, id, description, file, and globs where the primitive names any/);
  assert.equal(catalogueAnswerText.slice(0, 500).includes("No id, since the identity says it"), false);
  assert.match(catalogueAnswerText, /`cw list` says the id, the description, the file and the files it applies to/);
  assert.equal(catalogueAnswerText.includes("the same fields"), false);
  assert.match(noMcpEdgeCaseText, /the build still writes the one `cw` entry/);
  assert.equal(coreSpecText.includes("fails to start and is left out"), false);
  assert.match(sectionTextOf(coreSpecText, "### Edge Cases"), /each stops the build, naming the mcp's file, and writes nothing/);
  assert.equal(story19Text.includes("when the server starts"), false);
  assert.equal(story19Text.includes("stops it when the server stops"), false);
  assert.match(story19Text, /no mcp origin is reached/);
  assert.match(story19Text, /stops it once the call has been answered/);
  assert.match(story19OpeningText, /the tools the build kept that each mcp origin's ids declare/);
  assert.equal(story19OpeningText.includes("the tools the charter declared"), false);
  assert.match(story19IndependentTestText, /the tools the build kept that those ids declare/);
  assert.equal(story19IndependentTestText.includes("exactly the declared ones"), false);
  assert.match(story19Scenario1Text, /the tools the build kept that those ids declare/);
  assert.equal(story19Scenario1Text.includes("exactly the declared tools"), false);
  assert.match(story19Scenario6Text, /its mcp origin does not list/);
  assert.match(story19Scenario6Text, /the build stops, naming the mcp's file/);
  // One Given, one When, one Then to each scenario.
  for (const scenarioLine of story19Text.split("\n").filter((storyLine) => /^\d+\. \*\*Given\*\*/.test(storyLine))) {
    assert.equal(scenarioLine.split("**Given**").length, 2, scenarioLine);
  }
  const unreachableEdgeCaseLineText = unreachableEdgeCaseText.slice(0, unreachableEdgeCaseText.indexOf("\n"));
  assert.match(unreachableEdgeCaseLineText, /not signed in to/);
  assert.equal(unreachableEdgeCaseLineText.includes("and a command"), false);
  assert.match(unreachableEdgeCaseLineText, /or a command that is not installed, each stops the build, naming the mcp's file, and writes nothing/);
  assert.match(ontologyAnswerText, /there is no header for it/);
  assert.match(ontologyAnswerText, /\[\[<id>\]\]/);
  assert.equal(ontologyAnswerText.includes("one header naming"), false);
  assert.match(requirementTextOf("CORE-FR-143"), /there is no header for it/);
  assert.equal(fewerOriginsAnswerText.includes("answers nothing"), false);
  assert.equal(fewerOriginsAnswerText.includes("mcp:<id>"), false);
  assert.match(fewerOriginsAnswerText, /answers why/);
  assert.match(fewerOriginsAnswerText, /\[\[<id>\]\]/);
  assert.match(nameBecomesAnswerText, /\[\[<id>\]\]/);
  assert.match(nameBecomesAnswerText, /only text/);
  assert.equal(story20Text.includes("answers nothing"), false);
  assert.match(story20Text, /must sign in/);
  assert.equal(story20Scenario4Text.includes("`mcp:`"), false);
  assert.match(story20Scenario4Text, /a `\[\[…\]\]` entry written neither as `\[\[<id>\]\]` nor as `\[\[<id>\]\]:<tool>`/);
  assert.match(story27Scenario5Text, /known by its id alone/);
  assert.equal(story27Scenario5Text.includes("known by its kind and its id"), false);
  assert.match(story27Scenario5Text, /its kind, its description, its file and its globs/);
  assert.match(evalRequirementText, /list what was kept without reaching the mcp origin/);
  assert.match(evalRequirementText, /reach it only for a call to one of its tools/);
  assert.match(evalRequirementText, /cannot reach or is not signed in to/);
  assert.match(evalRequirementText, /that its mcp origin does not list, MUST stop the build/);
  assert.match(requirementTextOf("CORE-FR-146"), /whether or not the charter declares an `mcp` primitive yet/);
  assert.match(requirementTextOf("CORE-FR-152"), /stopped once the call has been answered/);
  assert.equal(requirementTextOf("CORE-FR-152").includes("stopped when the server stops"), false);
  assert.match(requirementTextOf("CORE-FR-153"), /reaching no mcp origin/);
  assert.equal(requirementTextOf("CORE-FR-153").includes("when the server starts"), false);
  // The build stop is EVAL-FR-031's to say, cited here and not said again.
  assert.equal(requirementTextOf("CORE-FR-153").includes("MUST stop the build"), false);
  assert.match(requirementTextOf("CORE-FR-153"), /\(\[EVAL-FR-031\]\(spec-eval\.md#eval-fr-031\)\)\.$/);
  // An mcp origin is named in the body, with no header the way a corpus is (CORE-FR-143).
  assert.equal(coreSpecText.includes("the way it names the corpus it cites"), false);
  // Listing without reaching an origin is EVAL-FR-031's to say, cited here and not said again.
  assert.equal(requirementTextOf("CORE-FR-154").includes("listing reaches no mcp origin"), false);
  assert.match(requirementTextOf("CORE-FR-154"), /answers why and the next move \(\[EVAL-FR-031\]\(spec-eval\.md#eval-fr-031\)\)\.$/);
  assert.equal(requirementTextOf("CORE-FR-154").includes("listing leaves them out"), false);
  assert.match(requirementTextOf("CORE-FR-025"), /its kind, its id, its description/);
  assert.match(adrText, /kind, its id, its description, the file its body is in, and the files it applies to where it names any/);
  assert.equal(adrText.includes("Kind and id remain the only name"), false);
  assert.equal(storyTextOf("### CORE Story 27 -").includes("holds no identity"), false);
  assert.match(storyTextOf("### CORE Story 27 -"), /each catalogue entry is known by its id alone, with no `kind:id`/);
  assert.match(adrText, /The id remains the only name the primitive has; the kind is a field of its entry\./);
});
