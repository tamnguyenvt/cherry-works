import { test } from "node:test";
import assert from "node:assert/strict";
import { folderURL } from "../src/hexagon/domain/path.js";
import { CharterRoot, REPO_SCOPE, VENDOR_SCOPE, ScopedPrimitive } from "../src/hexagon/domain/models/charter/CharterRoot.js";
import { FaultsByFile } from "../src/hexagon/domain/models/Fault.js";
import { GuidePrimitive } from "../src/hexagon/domain/models/charter/primitive/GuidePrimitive.js";
import { MixinPrimitive } from "../src/hexagon/domain/models/charter/primitive/MixinPrimitive.js";
import { SkillPrimitive } from "../src/hexagon/domain/models/charter/primitive/SkillPrimitive.js";
import type { Primitive } from "../src/hexagon/domain/models/charter/primitive/Primitive.js";

const root = folderURL("file:///repo/.cw/charter/");

type Authored = ScopedPrimitive;

/** One authored primitive as the charter holds it: under the identity its layer
 *  gives it, which is what reading a charter works out. */
const scoped = (vendor: string | undefined, file: string, primitive: Primitive): Authored =>
  new ScopedPrimitive(
    `${vendor === undefined ? "" : `${vendor}/`}${primitive.kind}:${primitive.headers.id}`,
    vendor === undefined ? REPO_SCOPE : VENDOR_SCOPE,
    file,
    primitive,
  );

/** One primitive of the kind its class reads, under the file it was authored
 *  in. */
const primitive = (
  Kind: { readonly kind: string; of(record: Record<string, unknown>, body: string): Primitive },
  id: string,
  headers: Record<string, unknown> = {},
): Authored =>
  scoped(
    undefined,
    new URL(`${Kind.kind}/${id}.md`, root).href,
    Kind.of(
      {
        id,
        description: `About ${id}.`,
        ...(Kind === GuidePrimitive ? { globs: ["src/**/*.ts"] } : {}),
        ...(Kind === SkillPrimitive ? { triggers: ["a request"] } : {}),
        ...headers,
      },
      "Body.",
    ),
  );

const faultsByFilesOf = (...primitives: Authored[]) =>
  new CharterRoot(primitives, FaultsByFile.none).compositeFaultsByFiles.files;

const messages = (primitives: Authored[]) =>
  Object.values(faultsByFilesOf(...primitives))
    .flatMap((one) => one.map((fault) => fault.message))
    .join("\n");

test("a mixin that covers its host is nothing to report", () => {
  assert.deepEqual(faultsByFilesOf(
      primitive(MixinPrimitive, "ts-defaults", { globs: ["**/*.ts"] }),
      primitive(GuidePrimitive, "no-any", { globs: ["src/**/*.ts"], mixins: ["ts-defaults"] }),
    ), {});
});

test("a host that covers its mixin is nothing to report either", () => {
  assert.deepEqual(faultsByFilesOf(
      primitive(MixinPrimitive, "ts-defaults", { globs: ["src/**/*.ts"] }),
      primitive(GuidePrimitive, "no-any", { globs: ["**/*.ts"], mixins: ["ts-defaults"] }),
    ), {});
});

test("the same globs on both sides cover each other", () => {
  assert.deepEqual(faultsByFilesOf(
      primitive(MixinPrimitive, "ts-defaults", { globs: ["src/**/*.ts"] }),
      primitive(GuidePrimitive, "no-any", { globs: ["src/**/*.ts"], mixins: ["ts-defaults"] }),
    ), {});
});

test("globs that speak about different files are refused, naming the host", () => {
  const faultsByFiles = faultsByFilesOf(
    primitive(MixinPrimitive, "docs-tone", { globs: ["docs/**/*.md"] }),
    primitive(GuidePrimitive, "no-any", { globs: ["src/**/*.ts"], mixins: ["docs-tone"] }),
  );
  assert.deepEqual(Object.keys(faultsByFiles), [new URL("guide/no-any.md", root).href]);
  assert.match(
    Object.values(faultsByFiles).flatMap((one) => one.map((fault) => fault.message)).join("\n"),
    /docs-tone/,
  );
});

test("a host naming more files than its mixin covers it, and passes", () => {
  assert.deepEqual(faultsByFilesOf(
      primitive(MixinPrimitive, "ts-defaults", { globs: ["src/**/*.ts"] }),
      primitive(GuidePrimitive, "no-any", { globs: ["src/**/*.ts", "docs/**/*.md"], mixins: ["ts-defaults"] }),
    ), {});
});

test("overlapping without covering, in either direction, is refused", () => {
  const faultsByFiles = faultsByFilesOf(
    primitive(MixinPrimitive, "ts-defaults", { globs: ["src/**/*.ts", "test/**/*.ts"] }),
    primitive(GuidePrimitive, "no-any", { globs: ["src/**/*.ts", "docs/**/*.md"], mixins: ["ts-defaults"] }),
  );
  assert.equal(Object.keys(faultsByFiles).length, 1, "each side names a file the other does not");
});

test("a side that names no files is left alone", () => {
  assert.deepEqual(faultsByFilesOf(
      primitive(MixinPrimitive, "shared-tone"),
      primitive(SkillPrimitive, "naming", { triggers: ["name a thing"], mixins: ["shared-tone"] }),
    ), {});
});

test("a mixin this charter does not hold is reported once", () => {
  const faultsByFiles = faultsByFilesOf(primitive(GuidePrimitive, "no-any", { globs: ["src/**/*.ts"], mixins: ["absent"] }));
  assert.equal(Object.keys(faultsByFiles).length, 1);
  assert.match(
    Object.values(faultsByFiles).flatMap((one) => one.map((fault) => fault.message)).join("\n"),
    /pulls in the mixin "absent".*holds no mixin/s,
  );
});

test("what the domain finds on its own is reported too", () => {
  assert.match(
    messages([
      primitive(GuidePrimitive, "no-any"),
      scoped(undefined, "file:///repo/.cw/charter/guide/copied.md", primitive(GuidePrimitive, "no-any").primitive),
    ]),
    /already declared/,
  );
});
