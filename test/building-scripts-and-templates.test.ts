import { test } from "node:test";
import assert from "node:assert/strict";
import { CharterAuthoring } from "../src/hexagon/application/CharterAuthoring.js";
import { InMemoryFileReaders } from "../src/zdriven/InMemoryFileReaders.js";
import { InMemoryVCS } from "../src/zdriven/InMemoryVCS.js";
import { InMemoryFileOutput } from "../src/zdriven/InMemoryFileOutput.js";
import { YamlParser } from "../src/zdriven/YamlParser.js";
import type { DataDTOs } from "../src/hexagon/port/driver/dtos/index.js";

const repo = new URL("file:///repo/");
const root = new URL(".cw/charter/", repo);

const at = (path: string) => new URL(path, root).href;
const inRepo = (path: string) => new URL(path, repo).href;

const primitive = (kind: string, id: string, headers: readonly string[], body: string) =>
  ["---", `kind: ${kind}`, `id: ${id}`, `description: What ${id} is for, in one line.`, ...headers, "---", "", body, ""].join("\n");

const checkChangelog = ["#!/usr/bin/env bash", "set -euo pipefail", 'grep -q "## $1" CHANGELOG.md'].join("\n");
const releaseNote = ["# Release {{version}}", "", "  - indented on purpose"].join("\n");

const script = (id: string, extension = "sh", body = checkChangelog) => primitive("script", id, [`extension: ${extension}`], body);
const template = (id: string, extension = "md", body = releaseNote) => primitive("template", id, [`extension: ${extension}`], body);
const skillNaming = (...names: readonly string[]) =>
  primitive("skill", "release", ['triggers: ["release"]'], `Use ${names.join(" and ")} before tagging.`);

/** A charter on files a build both reads and writes, with what it made
 *  executable kept beside them. */
