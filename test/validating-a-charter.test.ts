import { test } from "node:test";
import assert from "node:assert/strict";
import { folderURL } from "../src/hexagon/domain/path.js";
import { CharterRoot, REPO_SCOPE, VENDOR_SCOPE, ScopedPrimitive } from "../src/hexagon/domain/models/charter/CharterRoot.js";
import { FaultsByFile } from "../src/hexagon/domain/models/DomainFault.js";
import { GuidePrimitive } from "../src/hexagon/domain/models/charter/primitive/GuidePrimitive.js";
import { MixinPrimitive } from "../src/hexagon/domain/models/charter/primitive/MixinPrimitive.js";
import { CorpusPrimitive } from "../src/hexagon/domain/models/charter/primitive/CorpusPrimitive.js";
import { McpPrimitive } from "../src/hexagon/domain/models/charter/primitive/McpPrimitive.js";
import type { Primitive } from "../src/hexagon/domain/models/charter/primitive/Primitive.js";
import { compile } from "../src/hexagon/domain/services/compileService.js";

const root = folderURL("file:///repo/.cw/charter/");

/** One primitive that has already been read, under the file it was read from:
 *  what validate is given, and what a file that came through reading clean
 *  amounts to. */
type Authored = ScopedPrimitive;

/** One authored primitive as the charter holds it: named as it was authored,
 *  whichever layer the file arrived in. */
const scoped = (vendor: string | undefined, file: string, primitive: Primitive): Authored =>
  new ScopedPrimitive(`${primitive.kind}:${primitive.headers.id}`, vendor === undefined ? REPO_SCOPE : VENDOR_SCOPE, file, primitive);

const at = (file: string) => new URL(file, root).href;

const guide = (
  id: string,
  file = `guide/${id}.md`,
  headers: Record<string, unknown> = {},
  vendor?: string,
  body = "Body.",
): Authored =>
  scoped(
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
  scoped(vendor, at(`mixin/${id}.md`), MixinPrimitive.of({ id, description: `The ${id} mixin.` }, "Body."));

const corpus = (id: string, vendor?: string): Authored =>
  scoped(vendor, at(`corpus/${id}.md`), CorpusPrimitive.of({ id, description: `Why ${id}.` }, "Body."));

const mcp = (id: string, vendor?: string, headers: Record<string, unknown> = {}): Authored =>
  scoped(
    vendor,
    at(vendor === undefined ? `mcp/${id}.md` : `../vendor/${vendor}/mcp/${id}.md`),
    McpPrimitive.of(
      { id, description: `The ${id} place.`, endpoint: "https://mcp.example.com/", auth: ["oauth"], tools: ["search"], ...headers },
      "Body.",
    ),
  );

/** Every place a charter's mcps reach, as a build writes them (FR-145). */
const mcpOriginsOf = (charter: CharterRoot) => compile(charter, []).mcpOrigins;

/** Every mcp of these, named in a guide's body so none is reported as unnamed. */
const namedMcps = (...mcps: Authored[]): Authored[] => [
  guide("no-any", "guide/no-any.md", {}, undefined, `Read the reasons in ${mcps.map((one) => one.identity).join(" and ")}.`),
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
  assert.deepEqual(faultsByFilesOf(guide("no-any", "guide/no-any.md", { mixins: ["ts-defaults"] }), mixin("ts-defaults")), {});
});

test("one identity declared twice in a layer is a collision naming both files", () => {
  const faultsByFiles = faultsByFilesOf(guide("no-any"), guide("no-any", "guide/copied.md"));
  assert.deepEqual(Object.keys(faultsByFiles), [at("guide/copied.md")]);
  assert.match(messages(faultsByFiles), /guide:no-any/);
  assert.match(messages(faultsByFiles), /guide\/no-any\.md/);
});

