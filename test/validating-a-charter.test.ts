import { test } from "node:test";
import assert from "node:assert/strict";
import { folderURL } from "../src/hexagon/domain/path.js";
import { CharterRoot } from "../src/hexagon/domain/models/charter/CharterRoot.js";
import { REPO_LAYER, VENDOR_LAYER } from "../src/hexagon/domain/models/charter/PrimitiveLayer.js";
import { FaultsByFile } from "../src/hexagon/domain/models/DomainFault.js";
import { GuidePrimitive } from "../src/hexagon/domain/models/charter/primitive/GuidePrimitive.js";
import { MixinPrimitive } from "../src/hexagon/domain/models/charter/primitive/MixinPrimitive.js";
import { CorpusPrimitive } from "../src/hexagon/domain/models/charter/primitive/CorpusPrimitive.js";
import { McpPrimitive } from "../src/hexagon/domain/models/charter/primitive/McpPrimitive.js";
import { AgentPrimitive } from "../src/hexagon/domain/models/charter/primitive/AgentPrimitive.js";
import { PlaybookPrimitive } from "../src/hexagon/domain/models/charter/primitive/PlaybookPrimitive.js";
import { SkillPrimitive } from "../src/hexagon/domain/models/charter/primitive/SkillPrimitive.js";
import { PRIMITIVE_CLASSES, type Primitive } from "../src/hexagon/domain/models/charter/primitive/Primitive.js";
import { compile } from "../src/hexagon/domain/services/compile/compileService.js";

const root = folderURL("file:///repo/.cw/charter/");

/** One primitive that has already been read, under the file it was read from:
 *  what validate is given, and what a file that came through reading clean
 *  amounts to. */
type Authored = Primitive;

/** One authored primitive as the charter holds it: named as it was authored,
 *  whichever layer the file arrived in. */
const layered = (vendor: string | undefined, file: string, primitive: Primitive): Authored =>
  PRIMITIVE_CLASSES.find((one) => one.kind === primitive.kind)!.of(primitive.headers, primitive.body, [], {
    name: vendor === undefined ? REPO_LAYER : VENDOR_LAYER,
    charterFolder: file.slice(0, -`/${primitive.primitiveFolder}/index.md`.length),
  });

const at = (file: string) => new URL(file, root).href;