const building = (files: Readonly<Record<string, string>>) => {
  const held = new InMemoryFileReaders(files);
  const fileOutput = new InMemoryFileOutput(held);
  const charterAuthoringApp = new CharterAuthoring(repo, held, new YamlParser(), fileOutput, new InMemoryVCS());
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

test("a script and a template are built as their body alone, under the extension they declare (FR-159)", async () => {
  const { held, build } = building({
    [at("script/release/check-changelog.md")]: script("release/check-changelog"),
    [at("template/release-note.md")]: template("release-note"),
    [at("skill/release.md")]: skillNaming("script:release/check-changelog", "template:release-note"),
  });

  const built = filesOf(await build());

  assert.ok(built.added.includes(".cw/out/script/release/check-changelog.sh"));
  assert.ok(built.added.includes(".cw/out/template/release-note.md"));
  assert.equal(await held.read(new URL(".cw/out/script/release/check-changelog.sh", repo)), `${checkChangelog}\n`);
  // Indentation on a line of the body is the author's, and comes through.
  assert.equal(await held.read(new URL(".cw/out/template/release-note.md", repo)), `${releaseNote}\n`);
  assert.ok(!built.added.includes(".cw/out/script/release/check-changelog.md"));
});

test("a built script is executable, and a built template is not (FR-160)", async () => {
  const { fileOutput, build } = building({
    [at("script/check.md")]: script("check"),
    [at("template/note.md")]: template("note"),
    [at("skill/release.md")]: skillNaming("script:check", "template:note"),
  });

  await build();

  assert.ok(fileOutput.executables.has(inRepo(".cw/out/script/check.sh")));
  assert.ok(!fileOutput.executables.has(inRepo(".cw/out/template/note.md")));
});

test("the catalogue names a script's built file, and a listing names the file it was authored in (FR-164, FR-140)", async () => {
  const { held, charterAuthoringApp, build } = building({
    [at("script/check.md")]: script("check"),
    [at("skill/release.md")]: skillNaming("script:check"),
  });

  await build();

  const catalogue = JSON.parse(await held.read(new URL(".cw/out/catalog.json", repo))) as { identity: string; file: string }[];
  assert.equal(catalogue.find((entry) => entry.identity === "script:check")?.file, ".cw/out/script/check.sh");
  const listing = await charterAuthoringApp.fullList();
  assert.ok(listing.type === "ScopedPrimitives");
  assert.match(JSON.stringify(listing.data), /\.cw\/charter\/script\/check\.md/);
});

test("changing a script's extension writes the new file and takes the old one away (FR-159)", async () => {
  const { held, build } = building({
    [at("script/check.md")]: script("check", "sh"),
    [at("skill/release.md")]: skillNaming("script:check"),
  });
  await build();

  held.write(new URL(at("script/check.md")), script("check", "py", "print('checked')"));
  const built = filesOf(await build());

  assert.ok(built.added.includes(".cw/out/script/check.py"));
  assert.ok(built.deleted.includes(".cw/out/script/check.sh"));
});

test("a script or a template with no extension, a bad one, or a mixin is refused, and nothing is built (FR-004, FR-158)", async () => {
  for (const refusedPrimitive of [
    primitive("script", "check", [], checkChangelog),
    primitive("script", "check", ["extension: .sh"], checkChangelog),
    primitive("script", "check", ["extension: Sh"], checkChangelog),
    primitive("template", "check", ["extension: md", 'mixins: ["shared"]'], releaseNote),
  ]) {
    const { build } = building({ [at("script/check.md")]: refusedPrimitive });

    const faultsByFile = faultsOf(await build());

    const faults = Object.entries(faultsByFile.files).find(([file]) => file.includes("script/check.md"))?.[1] ?? [];
    assert.ok(faults.some((fault) => fault.data.severity === "error"), `refused: ${refusedPrimitive}`);
  }
});

test("a script or a template no primitive names is a warning, and the build still runs (FR-163)", async () => {
  const { charterAuthoringApp, build } = building({
    [at("script/check.md")]: script("check"),
    [at("template/note.md")]: template("note"),
    [at("template/used.md")]: template("used"),
    [at("skill/release.md")]: skillNaming("template:used"),
  });

  filesOf(await build());
  const doctorOutcome = await charterAuthoringApp.doctor();

  const warnedFiles = Object.entries(doctorOutcome.data.faultsByFile.data.files)
    .filter(([, faults]) => faults.some((fault) => fault.data.severity === "warn" && /names/.test(fault.data.message)))
    .map(([file]) => file);
  assert.ok(warnedFiles.some((file) => file.endsWith("script/check.md")));
  assert.ok(warnedFiles.some((file) => file.endsWith("template/note.md")));
  assert.ok(!warnedFiles.some((file) => file.endsWith("template/used.md")));
});

test("a vendor's script is built into the repository's output folder like one it authored", async () => {
  const { held, build } = building({
    [inRepo(".cw/vendor/team/script/check.md")]: script("check"),
    [at("skill/release.md")]: skillNaming("script:check"),
  });

  filesOf(await build());

  assert.equal(await held.read(new URL(".cw/out/script/check.sh", repo)), `${checkChangelog}\n`);
});

test("an empty script is built as an empty file", async () => {
  const { held, build } = building({
    [at("script/check.md")]: script("check", "sh", ""),
    [at("skill/release.md")]: skillNaming("script:check"),
  });

  filesOf(await build());

  assert.equal(await held.read(new URL(".cw/out/script/check.sh", repo)), "");
});

test("asking a script or a template what it requires names its extension (Story 21 scenario 1)", async () => {
  const { charterAuthoringApp } = building({});

  for (const kind of ["script", "template"]) {
    const primitiveRequirementsDTO = await charterAuthoringApp.listPrimitiveRequirements(kind);

    const extensionHeader = primitiveRequirementsDTO.data.headers.find((header) => header.data.field === "extension");
    assert.deepEqual(extensionHeader?.data, { field: "extension", shape: "line", required: true });
    assert.match(primitiveRequirementsDTO.data.sample, /^extension: /m);
  }
});

test("a script is added with its extension and an empty body, under the folders its id names (Story 21 scenario 2)", async () => {
  const { held, charterAuthoringApp } = building({});

  const scopedPrimitiveDTO = await charterAuthoringApp.add("script", "release/check-changelog", { description: "Check the changelog.", extension: "sh" });

  assert.equal(scopedPrimitiveDTO.type, "ScopedPrimitive");

  assert.match(await held.read(new URL(at("script/release/check-changelog.md"))), /^kind: script\nid: release\/check-changelog\n/m);
});
