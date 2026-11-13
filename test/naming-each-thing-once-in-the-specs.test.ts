import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

const specFolderUrl = new URL("../specs/", import.meta.url);
/** Every spec of the set, by its file name. */
const specTextByFileName = new Map(
  readdirSync(specFolderUrl)
    .filter((fileName) => /^spec(-[a-z]+)?\.md$/.test(fileName))
    .map((fileName) => [fileName, readFileSync(new URL(fileName, specFolderUrl), "utf8")]),
);
/** What a spec says in words: its code spans, fenced blocks and link
 *  targets, which name the code and not a term, left out. */
const proseOf = (specText: string): string =>
  specText
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`\n]*`/g, "")
    .replace(/\]\([^)]*\)/g, "]");

/** Each term the specs use for a thing that has another, with the one term
 *  they use for it now. */
const termsSetAside = [
  { offTerm: /\bhosts?\b(?! name)/i, oneTerm: "agent — and, for a mixin, the primitive that pulls it in" },
  { offTerm: /\bagent providers?\b/i, oneTerm: "agent" },
  { offTerm: /\bplugins?\b/i, oneTerm: "the engine's adapters, or one adapter" },
  { offTerm: /\bthe charter's part\b/i, oneTerm: "authoring" },
  { offTerm: /\bcharter (files?|roots?)\b/i, oneTerm: "a primitive's file; the charter" },
  { offTerm: /\btool authors?\b/i, oneTerm: "integrator" },
  { offTerm: /\bsessions? logs?\b|\blogs? of (the )?sessions\b/i, oneTerm: "the sessions" },
  { offTerm: /\b(other )?tools? (build|depend)s? on\b|\bwrites a tool\b/i, oneTerm: "integrator" },
  { offTerm: /\b(logged|logging) for the operator\b|\boperator's logging\b/i, oneTerm: "diagnostics" },
  { offTerm: /\bharness\b(?! engineering)/i, oneTerm: "the engine; or, for what runs a command, the agent" },
  {
    offTerm: /\boutput folder\b|\bbuild's output\b|\bbuilt output\b|\boutput of a build\b/i,
    oneTerm: "the compiled output",
  },
];

test("every spec names each thing by one term, and no term names two things (CORE Story 53 scenario 3, CORE Story 55 scenario 21)", () => {
  const offTermPlaces = [...specTextByFileName].flatMap(([fileName, specText]) =>
    proseOf(specText)
      .split("\n")
      .flatMap((lineText, lineIndex) =>
        termsSetAside
          .filter(({ offTerm }) => offTerm.test(lineText))
          .map(({ offTerm, oneTerm }) => `${fileName}:${lineIndex + 1} ${lineText.match(offTerm)![0]} → ${oneTerm}`),
      ),
  );
  assert.deepEqual(offTermPlaces, []);
});

test("the Key Entities define the agent, the engine's adapters, the integrator, the log, the sessions, the engine, the workspace, the compiled output and the local output, each once (CORE Story 53 scenario 3, CORE Story 55 scenario 20)", () => {
  const keyEntityNames = [...specTextByFileName.values()].flatMap((specText) =>
    [...specText.matchAll(/^- \*\*([^*]+)\*\*:/gm)].map((entityMatch) =>
      entityMatch[1]!.toLowerCase().replace(/^the /, ""),
    ),
  );
  for (const entityName of [
    "agent",
    "engine's adapters",
    "integrator",
    "log",
    "sessions",
    "engine",
    "workspace",
    "compiled output",
    "local output",
  ])
    assert.equal(
      keyEntityNames.filter((keyEntityName) => keyEntityName === entityName).length,
      1,
      `the specs define ${entityName} ${keyEntityNames.filter((keyEntityName) => keyEntityName === entityName).length} times`,
    );
});
