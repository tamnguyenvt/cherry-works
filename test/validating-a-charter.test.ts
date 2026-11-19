import assert from "node:assert/strict";
import { test } from "node:test";
import type { CharterRoot } from "../src/module/charter/domain/models/charter/charter-root.js";
import { McpOrigins } from "../src/module/charter/domain/models/charter-output/mcp-origin.js";
import { AgentPrimitive } from "../src/module/charter/domain/models/primitive/agent-primitive.js";
import { CorpusPrimitive } from "../src/module/charter/domain/models/primitive/corpus-primitive.js";
import { GuidePrimitive } from "../src/module/charter/domain/models/primitive/guide-primitive.js";
import { McpPrimitive } from "../src/module/charter/domain/models/primitive/mcp-primitive.js";
import { MixinPrimitive } from "../src/module/charter/domain/models/primitive/mixin-primitive.js";
import { PlaybookPrimitive } from "../src/module/charter/domain/models/primitive/playbook-primitive.js";
import { type Primitive, Primitives } from "../src/module/charter/domain/models/primitive/primitive.js";
import { PrimitiveLayer } from "../src/module/charter/domain/models/primitive/primitive-layer.value-object.js";
import { SkillPrimitive } from "../src/module/charter/domain/models/primitive/skill-primitive.js";
import { CharterOutputService } from "../src/module/charter/domain/services/charter-output.service.js";
import { FolderAddress } from "../src/module/shared/app/port/out/folder-address.port.js";
import type { FaultsByFile } from "../src/module/shared/domain/models/fault/faults-by-file.js";
import { charterRootOf } from "./use-cases-of.js";

const root = FolderAddress.parseFolderUrl("file:///repo/.cw/charter/team/primitive/");

/** One primitive that has already been read, under the file it was read from:
 *  what validate is given, and what a file that came through reading clean
 *  amounts to. */
type Authored = Primitive;

/** One authored primitive as the charter holds it: named as it was authored,
 *  whichever layer the file arrived in. */
const layered = (installedCharterName: string | undefined, file: string, primitive: Primitive): Authored =>
  Primitives.classes
    .find((primitiveClass) => primitiveClass.kind === primitive.kind)!
    .of(
      primitive.headers,
      primitive.body,
      [],
      installedCharterName === undefined
        ? PrimitiveLayer.authoredLayerOf("team")
        : PrimitiveLayer.installedLayerOf(installedCharterName),
      file,
    );

const at = (file: string) => new URL(file, root).href;

const guide = (
  id: string,
  file = `guide/${id}/index.md`,
  headers: Record<string, unknown> = {},
  installedCharterName?: string,
  body = "Body.",
): Authored =>
  layered(
    installedCharterName,
    at(file),
    GuidePrimitive.of(
      {
        id,
        description: `About ${id}.`,
        globs: ["src/**/*.ts"],
        severity: "normal",
        ...headers,
      },
      body,
    ),
  );

const mixin = (id: string, installedCharterName?: string): Authored =>
  layered(
    installedCharterName,
    at(`mixin/${id}/index.md`),
    MixinPrimitive.of({ id, description: `The ${id} mixin.` }, "Body."),
  );

const corpus = (id: string, installedCharterName?: string): Authored =>
  layered(
    installedCharterName,
    at(`corpus/${id}/index.md`),
    CorpusPrimitive.of({ id, description: `Why ${id}.` }, "Body."),
  );

const mcp = (id: string, installedCharterName?: string, headers: Record<string, unknown> = {}): Authored =>
  layered(
    installedCharterName,
    at(installedCharterName === undefined ? `mcp/${id}/index.md` : `../${installedCharterName}/mcp/${id}/index.md`),
    McpPrimitive.of(
      {
        id,
        description: `The ${id} mcp origin.`,
        endpoint: "https://mcp.example.com/",
        auth: ["oauth"],
        tools: ["search"],
        ...headers,
      },
      "Body.",
    ),
  );

/** Every mcp origin a charter's mcps reach, as a build writes them (FR-145). */
const mcpOriginsOf = (charter: CharterRoot) =>
  CharterOutputService.compileCharterRoot(charter, []).charterOutputItems.find(
    (charterOutputItem): charterOutputItem is McpOrigins => charterOutputItem instanceof McpOrigins,
  )!.origins;

