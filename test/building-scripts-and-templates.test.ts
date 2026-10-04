import { test } from "node:test";
import assert from "node:assert/strict";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";
import type { DataDTOs } from "../src/hexagon/port/driver/dtos/index.js";
import { InMemoryTokenCounter } from "../src/zdriven/InMemoryTokenCounter.js";
import { InMemoryAgentCli } from "../src/zdriven/InMemoryAgentCli.js";

const repo = new URL("file:///repo/");
const root = new URL(".cw/charter/", repo);

const at = (path: string) => new URL(path, root).href;
const inRepo = (path: string) => new URL(path, repo).href;

const primitive = (kind: string, id: string, headers: readonly string[], body: string) =>
  ["---", `kind: ${kind}`, `id: ${id}`, `description: What ${id} is for, in one line.`, ...headers, "---", "", body, ""].join("\n");

const runFile = ["#!/usr/bin/env bash", "set -euo pipefail", 'grep -q "## $1" CHANGELOG.md'].join("\n");
const releaseNote = ["# Release {{version}}", "", "  - indented on purpose"].join("\n");

/** A script as it is kept: its index.md, and its assets beside it, of which
 *  `run.sh` is the one that runs. */
const script = (id: string, assets: Readonly<Record<string, string>> = { "run.sh": runFile }, body = "Takes the version as its one argument.") => ({
  [at(`script/${id}/index.md`)]: primitive("script", id, ["executionPath: ./run.sh"], body),
  ...Object.fromEntries(Object.entries(assets).map(([path, contents]) => [at(`script/${id}/${path}`), contents])),
});
const template = (id: string, body = releaseNote) => primitive("template", id, [], body);
const skillNaming = (...names: readonly string[]) =>
  primitive("skill", "release", ['triggers: ["release"]'], `Use ${names.join(" and ")} before tagging.`);

/** A charter on files a build both reads and writes, with what it made
 *  executable kept beside them. */
const building = (files: Readonly<Record<string, string>>) => {
  const held = new InMemoryFileReaders(files);
  const fileOutput = new InMemoryFileOutput(held);
  const charterAuthoringApp = new CharterAuthoring(repo, held, new YamlParser(), fileOutput, new InMemoryVCS(), new InMemoryTokenCounter(), { claude: new InMemoryAgentCli() });
  return { held, fileOutput, charterAuthoringApp, build: () => charterAuthoringApp.build() };
};

const filesOf = (planSummaryDTO: DataDTOs.PlanSummary | DataDTOs.FaultsByFile): DataDTOs.PlanSummary["data"] => {
  assert.ok(planSummaryDTO.type === "PlanSummary", "this build was refused, and the test expected it to run");
  return planSummaryDTO.data;
};

const faultsOf = (planSummaryDTO: DataDTOs.PlanSummary | DataDTOs.FaultsByFile): DataDTOs.FaultsByFile["data"] => {
  assert.ok(planSummaryDTO.type === "FaultsByFile", "this build ran, and the test expected it to be refused");
  return planSummaryDTO.data;
};

const errorsUnder = (faultsByFile: DataDTOs.FaultsByFile["data"], fileEnding: string) =>
  (Object.entries(faultsByFile.files).find(([file]) => file.endsWith(fileEnding))?.[1] ?? [])
    .filter((fault) => fault.data.severity === "error")
    .map((fault) => fault.data.message);

test("a template is compiled like any other primitive, its headers then its body, as the index.md of its folder (FR-159)", async () => {
  const { held, build } = building({
    [at("template/release-note/index.md")]: template("release-note"),
    [at("skill/release/index.md")]: skillNaming("[[release-note]]"),
  });

  const built = filesOf(await build());

  assert.ok(built.added.includes(".cw/out/template/release-note/index.md"));
  const compiledDocument = await held.read(new URL(".cw/out/template/release-note/index.md", repo));
  assert.match(compiledDocument, /^---\nkind: template\nid: release-note\n/);
  // Indentation on a line of the body is the author's, and comes through.
  assert.ok(compiledDocument.includes(releaseNote));
});
test("every asset of a primitive is copied beside its compiled document byte for byte, whatever its kind (FR-168)", async () => {
  const { held, build } = building({
    ...script("check-changelog", { "run.sh": runFile, "lib/versions.sh": "latest() { :; }\n", "README.md": "How it is laid out.\n" }),
    [at("skill/release/index.md")]: skillNaming("[[check-changelog]]"),
    [at("skill/release/checklist.md")]: "1. Check the changelog.\n",
  });

  const built = filesOf(await build());

  assert.equal(await held.read(new URL(".cw/out/script/check-changelog/run.sh", repo)), runFile);
  assert.equal(await held.read(new URL(".cw/out/script/check-changelog/lib/versions.sh", repo)), "latest() { :; }\n");
  assert.equal(await held.read(new URL(".cw/out/script/check-changelog/README.md", repo)), "How it is laid out.\n");
  assert.equal(await held.read(new URL(".cw/out/skill/release/checklist.md", repo)), "1. Check the changelog.\n");
  assert.ok(built.added.includes(".cw/out/script/check-changelog/index.md"));
  // The document says how it is called, and the file that runs, as its author
  // wrote it: the copy sits beside the document as the asset sits beside the
  // script's index.md.
  const compiledDocument = await held.read(new URL(".cw/out/script/check-changelog/index.md", repo));
  assert.match(compiledDocument, /^executionPath: \.\/run\.sh$/m);
  assert.ok(compiledDocument.includes("Takes the version as its one argument."));
});

