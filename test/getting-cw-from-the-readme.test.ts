import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const readmeText = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const referenceText = readFileSync(new URL("../docs/reference.md", import.meta.url), "utf8");

/** The anchor a heading of the reference is linked by, as GitHub writes it. */
const anchorOf = (headingText: string) =>
  headingText
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");

test("the README gives the install from the registry as the way to get cw, the stable version and the next one, and building from source as the contributor's way (CORE Story 56 scenario 6, CORE Story 15 scenario 6, CORE-FR-247)", () => {
  const getStartedText = readmeText.slice(readmeText.indexOf("## Get started"));
  const firstCommandBlock = /```bash\n([^`]*)```/.exec(getStartedText)?.[1] ?? "";
  assert.deepEqual(
    firstCommandBlock
      .trim()
      .split("\n")
      .map((commandLine) => commandLine.replace(/\s*#.*$/, "")),
    ["npm install -g cherry-works", "npm install -g cherry-works@next"],
  );
  assert.match(readmeText, /^Current version: \*\*\d+\.\d+\.\d+\*\*$/m);
  assert.match(readmeText, /^Stable version: \*\*\d+\.\d+\.\d+\*\*$/m);

  // Every link from the README to building from source lands under the
  // reference's Development section, which is the contributor's.
  const sourceLinkAnchors = [...readmeText.matchAll(/\]\(docs\/reference\.md#([\w-]+)\)/g)]
    .map((linkMatch) => linkMatch[1]!)
    .filter((linkAnchor) => /development|checkout|source/.test(linkAnchor));
  const developmentStart = referenceText.indexOf("\n## Development\n");
  const developmentEnd = referenceText.indexOf("\n## ", developmentStart + 1);
  const developmentText = referenceText.slice(developmentStart, developmentEnd === -1 ? undefined : developmentEnd);
  const developmentAnchors = [...developmentText.matchAll(/^#{2,4} (.+)$/gm)].map((headingMatch) =>
    anchorOf(headingMatch[1]!),
  );

  assert.ok(sourceLinkAnchors.length > 0);
  for (const sourceLinkAnchor of sourceLinkAnchors)
    assert.ok(developmentAnchors.includes(sourceLinkAnchor), `#${sourceLinkAnchor} is not under Development`);
  assert.doesNotMatch(readmeText, /git clone|pnpm install|pnpm link/);
});
