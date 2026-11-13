import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const specFileNames = ["spec-core.md", "spec-sdk.md", "spec-eval.md"];
const specTexts = specFileNames.map((specFileName) =>
  readFileSync(new URL(`../specs/${specFileName}`, import.meta.url), "utf8"),
);

const requirementIdPattern = /\b(?:CORE|SDK|EVAL)-(?:FR|SC)-\d{3}\b/g;
const definedRequirementIds = new Set(
  specTexts.flatMap((specText) =>
    [...specText.matchAll(/\*\*((?:CORE|SDK|EVAL)-(?:FR|SC)-\d{3})\*\*:/g)].map(
      (definitionMatch) => definitionMatch[1]!,
    ),
  ),
);
const functionalRequirementIds = [...definedRequirementIds].filter((requirementId) => requirementId.includes("-FR-"));

/** Every numbered Given/When/Then line of the stories of every spec. */
const scenarioLines = specTexts.flatMap((specText) =>
  specText
    .slice(specText.indexOf("## User Scenarios"), specText.indexOf("### Edge Cases"))
    .split("\n")
    .filter((specLine) => /^\d+\. \*\*Given\*\*/.test(specLine)),
);
/** Every bulleted line under Edge Cases of every spec. */
const edgeCaseLines = specTexts.flatMap((specText) =>
  specText
    .slice(specText.indexOf("### Edge Cases"), specText.indexOf("## Requirements"))
    .split("\n")
    .filter((specLine) => specLine.startsWith("- ")),
);
const citedIdsOf = (specLine: string): string[] =>
  [...specLine.matchAll(requirementIdPattern)].map((citationMatch) => citationMatch[0]);

test("every acceptance scenario cites a requirement that is defined (CORE Story 41 scenario 1)", () => {
  const uncitedScenarioLines = scenarioLines.filter((scenarioLine) => citedIdsOf(scenarioLine).length === 0);
  const undefinedCitations = scenarioLines
    .flatMap(citedIdsOf)
    .filter((requirementId) => !definedRequirementIds.has(requirementId));

  assert.ok(scenarioLines.length > 300, `${scenarioLines.length} scenarios read`);
  assert.deepEqual(uncitedScenarioLines, []);
  assert.deepEqual(undefinedCitations, []);
});

test("every functional requirement is cited by a scenario, not only mentioned (CORE Story 41 scenario 2, CORE Story 56 scenario 6)", () => {
  const scenarioCitedIds = new Set(scenarioLines.flatMap(citedIdsOf));
  const unprovenRequirementIds = functionalRequirementIds.filter(
    (requirementId) => !scenarioCitedIds.has(requirementId),
  );

  assert.ok(functionalRequirementIds.length > 250, `${functionalRequirementIds.length} FR read`);
  assert.deepEqual(unprovenRequirementIds, []);
});

test("every edge case cites a functional requirement that answers it (CORE Story 41 scenario 3)", () => {
  const unansweredEdgeCaseLines = edgeCaseLines.filter(
    (edgeCaseLine) => !citedIdsOf(edgeCaseLine).some((requirementId) => requirementId.includes("-FR-")),
  );
  const undefinedCitations = edgeCaseLines
    .flatMap(citedIdsOf)
    .filter((requirementId) => !definedRequirementIds.has(requirementId));

  assert.ok(edgeCaseLines.length > 90, `${edgeCaseLines.length} edge cases read`);
  assert.deepEqual(unansweredEdgeCaseLines, []);
  assert.deepEqual(undefinedCitations, []);
});