test("two identities one host name would be given are a collision under the second file (FR-141)", () => {
  const faultsByFiles = faultsByFilesOf(guide("a/b"), guide("a-b"));
  assert.deepEqual(Object.keys(faultsByFiles), [at("guide/a-b.md")]);
  assert.match(messages(faultsByFiles), /"guide:a-b" and "guide:a\/b" are both named "guide-a-b"/);
});

test("one id under two kinds is two identities, not a collision", () => {
  assert.deepEqual(faultsByFilesOf(guide("naming", "guide/naming.md", { mixins: ["naming"] }), mixin("naming")), {});
});

test("an identity compares as kind:id, never as a file basename", () => {
  assert.deepEqual(faultsByFilesOf(guide("reject-any", "guide/no-any.md", { mixins: ["no-any"] }), mixin("no-any")), {});
});

test("a mixin no primitive in this layer holds is refused, naming it", () => {
  const faultsByFiles = faultsByFilesOf(guide("no-any", "guide/no-any.md", { mixins: ["absent"] }));
  assert.deepEqual(Object.keys(faultsByFiles), [at("guide/no-any.md")]);
  assert.match(messages(faultsByFiles), /absent/);
});

test("a mixin this layer does hold is nothing to report", () => {
  assert.deepEqual(faultsByFilesOf(mixin("ts-defaults"), guide("no-any", "guide/no-any.md", { mixins: ["ts-defaults"] })), {});
});

test("every problem in a run is reported, not only the first", () => {
  const faultsByFiles = faultsByFilesOf(
    guide("no-any"),
    guide("no-any", "guide/copied.md"),
    guide("other", "guide/other.md", { mixins: ["absent"] }),
  );
  assert.equal(Object.keys(faultsByFiles).length, 2);
});

test("a vendored layer is asked the same questions the repository's own is", () => {
  const copied = guide("no-any", "vendor/team/guide/copied.md", {}, "team");
  const faultsByFiles = faultsByFilesOf(guide("no-any", "vendor/team/guide/no-any.md", {}, "team"), copied);

  assert.deepEqual(Object.keys(faultsByFiles), [copied.file]);
});

test("a vendor claiming an identity this repository authored is a collision, naming both files", () => {
  const copied = guide("no-any", "vendor/team/guide/no-any.md", {}, "team");
  const faultsByFiles = faultsByFilesOf(guide("no-any"), copied);

  assert.deepEqual(Object.keys(faultsByFiles), [copied.file]);
  assert.match(messages(faultsByFiles), /"guide:no-any" is already declared by .*guide\/no-any\.md/);
});

test("two files claiming one identity collide, wherever they were authored", () => {
  const copied = guide("no-any", "vendor/team/guide/copied.md", {}, "team");
  const faultsByFiles = faultsByFilesOf(guide("no-any", "vendor/team/guide/no-any.md", {}, "team"), copied);

  assert.deepEqual(Object.keys(faultsByFiles), [copied.file]);
  assert.match(messages(faultsByFiles), /"guide:no-any"/);
});

test("a host names a vendored mixin the way it names one of its own", () => {
  const faultsByFiles = faultsByFilesOf(
    guide("no-any", "guide/no-any.md", { mixins: ["ts-defaults"] }),
    mixin("ts-defaults", "team"),
  );

  assert.deepEqual(faultsByFiles, {});
});

test("a rationale the charter holds a corpus for is nothing to report", () => {
  assert.deepEqual(
    faultsByFilesOf(corpus("type-safety"), guide("no-any", "guide/no-any.md", { rationale: "corpus:type-safety" })),
    {},
  );
});

test("a rationale no corpus answers to is said, and does not fail the charter", () => {
  const faultsByFiles = faultsByFilesOf(guide("no-any", "guide/no-any.md", { rationale: "corpus:absent" }));

  assert.deepEqual(Object.keys(faultsByFiles), [at("guide/no-any.md")]);
  assert.deepEqual(
    faultsIn(faultsByFiles).map((one) => one.severity),
    ["warn"],
  );
  assert.match(messages(faultsByFiles), /corpus:absent/);
});