/** Every mcp of these, named in a guide's body so none is reported as unnamed. */
const namedMcps = (...mcps: Authored[]): Authored[] => [
  guide(
    "no-any",
    "guide/no-any/index.md",
    {},
    undefined,
    `Read the reasons in ${mcps.map((mcpPrimitive) => `[[${mcpPrimitive.headers.id}]]`).join(" and ")}.`,
  ),
  ...mcps,
];

const faultsByFilesOf = (...primitives: Authored[]): FaultsByFile["faultsByFilePath"] =>
  charterRootOf(primitives).compositeFaultsByFiles.faultsByFilePath;

const faultsIn = (faultsByFiles: FaultsByFile["faultsByFilePath"]) => Object.values(faultsByFiles).flat();

const messages = (faultsByFiles: FaultsByFile["faultsByFilePath"]) =>
  Object.values(faultsByFiles)
    .flatMap((fileFaults) => fileFaults.map((fault) => fault.message))
    .join("\n");

test("a charter whose files each hold their own contract has nothing left to answer", () => {
  assert.deepEqual(
    faultsByFilesOf(guide("no-any", "guide/no-any/index.md", { mixins: ["ts-defaults"] }), mixin("ts-defaults")),
    {},
  );
});

test("one id declared in two layers is a collision naming both files", () => {
  const faultsByFiles = faultsByFilesOf(guide("no-any"), guide("no-any", "../acme/guide/no-any/index.md"));
  assert.deepEqual(Object.keys(faultsByFiles), [at("../acme/guide/no-any/index.md")]);
  assert.match(messages(faultsByFiles), /"no-any"/);
  assert.match(messages(faultsByFiles), /guide\/no-any\/index\.md/);
});

test("two ids one host name would be given are a collision under the second file (FR-141)", () => {
  const faultsByFiles = faultsByFilesOf(guide("a/b"), guide("a-b"));
  assert.deepEqual(Object.keys(faultsByFiles), [at("guide/a-b/index.md")]);
  assert.match(messages(faultsByFiles), /"a-b" and "a\/b" are both named "a-b"/);
});

test("one id under two kinds is a collision naming both files, whatever the kinds (FR-015, CORE Story 26 scenarios 2, 3, CORE Story 27 scenario 1)", () => {
  const triggered = { id: "release", description: "How a release runs.", triggers: ["a release"] };
  const faultsByFiles = faultsByFilesOf(
    guide("release"),
    layered(undefined, at("skill/release/index.md"), SkillPrimitive.of(triggered, "Body.")),
    layered(undefined, at("playbook/release/index.md"), PlaybookPrimitive.of(triggered, "Body.")),
  );
  assert.deepEqual(Object.keys(faultsByFiles), [at("skill/release/index.md"), at("playbook/release/index.md")]);
  assert.match(messages(faultsByFiles), /"release" is already declared by .*guide\/release\/index\.md/);
});

test("an id compares as itself, never as a file basename", () => {
  assert.deepEqual(
    faultsByFilesOf(guide("reject-any", "guide/no-any/index.md", { mixins: ["no-any"] }), mixin("no-any")),
    {},
  );
});

test("a mixin no primitive in this layer holds is refused, naming it", () => {
  const faultsByFiles = faultsByFilesOf(guide("no-any", "guide/no-any/index.md", { mixins: ["absent"] }));
  assert.deepEqual(Object.keys(faultsByFiles), [at("guide/no-any/index.md")]);
  assert.match(messages(faultsByFiles), /absent/);
});

test("a mixin this layer does hold is nothing to report", () => {
  assert.deepEqual(
    faultsByFilesOf(mixin("ts-defaults"), guide("no-any", "guide/no-any/index.md", { mixins: ["ts-defaults"] })),
    {},
  );
});

test("every problem in a run is reported, not only the first", () => {
  const faultsByFiles = faultsByFilesOf(
    guide("no-any"),
    guide("no-any", "guide/copied/index.md"),
    guide("other", "guide/other/index.md", { mixins: ["absent"] }),
  );
  assert.equal(Object.keys(faultsByFiles).length, 2);
});

test("an installed layer is asked the same questions the repository's own is", () => {
  const copiedPrimitive = guide("no-any", "../rules/guide/copied/index.md", {}, "rules");
  const faultsByFiles = faultsByFilesOf(
    guide("no-any", "../rules/guide/no-any/index.md", {}, "rules"),
    copiedPrimitive,
  );

  assert.deepEqual(Object.keys(faultsByFiles), [copiedPrimitive.uri]);
});

