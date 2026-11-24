/**
 * The architecture, enforced on the real dependency graph rather than on the
 * text of an import line: transitive edges, `require`, and dynamic `import()`
 * all count.
 *
 * Three roles, and the direction between them is the whole design (plan §2):
 * a driver calls in, the hexagon decides, a driven adapter is called out to.
 */
module.exports = {
  forbidden: [
    {
      name: "hexagon-is-sealed",
      severity: "error",
      comment:
        "A module's application and domain declare ports and forget who fills " +
        "them. They import nothing outside the modules — not node:*, not an " +
        "adapter, and no library: zod, the shape of a value, and every " +
        "library a notation or an algebra needs is wrapped by a lib of the " +
        "kernel's domain (below), and knows nothing about where its input came from. " +
        "This is also what keeps a reading service unable to write (FR-041).",
      from: { path: "^src/module/[^/]+/(app|domain)/", pathNot: "^src/module/shared/domain/libs/" },
      to: { pathNot: "^src/module/[^/]+/(app|domain)/|^src/module/[^/]+/module\\.ts$" },
    },
    {
      name: "a-library-is-reached-through-a-lib",
      severity: "error",
      comment:
        "The kernel's domain libs wrap the libraries the hexagon reads with — glob " +
        "strings, YAML, TOML — so nothing else of it imports one, and a parser " +
        "is swapped in one file. They import nothing else outside the modules.",
      from: { path: "^src/module/shared/domain/libs/" },
      to: {
        pathNot:
          "^src/module/[^/]+/(app|domain)/|^src/module/[^/]+/module\\.ts$|node_modules/.*/(lodash-es|picomatch|zod|yaml|smol-toml)/",
      },
    },
    {
      name: "module-is-entered-through-module-ts",
      severity: "error",
      comment:
        "Each module says in its module.ts what the code outside it may " +
        "reach of its engine, and in its infra.ts what of its adapters, and " +
        "another module reaches it there and nowhere else: its " +
        "inside can be rearranged without anything outside noticing. A DTO " +
        "file, and the kernel's DTO entry, are governed by dtos-are-zod-only " +
        "alone: they reach the entry, which no other file may.",
      from: {
        path: "^src/module/([^/]+)/",
        pathNot: "^src/module/[^/]+/app/port/in/[^/]+\\.(dto|schema)\\.ts$|^src/module/shared/app/port/in/index\\.ts$",
      },
      to: { path: "^src/module/(?!$1/)[^/]+/", pathNot: "^src/module/[^/]+/(module|infra)\\.ts$" },
    },
    {
      name: "driver-and-composition-enter-through-module-ts",
      severity: "error",
      comment:
        "A driver, the composition root (src/module/composition.ts) and the entry points (main.ts, src/index.ts) reach a module " +
        "through its module.ts alone — an application, a port, a DTO — " +
        "and its adapters through its infra.ts alone.",
      from: { pathNot: "^src/module/[^/]+/" },
      to: { path: "^src/module/", pathNot: "^src/module/[^/]+/(module|infra)\\.ts$|^src/module/composition\\.ts$" },
    },
    {
      name: "driven-answers-only-its-port",
      severity: "error",
      comment:
        "A driven adapter, in its module's infrastructure, implements a driven " +
        "port of its module or of the kernel, and that port is all it knows of " +
        "them. Whatever it needs from inside — an error to raise, a type to " +
        "return — is exported by the port it answers; the kernel's helpers " +
        "for adapters, by the kernel's infra.ts.",
      from: { path: "^src/module/([^/]+)/infra/" },
      to: {
        path: "^src/module",
        pathNot: "^src/module/$1/(app/port/out/|infra/)|^src/module/shared/(module|infra)\\.ts$",
      },
    },
    {
      name: "application-holds-no-adapter",
      severity: "error",
      comment:
        "A module's application and domain are the engine; its adapters, " +
        "published beside it as defaults a tool may mix with its own, are " +
        "handed to it where it is composed (CORE-FR-228, CORE-FR-230).",
      from: { path: "^src/module/[^/]+/(app|domain)/" },
      to: { path: "^src/module/[^/]+/infra/" },
    },
    {
      name: "dtos-are-zod-only",
      severity: "error",
      comment:
        "Every module's DTOs are read by every driver and parsed by clients. " +
        "A DTO file imports the other DTO and schema files, the kernel's DTO " +
        "entry (src/module/shared/app/port/in/index.ts) and the kernel's " +
        "validator lib, and nothing else — never the kernel's module.ts, which " +
        "reaches its applications. The entry reaches those alone.",
      from: {
        path: "^src/module/[^/]+/app/port/in/[^/]+\\.(dto|schema)\\.ts$|^src/module/shared/app/port/in/index\\.ts$",
      },
      to: {
        pathNot:
          "^src/module/[^/]+/app/port/in/[^/]+\\.(dto|schema)\\.ts$|^src/module/shared/app/port/in/index\\.ts$|^src/module/shared/domain/libs/validator\\.lib\\.ts$",
      },
    },
    {
      name: "zod-is-reached-through-the-kernel-validator",
      severity: "error",
      comment:
        "Every schema of the engine is written with the z the kernel's " +
        "validator lib exports, so zod is imported in one file and swapped in one.",
      from: { path: "^(src|main\\.ts)", pathNot: "^src/module/shared/domain/libs/validator\\.lib\\.ts$" },
      to: { path: "node_modules/.*/zod/" },
    },
    {
      name: "page-is-browser-code",
      severity: "error",
      comment:
        "The portal's page runs in the browser and knows only the JSON the " +
        "server answers with (FR-005). It imports itself, the DTOs it reads " +
        "that JSON as — types only, from each module's module.ts —, the routes' types it calls them by, and the " +
        "libraries it renders and calls with — react, shadcn's own (radix, " +
        "cva, clsx, tailwind-merge, lucide, sonner, cmdk), tanstack query, " +
        "codemirror, marked, zod and hono's client — and never the hexagon, " +
        "the filesystem or " +
        "node:*.",
      from: { path: "^src/presentation/portal/page/" },
      to: {
        pathNot:
          "^src/presentation/portal/page/|^src/module/[^/]+/module\\.ts$|^src/presentation/portal/portal\\.routes\\.ts$|" +
          "node_modules/.*/(react|react-dom|@tanstack/react-query|radix-ui|class-variance-authority|clsx|tailwind-merge|lucide-react|sonner|cmdk|@codemirror/[^/]+|marked|zod|hono)/",
      },
    },
    {
      name: "page-knows-modules-only-as-types",
      severity: "error",
      comment:
        "The page reads what the modules answer as types, and bundles nothing " +
        "of them: a module.ts reaches every application of its module.",
      from: { path: "^src/presentation/portal/page/" },
      to: { path: "^src/module/", dependencyTypesNot: ["type-only"] },
    },
    {
      name: "page-knows-routes-only-as-types",
      severity: "error",
      comment:
        "The page calls the routes through hono's client, typed by the app " +
        "portal.routes.ts exports. It imports its type and nothing else: the routes " +
        "call the engine, and none of that is bundled into the browser.",
      from: { path: "^src/presentation/portal/page/" },
      to: { path: "^src/presentation/portal/portal\\.routes\\.ts$", dependencyTypesNot: ["type-only"] },
    },
    {
      name: "models-know-no-dto",
      severity: "error",
      comment:
        "A model knows nothing of what a driver reads: the domain and the " +
        "application's services import no driver port, " +
        "DTOs included. The use cases turn what they hand back into DTOs.",
      from: { path: "^src/module/[^/]+/(domain|app/services)/" },
      to: { path: "^src/module/[^/]+/app/port/in/" },
    },
    {
      name: "charter-knows-no-runtime",
      severity: "error",
      comment:
        "The charter is asked by runtime and asks nothing of it: the two " +
        "modules speak one way, so neither can be changed into a cycle " +
        "(CORE-FR-229).",
      from: { path: "^src/module/charter/" },
      to: { path: "^src/module/runtime/" },
    },
    {
      name: "runtime-asks-charter-through-its-applications",
      severity: "error",
      comment:
        "Runtime asks the charter through its applications' driver ports alone, " +
        "in the DTOs they answer with: no model of the charter's reaches it " +
        "(CORE-FR-229).",
      from: { path: "^src/module/runtime/" },
      to: { path: "^src/module/charter/", pathNot: "^src/module/charter/module\\.ts$" },
    },
    {
      name: "workspace-knows-no-other-module",
      severity: "error",
      comment:
        "The workspace keeps what a repository configured itself with, and " +
        "whoever composes the engine hands it to the charter and runtime: it " +
        "knows neither, and is told the agents the engine compiles for " +
        "(CORE-FR-231).",
      from: { path: "^src/module/workspace/" },
      to: { path: "^src/module/(charter|runtime)/" },
    },
    {
      name: "no-module-reads-the-workspace",
      severity: "error",
      comment:
        "Neither the charter nor runtime reads what a repository configured " +
        "itself with: they are handed it when they are composed (CORE-FR-231).",
      from: { path: "^src/module/(charter|runtime)/" },
      to: { path: "^src/module/workspace/" },
    },
    {
      name: "shared-belongs-to-no-module",
      severity: "error",
      comment: "The kernel every module reads holds what is none's: it imports " + "nothing of any (CORE-FR-222).",
      from: { path: "^src/module/shared/" },
      to: { path: "^src/module/(charter|runtime|workspace)/" },
    },
    {
      name: "adapters-do-not-know-each-other",
      severity: "error",
      comment:
        "A driving adapter and a driven adapter — a module's or a plugin's — " +
        "meet only at the composition root, through the ports they each face.",
      from: { path: "^src/presentation/" },
      to: { path: "^src/(module/[^/]+/infra|plugin)/" },
    },
    {
      name: "driven-adapters-know-no-driver",
      severity: "error",
      comment: "A driven adapter is called out to, and never calls in.",
      from: { path: "^src/module/[^/]+/infra/" },
      to: { path: "^src/presentation/" },
    },
    {
      name: "no-circular",
      severity: "error",
      comment: "A cycle means the two modules are one module wearing two names.",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-orphans",
      severity: "warn",
      comment:
        "A module nothing imports is either dead or wired up wrong. The two " +
        "entry points, cw's and the library's, are imported from outside.",
      from: { orphan: true, pathNot: "^(main|src/index)\\.ts$" },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    // A script of the engine's own layer is an asset put down, imported as
    // its text and never run here: not a module of the hexagon, so not held
    // to its rules.
    exclude: {
      path: "^src/module/charter/domain/builtin/.+\\.(mjs|d\\.mts)$",
    },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: { exportsFields: ["exports"], conditionNames: ["import", "require", "node"] },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