test("a primitive cites a vendored corpus the way it cites one of its own", () => {
  assert.deepEqual(
    faultsByFilesOf(
      corpus("type-safety", "team"),
      guide("no-any", "guide/no-any.md", { rationale: "corpus:type-safety" }),
    ),
    {},
  );
});

test("a corpus no primitive cites is said under its own file, and does not fail the charter (FR-014)", () => {
  const faultsByFiles = faultsByFilesOf(corpus("type-safety"), guide("no-any"));

  assert.deepEqual(Object.keys(faultsByFiles), [at("corpus/type-safety.md")]);
  assert.deepEqual(faultsIn(faultsByFiles).map((one) => one.severity), ["warn"]);
  assert.match(messages(faultsByFiles), /No primitive cites "corpus:type-safety"/);
});

test("a mixin no primitive pulls in is said under its own file, and does not fail the charter (FR-014)", () => {
  const faultsByFiles = faultsByFilesOf(mixin("ts-defaults"), guide("no-any"));

  assert.deepEqual(Object.keys(faultsByFiles), [at("mixin/ts-defaults.md")]);
  assert.deepEqual(faultsIn(faultsByFiles).map((one) => one.severity), ["warn"]);
  assert.match(messages(faultsByFiles), /No primitive pulls in the mixin "ts-defaults"/);
});

test("a vendored corpus and mixin nobody uses are said too, so the vendor can be taken out (FR-014)", () => {
  const faultsByFiles = faultsByFilesOf(corpus("type-safety", "team"), mixin("ts-defaults", "team"));

  assert.deepEqual(Object.keys(faultsByFiles).sort(), [at("corpus/type-safety.md"), at("mixin/ts-defaults.md")]);
});

test("a corpus cited only by a vendored primitive is cited", () => {
  assert.deepEqual(
    faultsByFilesOf(corpus("type-safety"), guide("no-any", "guide/no-any.md", { rationale: "corpus:type-safety" }, "team")),
    {},
  );
});

test("an mcp a body names is nothing to report, whichever layer authored it (FR-143)", () => {
  const namingGuide = guide("no-any", "guide/no-any.md", {}, undefined, "Take the requirements from mcp:mfbs/billing.");
  assert.deepEqual(faultsByFilesOf(namingGuide, mcp("mfbs/billing", "team")), {});
});

test("a body naming an mcp no layer holds is a warning under its file, once however often it names it (FR-143)", () => {
  const faultsByFiles = faultsByFilesOf(
    guide("no-any", "guide/no-any.md", {}, undefined, "Ask mcp:missing, and then mcp:missing again."),
  );

  assert.deepEqual(Object.keys(faultsByFiles), [at("guide/no-any.md")]);
  assert.deepEqual(faultsIn(faultsByFiles).map((fault) => fault.severity), ["warn"]);
  assert.match(messages(faultsByFiles), /names "mcp:missing", and this charter holds no mcp of that identity/);
});

test("an mcp no primitive names is a warning under its own file (FR-144)", () => {
  const faultsByFiles = faultsByFilesOf(mcp("mfbs/billing"));

  assert.deepEqual(Object.keys(faultsByFiles), [at("mcp/mfbs/billing.md")]);
  assert.deepEqual(faultsIn(faultsByFiles).map((fault) => fault.severity), ["warn"]);
  assert.match(messages(faultsByFiles), /No primitive names "mcp:mfbs\/billing" in its body/);
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
      identities: ["mcp:acme/code", "mcp:billing"],
      names: { "mcp:acme/code": "acme_bc84", "mcp:billing": "billing_aec3" },
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
    mcpOriginsOf(charter).map(({ path, identities }) => ({ path, identities })),
    [
      { path: "acme/billing", identities: ["mcp:billing"] },
      { path: "acme/code", identities: ["mcp:acme/code"] },
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

  assert.deepEqual(Object.keys(faultsByFiles).sort(), [at("mcp/one.md"), at("mcp/two.md")]);
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

