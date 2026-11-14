import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

const repositoryUrl = new URL("../", import.meta.url);

/** The words retired for the agents a repository has: those are the agents it
 *  "chose", the one given by `--agent` is "named", and one a developer takes
 *  at a terminal is "picked" (EVAL-FR-033 – EVAL-FR-038), never the agents
 *  that "are compiled for". What this engine compiles for — the agent "a
 *  charter is compiled for" or "built for" — is another thing, and stays. */
const retiredAgentTerms = [
  /\b(un)?configured agents?\b/i,
  /\bselected agents?\b/i,
  /\b(selected|configured)Agents?\b/,
  /\b(repository|it) (compiles|builds) for\b/i,
  /\bagents? (the repository|it) (compiles|builds) for\b/i,
  /\brepository compiling for\b/i,
  /\bcompiles its charter for\b/i,
  /\benabled agents?\b/i,
  /\bagents are enabled\b/i,
  /\bagents (is|are) (not )?compiled for\b/i,
  /\b(is|are) not compiled for\b/i,
];

/** Every file under a folder of the repository whose name ends as one of
 *  `extensions`, by its path from the repository. */
const textPathsUnder = (folderPath: string, extensions: readonly string[]): string[] =>
  readdirSync(new URL(folderPath, repositoryUrl), { recursive: true, encoding: "utf8" })
    .filter((filePath) => extensions.some((extension) => filePath.endsWith(extension)))
    .map((filePath) => `${folderPath}${filePath}`);

/** What the engine's code, its docs and its charter's guides say, line by
 *  line. The `AGENTS.md` a build lays in `src/` is left out: it is the guides
 *  again, read here at their source. */
const lineTextsByPath = new Map(
  [
    ...textPathsUnder("src/", [".ts", ".tsx", ".md"]).filter((filePath) => !filePath.endsWith("/AGENTS.md")),
    ...textPathsUnder("docs/", [".md"]),
    ...textPathsUnder(".cw/charter/primitive/guide/", [".md"]),
  ].map((filePath) => [filePath, readFileSync(new URL(filePath, repositoryUrl), "utf8").split("\n")]),
);

/** What a spec says in its own words, line by line: its **Input**, the `Then:`
 *  lines after it and its `## Clarifications`, which quote the user and the
 *  retired words themselves, emptied where they stand. */
const specLineTextsByPath = new Map(
  readdirSync(new URL("specs/", repositoryUrl), { encoding: "utf8" })
    .filter((fileName) => /^spec-[a-z]+\.md$/.test(fileName))
    .map((fileName) => {
      let isInClarifications = false;
      const specLineTexts = readFileSync(new URL(`specs/${fileName}`, repositoryUrl), "utf8")
        .split("\n")
        .map((lineText) => {
          if (/^## /.test(lineText)) isInClarifications = lineText.startsWith("## Clarifications");
          return isInClarifications || /^(\*\*Input\*\*|Then:)/.test(lineText) ? "" : lineText;
        });
      return [`specs/${fileName}`, specLineTexts];
    }),
);

test("nothing calls the agents a repository chose configured, selected or what it compiles for (EVAL-FR-033 – EVAL-FR-038)", () => {
  const retiredTermPlaces = [...lineTextsByPath, ...specLineTextsByPath].flatMap(([filePath, lineTexts]) =>
    lineTexts.flatMap((lineText, lineIndex) =>
      retiredAgentTerms
        .filter((retiredAgentTerm) => retiredAgentTerm.test(lineText))
        .map((retiredAgentTerm) => `${filePath}:${lineIndex + 1} ${lineText.match(retiredAgentTerm)![0]}`),
    ),
  );
  assert.deepEqual(retiredTermPlaces, []);
});