test("of a built script, the asset it runs is executable and no other; a built template is not (FR-160)", async () => {
  const { fileOutput, build } = building({
    ...script("check", { "run.sh": runFile, "lib.sh": "true\n" }),
    [at("template/note/index.md")]: template("note"),
    [at("skill/release/index.md")]: skillNaming("[[check]]", "[[note]]"),
  });

  await build();

  assert.ok(fileOutput.executables.has(inRepo(".cw/out/script/check/run.sh")));
  assert.ok(!fileOutput.executables.has(inRepo(".cw/out/script/check/lib.sh")));
  assert.ok(!fileOutput.executables.has(inRepo(".cw/out/script/check/index.md")));
  assert.ok(!fileOutput.executables.has(inRepo(".cw/out/template/note/index.md")));
});

test("the catalogue names each primitive's compiled file, and a listing the index.md it was authored in (FR-164, FR-140)", async () => {
  const { held, charterAuthoringApp, build } = building({
    ...script("check"),
    [at("template/note/index.md")]: template("note"),
    [at("skill/release/index.md")]: skillNaming("[[check]]", "[[note]]"),
  });

  await build();

  const catalogue = JSON.parse(await held.read(new URL(".cw/out/catalog.json", repo))) as { id: string; file: string }[];
  assert.equal(catalogue.find((entry) => entry.id === "check")?.file, ".cw/out/script/check/index.md");
  assert.equal(catalogue.find((entry) => entry.id === "note")?.file, ".cw/out/template/note/index.md");
  const listing = await charterAuthoringApp.fullList();
  assert.ok(listing.type === "Primitives");
  assert.match(JSON.stringify(listing.data), /\.cw\/charter\/script\/check\/index\.md/);
});

test("an id holding / is a folder in the charter and in the output alike (FR-141)", async () => {
  const { held, build } = building({
    [at("script/release/check/index.md")]: primitive("script", "release/check", ["executionPath: ./run.sh"], ""),
    [at("script/release/check/run.sh")]: runFile,
    [at("skill/release/index.md")]: skillNaming("[[release/check]]"),
  });

  filesOf(await build());

  assert.equal(await held.read(new URL(".cw/out/script/release/check/run.sh", repo)), runFile);
  assert.match(await held.read(new URL(".cw/out/script/release/check/index.md", repo)), /^executionPath: \.\/run\.sh$/m);
});

test("an asset edited and not built leaves its copy as the last build left it, and the preview says what a build would write (FR-166)", async () => {
  const { held, charterAuthoringApp, build } = building({
    ...script("check", { "run.sh": runFile, "old.sh": "true\n" }),
    [at("skill/release/index.md")]: skillNaming("[[check]]"),
  });
  await build();

  held.write(new URL(at("script/check/run.sh")), "echo half written\n");
  held.remove(new URL(at("script/check/old.sh")));

  assert.equal(await held.read(new URL(".cw/out/script/check/run.sh", repo)), runFile);
  const previewed = filesOf(await charterAuthoringApp.preview());
  assert.ok(previewed.edited.includes(".cw/out/script/check/run.sh"));
  assert.ok(previewed.deleted.includes(".cw/out/script/check/old.sh"));
});

test("a primitive deleted from the charter has its copies deleted by the next build (FR-168)", async () => {
  const { held, build } = building({
    ...script("check"),
    [at("skill/release/index.md")]: primitive("skill", "release", ['triggers: ["release"]'], "Tag it."),
  });
  await build();

  held.remove(new URL(at("script/check/index.md")));
  const built = filesOf(await build());

  assert.ok(built.deleted.includes(".cw/out/script/check/run.sh"));
  assert.ok(built.deleted.includes(".cw/out/script/check/index.md"));
});

test("a script whose executionPath is missing, not a path from its index.md, leaves its folder, or holds what a shell would read is refused with the kind's sample (FR-165)", async () => {
  for (const headers of [[], ["executionPath: run.sh"], ["executionPath: ./lib/../run.sh"], ["executionPath: /usr/bin/env"], ["executionPath: ./run.sh;id"]]) {
    const { build } = building({
      [at("script/check/index.md")]: primitive("script", "check", headers, ""),
      [at("script/check/run.sh")]: runFile,
      // There, so that only its name is what is refused.
      [at("script/check/run.sh;id")]: runFile,
    });

    assert.ok(errorsUnder(faultsOf(await build()), "script/check/index.md").length > 0, `refused: ${headers.join()}`);
  }
});