test("an installed charter claiming an id this repository authored is a collision, naming both files (CORE Story 2 scenario 2)", () => {
  const copiedPrimitive = guide("no-any", "../rules/guide/no-any/index.md", {}, "rules");
  const faultsByFiles = faultsByFilesOf(guide("no-any"), copiedPrimitive);

  assert.deepEqual(Object.keys(faultsByFiles), [copiedPrimitive.uri]);
  assert.match(messages(faultsByFiles), /"no-any" is already declared by .*guide\/no-any\/index\.md/);
});

test("two files claiming one id collide, wherever they were authored", () => {
  const copiedPrimitive = guide("no-any", "../rules/guide/copied/index.md", {}, "rules");
  const faultsByFiles = faultsByFilesOf(
    guide("no-any", "../rules/guide/no-any/index.md", {}, "rules"),
    copiedPrimitive,
  );

  assert.deepEqual(Object.keys(faultsByFiles), [copiedPrimitive.uri]);
  assert.match(messages(faultsByFiles), /"no-any"/);
});

test("a host names an installed mixin the way it names one of its own", () => {
  const faultsByFiles = faultsByFilesOf(
    guide("no-any", "guide/no-any/index.md", { mixins: ["ts-defaults"] }),
    mixin("ts-defaults", "rules"),
  );

  assert.deepEqual(faultsByFiles, {});
});

test("a rationale the charter holds a corpus for is nothing to report", () => {
  assert.deepEqual(
    faultsByFilesOf(corpus("type-safety"), guide("no-any", "guide/no-any/index.md", { rationale: "type-safety" })),
    {},
  );
});

test("a rationale no corpus answers to is said, and does not fail the charter (CORE Story 1 scenario 13)", () => {
  const faultsByFiles = faultsByFilesOf(guide("no-any", "guide/no-any/index.md", { rationale: "absent" }));

  assert.deepEqual(Object.keys(faultsByFiles), [at("guide/no-any/index.md")]);
  assert.deepEqual(
    faultsIn(faultsByFiles).map((fault) => fault.severity),
    ["warn"],
  );
  assert.match(messages(faultsByFiles), /"absent"/);
});

test("a rationale and mixins naming a corpus and a mixin by their bare ids resolve to them, and the same ids held only by a guide resolve to nothing (CORE Story 27 scenario 2, FR-172, CORE Story 55 scenario 15)", () => {
  const namingGuide = guide("no-any", "guide/no-any/index.md", { rationale: "why", mixins: ["typed"] });

  assert.deepEqual(faultsByFilesOf(corpus("why"), mixin("typed"), namingGuide), {});

  const faultsByFiles = faultsByFilesOf(
    guide("why", "guide/why/index.md", {}, undefined, "Body."),
    guide("typed", "guide/typed/index.md", {}, undefined, "Body."),
    namingGuide,
  );
  const namingGuideMessages = (faultsByFiles[at("guide/no-any/index.md")] ?? []).map(({ message }) => message);
  assert.equal(namingGuideMessages.length, 2, namingGuideMessages.join("\n"));
  assert.ok(namingGuideMessages.some((message) => /"why"/.test(message) && /holds no corpus of that id/.test(message)));
  assert.ok(
    namingGuideMessages.some((message) => /"typed"/.test(message) && /holds no mixin of that id/.test(message)),
  );
});

test("a rationale or a mixin naming a primitive of another kind is one nothing answers to (CORE Story 27 scenario 2, FR-172)", () => {
  const faultsByFiles = faultsByFilesOf(
    guide("type-safety", "guide/type-safety/index.md", {}, undefined, "Body."),
    guide("no-any", "guide/no-any/index.md", { rationale: "type-safety", mixins: ["type-safety"] }),
  );
  const noAnyFaults = faultsByFiles[at("guide/no-any/index.md")] ?? [];
  assert.deepEqual(
    noAnyFaults.map((fault) => fault.severity),
    ["error", "warn"],
  );
  assert.match(messages(faultsByFiles), /holds no mixin of that id/);
  assert.match(messages(faultsByFiles), /holds no corpus of that id/);
});

test("a body naming [[<id>]] of any kind the charter holds is nothing to report (FR-147, CORE Story 27 scenario 3)", () => {
  assert.deepEqual(
    faultsByFilesOf(
      guide("small-diffs"),
      guide("no-any", "guide/no-any/index.md", {}, undefined, "Read [[small-diffs]] first."),
    ),
    {},
  );
});