const guide = (
  id: string,
  file = `guide/${id}/index.md`,
  headers: Record<string, unknown> = {},
  vendor?: string,
  body = "Body.",
): Authored =>
  layered(
    vendor,
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

const mixin = (id: string, vendor?: string): Authored =>
  layered(vendor, at(`mixin/${id}/index.md`), MixinPrimitive.of({ id, description: `The ${id} mixin.` }, "Body."));

const corpus = (id: string, vendor?: string): Authored =>
  layered(vendor, at(`corpus/${id}/index.md`), CorpusPrimitive.of({ id, description: `Why ${id}.` }, "Body."));

const mcp = (id: string, vendor?: string, headers: Record<string, unknown> = {}): Authored =>
  layered(
    vendor,
    at(vendor === undefined ? `mcp/${id.replace(/\//g, "-")}/index.md` : `../vendor/${vendor}/mcp/${id.replace(/\//g, "-")}/index.md`),
    McpPrimitive.of(
      { id, description: `The ${id} place.`, endpoint: "https://mcp.example.com/", auth: ["oauth"], tools: ["search"], ...headers },
      "Body.",
    ),
  );

/** Every place a charter's mcps reach, as a build writes them (FR-145). */
const mcpOriginsOf = (charter: CharterRoot) => compile(charter, []).mcpOrigins.origins;

/** Every mcp of these, named in a guide's body so none is reported as unnamed. */
const namedMcps = (...mcps: Authored[]): Authored[] => [
  guide("no-any", "guide/no-any/index.md", {}, undefined, `Read the reasons in ${mcps.map((one) => `[[${one.headers.id}]]`).join(" and ")}.`),
  ...mcps,
];

const faultsByFilesOf = (...primitives: Authored[]): FaultsByFile["files"] =>
  new CharterRoot(primitives, FaultsByFile.none).compositeFaultsByFiles.files;

const faultsIn = (faultsByFiles: FaultsByFile["files"]) => Object.values(faultsByFiles).flat();

const messages = (faultsByFiles: FaultsByFile["files"]) =>
  Object.values(faultsByFiles)
    .flatMap((one) => one.map((fault) => fault.message))
    .join("\n");

test("a charter whose files each hold their own contract has nothing left to answer", () => {
  assert.deepEqual(faultsByFilesOf(guide("no-any", "guide/no-any/index.md", { mixins: ["ts-defaults"] }), mixin("ts-defaults")), {});
});

test("one id declared in two layers is a collision naming both files", () => {
  const faultsByFiles = faultsByFilesOf(guide("no-any"), guide("no-any", "../vendor/acme/guide/no-any/index.md"));
  assert.deepEqual(Object.keys(faultsByFiles), [at("../vendor/acme/guide/no-any/index.md")]);
  assert.match(messages(faultsByFiles), /"no-any"/);
  assert.match(messages(faultsByFiles), /guide\/no-any\/index\.md/);
});

test("two ids one host name would be given are a collision under the second file (FR-141)", () => {
  const faultsByFiles = faultsByFilesOf(guide("a/b"), guide("a-b"));
  assert.deepEqual(Object.keys(faultsByFiles), [at("guide/a-b/index.md")]);
  assert.match(messages(faultsByFiles), /"a-b" and "a\/b" are both named "a-b"/);
});

test("one id under two kinds is a collision naming both files, whatever the kinds (FR-015, Story 27)", () => {
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
  assert.deepEqual(faultsByFilesOf(guide("reject-any", "guide/no-any/index.md", { mixins: ["no-any"] }), mixin("no-any")), {});
});

test("a mixin no primitive in this layer holds is refused, naming it", () => {
  const faultsByFiles = faultsByFilesOf(guide("no-any", "guide/no-any/index.md", { mixins: ["absent"] }));
  assert.deepEqual(Object.keys(faultsByFiles), [at("guide/no-any/index.md")]);
  assert.match(messages(faultsByFiles), /absent/);
});

test("a mixin this layer does hold is nothing to report", () => {
  assert.deepEqual(faultsByFilesOf(mixin("ts-defaults"), guide("no-any", "guide/no-any/index.md", { mixins: ["ts-defaults"] })), {});
});

test("every problem in a run is reported, not only the first", () => {
  const faultsByFiles = faultsByFilesOf(
    guide("no-any"),
    guide("no-any", "guide/copied/index.md"),
    guide("other", "guide/other/index.md", { mixins: ["absent"] }),
  );
  assert.equal(Object.keys(faultsByFiles).length, 2);
});

test("a vendored layer is asked the same questions the repository's own is", () => {
  const copied = guide("no-any", "vendor/team/guide/copied/index.md", {}, "team");
  const faultsByFiles = faultsByFilesOf(guide("no-any", "vendor/team/guide/no-any/index.md", {}, "team"), copied);

  assert.deepEqual(Object.keys(faultsByFiles), [copied.file]);
});

test("a vendor claiming an id this repository authored is a collision, naming both files", () => {
  const copied = guide("no-any", "vendor/team/guide/no-any/index.md", {}, "team");
  const faultsByFiles = faultsByFilesOf(guide("no-any"), copied);

  assert.deepEqual(Object.keys(faultsByFiles), [copied.file]);
  assert.match(messages(faultsByFiles), /"no-any" is already declared by .*guide\/no-any\/index\.md/);
});

test("two files claiming one id collide, wherever they were authored", () => {
  const copied = guide("no-any", "vendor/team/guide/copied/index.md", {}, "team");
  const faultsByFiles = faultsByFilesOf(guide("no-any", "vendor/team/guide/no-any/index.md", {}, "team"), copied);

  assert.deepEqual(Object.keys(faultsByFiles), [copied.file]);
  assert.match(messages(faultsByFiles), /"no-any"/);
});

test("a host names a vendored mixin the way it names one of its own", () => {
  const faultsByFiles = faultsByFilesOf(
    guide("no-any", "guide/no-any/index.md", { mixins: ["ts-defaults"] }),
    mixin("ts-defaults", "team"),
  );

  assert.deepEqual(faultsByFiles, {});
});

test("a rationale the charter holds a corpus for is nothing to report", () => {
  assert.deepEqual(
    faultsByFilesOf(corpus("type-safety"), guide("no-any", "guide/no-any/index.md", { rationale: "type-safety" })),
    {},
  );
});

test("a rationale no corpus answers to is said, and does not fail the charter", () => {
  const faultsByFiles = faultsByFilesOf(guide("no-any", "guide/no-any/index.md", { rationale: "absent" }));

  assert.deepEqual(Object.keys(faultsByFiles), [at("guide/no-any/index.md")]);
  assert.deepEqual(
    faultsIn(faultsByFiles).map((one) => one.severity),
    ["warn"],
  );
  assert.match(messages(faultsByFiles), /"absent"/);
});

test("a rationale or a mixin naming a primitive of another kind is one nothing answers to (FR-172)", () => {
  const faultsByFiles = faultsByFilesOf(
    guide("type-safety", "guide/type-safety/index.md", {}, undefined, "Body."),
    guide("no-any", "guide/no-any/index.md", { rationale: "type-safety", mixins: ["type-safety"] }),
  );
  const noAnyFaults = faultsByFiles[at("guide/no-any/index.md")] ?? [];
  assert.deepEqual(noAnyFaults.map((fault) => fault.severity), ["error", "warn"]);
  assert.match(messages(faultsByFiles), /holds no mixin of that id/);
  assert.match(messages(faultsByFiles), /holds no corpus of that id/);
});

test("a body naming [[<id>]] of any kind the charter holds is nothing to report (FR-147, Story 27)", () => {
  assert.deepEqual(
    faultsByFilesOf(guide("small-diffs"), guide("no-any", "guide/no-any/index.md", {}, undefined, "Read [[small-diffs]] first.")),
    {},
  );
});

test("a primitive cites a vendored corpus the way it cites one of its own", () => {
  assert.deepEqual(
    faultsByFilesOf(
      corpus("type-safety", "team"),
      guide("no-any", "guide/no-any/index.md", { rationale: "type-safety" }),
    ),
    {},
  );
});

test("a corpus no primitive cites is said under its own file, and does not fail the charter (FR-014)", () => {
  const faultsByFiles = faultsByFilesOf(corpus("type-safety"), guide("no-any"));

  assert.deepEqual(Object.keys(faultsByFiles), [at("corpus/type-safety/index.md")]);
  assert.deepEqual(faultsIn(faultsByFiles).map((one) => one.severity), ["warn"]);
  assert.match(messages(faultsByFiles), /No primitive cites "type-safety"/);
});

test("a mixin no primitive pulls in is said under its own file, and does not fail the charter (FR-014)", () => {
  const faultsByFiles = faultsByFilesOf(mixin("ts-defaults"), guide("no-any"));

  assert.deepEqual(Object.keys(faultsByFiles), [at("mixin/ts-defaults/index.md")]);
  assert.deepEqual(faultsIn(faultsByFiles).map((one) => one.severity), ["warn"]);
  assert.match(messages(faultsByFiles), /No primitive pulls in the mixin "ts-defaults"/);
});

test("a vendored corpus and mixin nobody uses are said too, so the vendor can be taken out (FR-014)", () => {
  const faultsByFiles = faultsByFilesOf(corpus("type-safety", "team"), mixin("ts-defaults", "team"));

  assert.deepEqual(Object.keys(faultsByFiles).sort(), [at("corpus/type-safety/index.md"), at("mixin/ts-defaults/index.md")]);
});

test("a corpus cited only by a vendored primitive is cited", () => {
  assert.deepEqual(
    faultsByFilesOf(corpus("type-safety"), guide("no-any", "guide/no-any/index.md", { rationale: "type-safety" }, "team")),
    {},
  );
});

test("an mcp a body names is nothing to report, whichever layer authored it (FR-143)", () => {
  const namingGuide = guide("no-any", "guide/no-any/index.md", {}, undefined, "Take the requirements from [[mfbs/billing]].");
  assert.deepEqual(faultsByFilesOf(namingGuide, mcp("mfbs/billing", "team")), {});
});

test("a body naming an mcp no layer holds is an error under its file, once however often it names it (FR-143)", () => {
  const faultsByFiles = faultsByFilesOf(
    guide("no-any", "guide/no-any/index.md", {}, undefined, "Ask [[missing]], and then [[missing]] again."),
  );

  assert.deepEqual(Object.keys(faultsByFiles), [at("guide/no-any/index.md")]);
  assert.deepEqual(faultsIn(faultsByFiles).map((fault) => fault.severity), ["error"]);
  assert.match(messages(faultsByFiles), /names "missing", and this charter holds no primitive of that id/);
});

test("an mcp no primitive names is a warning under its own file (FR-144)", () => {
  const faultsByFiles = faultsByFilesOf(mcp("mfbs/billing"));

  assert.deepEqual(Object.keys(faultsByFiles), [at("mcp/mfbs/billing/index.md")]);
  assert.deepEqual(faultsIn(faultsByFiles).map((fault) => fault.severity), ["warn"]);
  assert.match(messages(faultsByFiles), /No primitive names "mfbs\/billing" in its body/);
});

const agent = (id: string, tools: readonly string[]): Authored =>
  layered(undefined, at(`agent/${id}/index.md`), AgentPrimitive.of({ id, description: `The ${id} role.`, tools }, "Body."));

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

test("an agent holding an mcp no layer holds, a tool that mcp does not declare, or a name not written as one, is an error under its file (FR-156)", () => {
  const faultsByFiles = faultsByFilesOf(
    agent("scanner", ["[[missing]]", "[[linear]]:delete_team", "[[linear]]:list_issues:again", "[[linear]]:list_issues"]),
    mcp("linear", undefined, { tools: ["list_issues"] }),
  );

  assert.deepEqual(Object.keys(faultsByFiles), [at("agent/scanner/index.md")]);
  assert.deepEqual(faultsIn(faultsByFiles).map((fault) => fault.severity), ["error", "error", "error"]);
  assert.match(messages(faultsByFiles), /"missing"/);
  assert.match(messages(faultsByFiles), /"\[\[linear\]\]:delete_team"/);
  assert.match(messages(faultsByFiles), /"\[\[linear\]\]:list_issues:again"/);
});

test("a repository mcp and a vendor mcp at one endpoint and path are one place, under both, signed in to either way (FR-145)", () => {
  const charter = new CharterRoot(
    namedMcps(
      mcp("billing", undefined, { path: "acme/billing", auth: ["oauth"], tools: ["search_code"] }),
      mcp("acme/code", "acme", { path: "acme/billing", auth: ["token"], tools: ["get_file_contents", "search_code"] }),
    ),
    FaultsByFile.none,
  );

  assert.deepEqual(mcpOriginsOf(charter), [
    {
      ids: ["acme/code", "billing"],
      names: { "acme/code": "acme_4a92", "billing": "billing_4170" },
      address: "https://mcp.example.com/",
      endpoint: "https://mcp.example.com/",
      path: "acme/billing",
      auth: ["oauth", "token"],
    },
  ]);
  assert.deepEqual(charter.compositeFaultsByFiles.files, {});
});

test("the same two at different paths are two places (FR-145)", () => {
  const charter = new CharterRoot(
    namedMcps(mcp("billing", undefined, { path: "acme/billing" }), mcp("acme/code", "acme", { path: "acme/code" })),
    FaultsByFile.none,
  );

  assert.deepEqual(
    mcpOriginsOf(charter).map(({ path, ids }) => ({ path, ids })),
    [
      { path: "acme/billing", ids: ["billing"] },
      { path: "acme/code", ids: ["acme/code"] },
    ],
  );
});

test("a command's place carries its arguments and the variable its token is read from (FR-145)", () => {
  const command = { endpoint: undefined, command: "npx", args: ["-y", "server-github"], auth: ["token"], tokenEnv: "GITHUB_TOKEN" };
  const charter = new CharterRoot(namedMcps(mcp("github", undefined, command)), FaultsByFile.none);

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
  assert.deepEqual(faultsIn(faultsByFiles).map((fault) => fault.severity), ["error", "error"]);
  assert.match(messages(faultsByFiles), /One process reads its token from one variable/);
});

test("a command taking no token beside one naming a variable is no conflict (FR-145)", () => {
  const command = { endpoint: undefined, auth: undefined, command: "npx", args: ["server-github"] };
  const faultsByFiles = faultsByFilesOf(
    ...namedMcps(mcp("one", undefined, command), mcp("two", undefined, { ...command, auth: ["token"], tokenEnv: "GITHUB_TOKEN" })),
  );

  assert.deepEqual(faultsByFiles, {});
});