test("a script whose executionPath names no asset of it is an error under its index.md (FR-165)", async () => {
  const { build } = building({
    [at("script/check/index.md")]: primitive("script", "check", ["executionPath: ./run.sh"], ""),
    [at("script/check/other.sh")]: runFile,
  });

  assert.match(errorsUnder(faultsOf(await build()), "script/check/index.md").join(), /holds no such file/);
});

test("a script or a template no primitive names is a warning, and the build still runs (FR-163)", async () => {
  const { charterAuthoringApp, build } = building({
    ...script("check"),
    [at("template/note/index.md")]: template("note"),
    [at("template/used/index.md")]: template("used"),
    [at("skill/release/index.md")]: skillNaming("[[used]]"),
  });

  filesOf(await build());
  const doctorOutcome = await charterAuthoringApp.doctor();

  const warnedFiles = Object.entries(doctorOutcome.data.faultsByFile.data.files)
    .filter(([, faults]) => faults.some((fault) => fault.data.severity === "warn" && /names/.test(fault.data.message)))
    .map(([file]) => file);
  assert.ok(warnedFiles.some((file) => file.endsWith("script/check/index.md")));
  assert.ok(warnedFiles.some((file) => file.endsWith("template/note/index.md")));
  assert.ok(!warnedFiles.some((file) => file.endsWith("template/used/index.md")));
});

test("a vendor's assets are copied into the repository's output folder like ones it authored", async () => {
  const { held, build } = building({
    [inRepo(".cw/vendor/team/script/check/index.md")]: primitive("script", "check", ["executionPath: ./run.sh"], ""),
    [inRepo(".cw/vendor/team/script/check/run.sh")]: runFile,
    [at("skill/release/index.md")]: skillNaming("[[check]]"),
  });

  filesOf(await build());

  assert.equal(await held.read(new URL(".cw/out/script/check/run.sh", repo)), runFile);
});

test("asking a script what it requires names its executionPath (Story 24 scenario 1)", async () => {
  const { charterAuthoringApp } = building({});

  for (const [kind, field] of [["script", "executionPath"]] as const) {
    const primitiveRequirementsDTO = await charterAuthoringApp.listPrimitiveRequirements(kind);

    const requiredHeader = primitiveRequirementsDTO.data.headers.find((header) => header.data.field === field);
    assert.deepEqual(requiredHeader?.data, { field, shape: "line", required: true });
    assert.match(primitiveRequirementsDTO.data.sample, new RegExp(`^${field}: `, "m"));
  }
});

test("a script is added as its index.md and an empty asset at its executionPath (FR-167)", async () => {
  const { held, charterAuthoringApp } = building({});

  const primitiveDTO = await charterAuthoringApp.add("script", "release/check", { description: "Check the changelog.", executionPath: "./run.sh" });

  assert.equal(primitiveDTO.type, "Primitive");
  assert.match(await held.read(new URL(at("script/release/check/index.md"))), /^kind: script\nid: release\/check\n/m);
  assert.equal(await held.read(new URL(at("script/release/check/run.sh"))), "");
});

test("a primitive added inside another's folder, or around one, is refused and nothing is written (FR-167)", async () => {
  const { held, charterAuthoringApp } = building({ [at("skill/team/review/index.md")]: primitive("skill", "team/review", ['triggers: ["review"]'], "") });

  for (const id of ["team/review/strict", "team"])
    await assert.rejects(charterAuthoringApp.add("skill", id, { description: "Mine.", triggers: ["mine"] }), /skill\/team\/review\/index\.md is a primitive/);
  assert.equal(await held.readIfThere(new URL(at("skill/team/review/strict/index.md"))), undefined);
  assert.equal(await held.readIfThere(new URL(at("skill/team/index.md"))), undefined);
});

test("deleting a primitive takes every asset of it with it (FR-167)", async () => {
  const { held, charterAuthoringApp } = building({
    ...script("check", { "run.sh": runFile, "lib/versions.sh": "true\n" }),
    ...script("other"),
  });

  await charterAuthoringApp.remove("check");

  assert.equal(await held.readIfThere(new URL(at("script/check/index.md"))), undefined);
  assert.equal(await held.readIfThere(new URL(at("script/check/run.sh"))), undefined);
  assert.equal(await held.readIfThere(new URL(at("script/check/lib/versions.sh"))), undefined);
  assert.equal(await held.readIfThere(new URL(at("script/other/run.sh"))), runFile);
});

test("a template asks for nothing beyond what every primitive does (FR-158)", async () => {
  const { charterAuthoringApp } = building({});

  const primitiveRequirementsDTO = await charterAuthoringApp.listPrimitiveRequirements("template");

  assert.deepEqual(primitiveRequirementsDTO.data.headers.filter((header) => header.data.required).map((header) => header.data.field), ["description"]);
});