test("a primitive cites an installed corpus the way it cites one of its own", () => {
  assert.deepEqual(
    faultsByFilesOf(
      corpus("type-safety", "rules"),
      guide("no-any", "guide/no-any/index.md", { rationale: "type-safety" }),
    ),
    {},
  );
});

test("a corpus no primitive cites is said under its own file, and does not fail the charter (FR-014)", () => {
  const faultsByFiles = faultsByFilesOf(corpus("type-safety"), guide("no-any"));

  assert.deepEqual(Object.keys(faultsByFiles), [at("corpus/type-safety/index.md")]);
  assert.deepEqual(
    faultsIn(faultsByFiles).map((fault) => fault.severity),
    ["warn"],
  );
  assert.match(messages(faultsByFiles), /No primitive cites "type-safety"/);
});

test("a mixin no primitive pulls in is said under its own file, and does not fail the charter (FR-014)", () => {
  const faultsByFiles = faultsByFilesOf(mixin("ts-defaults"), guide("no-any"));

  assert.deepEqual(Object.keys(faultsByFiles), [at("mixin/ts-defaults/index.md")]);
  assert.deepEqual(
    faultsIn(faultsByFiles).map((fault) => fault.severity),
    ["warn"],
  );
  assert.match(messages(faultsByFiles), /No primitive pulls in the mixin "ts-defaults"/);
});

test("an installed corpus and mixin nobody uses are said too, so the installed charter can be taken out (FR-014)", () => {
  const faultsByFiles = faultsByFilesOf(corpus("type-safety", "rules"), mixin("ts-defaults", "rules"));

  assert.deepEqual(Object.keys(faultsByFiles).sort(), [
    at("corpus/type-safety/index.md"),
    at("mixin/ts-defaults/index.md"),
  ]);
});

test("a corpus cited only by an installed primitive is cited", () => {
  assert.deepEqual(
    faultsByFilesOf(
      corpus("type-safety"),
      guide("no-any", "guide/no-any/index.md", { rationale: "type-safety" }, "rules"),
    ),
    {},
  );
});

test("an mcp a body names is nothing to report, whichever layer authored it (FR-143)", () => {
  const namingGuide = guide(
    "no-any",
    "guide/no-any/index.md",
    {},
    undefined,
    "Take the requirements from [[mfbs/billing]].",
  );
  assert.deepEqual(faultsByFilesOf(namingGuide, mcp("mfbs/billing", "rules")), {});
});

test("a body naming an mcp no layer holds is an error under its file, once however often it names it (FR-143, CORE Story 17 scenario 3, CORE Story 21 scenario 10)", () => {
  const faultsByFiles = faultsByFilesOf(
    guide("no-any", "guide/no-any/index.md", {}, undefined, "Ask [[missing]], and then [[missing]] again."),
  );

  assert.deepEqual(Object.keys(faultsByFiles), [at("guide/no-any/index.md")]);
  assert.deepEqual(
    faultsIn(faultsByFiles).map((fault) => fault.severity),
    ["error"],
  );
  assert.match(messages(faultsByFiles), /names "missing", and this charter holds no primitive of that id/);
});

test("an mcp no primitive names is a warning under its own file (FR-144)", () => {
  const faultsByFiles = faultsByFilesOf(mcp("mfbs/billing"));

  assert.deepEqual(Object.keys(faultsByFiles), [at("mcp/mfbs/billing/index.md")]);
  assert.deepEqual(
    faultsIn(faultsByFiles).map((fault) => fault.severity),
    ["warn"],
  );
  assert.match(messages(faultsByFiles), /No primitive names "mfbs\/billing" in its body/);
});

const agent = (id: string, tools: readonly string[]): Authored =>
  layered(
    undefined,
    at(`agent/${id}/index.md`),
    AgentPrimitive.of({ id, description: `The ${id} role.`, tools }, "Body."),
  );

test("an agent holding an mcp, whole or one tool it declares, is nothing to report, and names that mcp (FR-144, FR-156)", () => {
  assert.deepEqual(
    faultsByFilesOf(
      agent("scanner", ["Read", "[[mfbs/billing]]", "[[linear]]:list_issues"]),
      mcp("mfbs/billing"),
      mcp("linear", undefined, { tools: ["list_issues", "create_issue"] }),
    ),
    {},
  );
});

test("an agent holding an mcp no layer holds, a tool that mcp does not declare, or a name not written as one, is an error under its file (FR-156, CORE Story 20 scenario 4)", () => {
  const faultsByFiles = faultsByFilesOf(
    agent("scanner", [
      "[[missing]]",
      "[[linear]]:delete_team",
      "[[linear]]:list_issues:again",
      "[[linear]]:list_issues",
    ]),
    mcp("linear", undefined, { tools: ["list_issues"] }),
  );

  assert.deepEqual(Object.keys(faultsByFiles), [at("agent/scanner/index.md")]);
  assert.deepEqual(
    faultsIn(faultsByFiles).map((fault) => fault.severity),
    ["error", "error", "error"],
  );
  assert.match(messages(faultsByFiles), /"missing"/);
  assert.match(messages(faultsByFiles), /"\[\[linear\]\]:delete_team"/);
  assert.match(messages(faultsByFiles), /"\[\[linear\]\]:list_issues:again"/);
});

test("a repository mcp and an installed charter mcp at one endpoint and path are one mcp origin, under both, signed in to either way (FR-145)", () => {
  const charter = charterRootOf(
    namedMcps(
      mcp("billing", undefined, { path: "acme/billing", auth: ["oauth"], tools: ["search_code"] }),
      mcp("acme/code", "acme", { path: "acme/billing", auth: ["token"], tools: ["get_file_contents", "search_code"] }),
    ),
  );

  assert.deepEqual(JSON.parse(JSON.stringify(mcpOriginsOf(charter))), [
    {
      ids: ["acme/code", "billing"],
      names: { "acme/code": "acme_4a92", billing: "billing_4170" },
      address: "https://mcp.example.com/",
      endpoint: "https://mcp.example.com/",
      path: "acme/billing",
      auth: ["oauth", "token"],
    },
  ]);
  assert.deepEqual(charter.compositeFaultsByFiles.faultsByFilePath, {});
});

test("the same two at different paths are two mcp origins (FR-145)", () => {
  const charter = charterRootOf(
    namedMcps(mcp("billing", undefined, { path: "acme/billing" }), mcp("acme/code", "acme", { path: "acme/code" })),
  );

  assert.deepEqual(
    mcpOriginsOf(charter).map(({ path, ids }) => ({ path, ids })),
    [
      { path: "acme/billing", ids: ["billing"] },
      { path: "acme/code", ids: ["acme/code"] },
    ],
  );
});

test("a command's mcp origin carries its arguments and the variable its token is read from (FR-145)", () => {
  const command = {
    endpoint: undefined,
    command: "npx",
    args: ["-y", "server-github"],
    auth: ["token"],
    tokenEnv: "GITHUB_TOKEN",
  };
  const charter = charterRootOf(namedMcps(mcp("github", undefined, command)));

  const [mcpOrigin] = mcpOriginsOf(charter);
  assert.equal(mcpOrigin?.address, "npx -y server-github");
  assert.deepEqual(mcpOrigin?.command, { command: "npx", args: ["-y", "server-github"], tokenEnv: "GITHUB_TOKEN" });
  assert.equal(mcpOrigin?.endpoint, undefined);
});

test("one command handed its token in two variables is an error under both files (FR-145)", () => {
  const command = (tokenEnv: string, path: string) => ({
    endpoint: undefined,
    command: "npx",
    args: ["server-github"],
    auth: ["token"],
    tokenEnv,
    path,
  });
  const faultsByFiles = faultsByFilesOf(
    ...namedMcps(mcp("one", undefined, command("GITHUB_TOKEN", "a")), mcp("two", undefined, command("GH_TOKEN", "b"))),
  );

  assert.deepEqual(Object.keys(faultsByFiles).sort(), [at("mcp/one/index.md"), at("mcp/two/index.md")]);
  assert.deepEqual(
    faultsIn(faultsByFiles).map((fault) => fault.severity),
    ["error", "error"],
  );
  assert.match(messages(faultsByFiles), /One process reads its token from one variable/);
});

test("a command taking no token beside one naming a variable is no conflict (FR-145)", () => {
  const command = { endpoint: undefined, auth: undefined, command: "npx", args: ["server-github"] };
  const faultsByFiles = faultsByFilesOf(
    ...namedMcps(
      mcp("one", undefined, command),
      mcp("two", undefined, { ...command, auth: ["token"], tokenEnv: "GITHUB_TOKEN" }),
    ),
  );

  assert.deepEqual(faultsByFiles, {});
});
