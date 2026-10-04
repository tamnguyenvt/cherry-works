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
        "The hexagon declares ports and forgets who fills them. It may import " +
        "nothing outside itself — not node:*, not an adapter, and no library " +
        "but lodash, picomatch and zod, which answer questions about lists, " +
        "objects, glob strings and the shape of a value, and know nothing " +
        "about where any of them came from. " +
        "This is also what keeps a reading service unable to write (FR-041).",
      from: { path: "^src/hexagon" },
      to: { pathNot: "^src/hexagon|node_modules/.*/(lodash-es|picomatch|zod)/" },
    },
    {
      name: "driver-enters-through-its-port",
      severity: "error",
      comment:
        "A driving adapter reaches the hexagon through a driver port, or the " +
        "application behind it, and nothing else. Whatever it needs from inside " +
        "— a type, a constant, a function — is exported by the port, so the " +
        "domain can be rearranged without a driver noticing.",
      from: { path: "^src/driver" },
      to: { path: "^src/hexagon", pathNot: "^src/hexagon/(port/driver|application)/" },
    },
    {
      name: "driven-answers-only-its-port",
      severity: "error",
      comment:
        "A driven adapter implements a driven port, and that port is all it " +
        "knows of the hexagon. Whatever it needs from inside — an error to " +
        "raise, a type to return — is exported by the port it answers.",
      from: { path: "^src/zdriven" },
      to: { path: "^src/hexagon", pathNot: "^src/hexagon/port/zdriven/" },
    },
    {
      name: "dtos-are-zod-only",
      severity: "error",
      comment:
        "Every model's DTO is read by every driver, and the portal's page " +
        "bundles the schemas. They import zod and nothing else, so nothing " +
        "more of the hexagon is shipped to the browser.",
      from: { path: "^src/hexagon/port/driver/dtos/" },
      to: { pathNot: "^src/hexagon/port/driver/dtos/|node_modules/.*/zod/" },
    },
    {
      name: "page-is-browser-code",
      severity: "error",
      comment:
        "The portal's page runs in the browser and knows only the JSON the " +
        "server answers with (FR-005). It imports itself, the DTOs it parses " +
        "that JSON with, the routes' types it calls them by, and the " +
        "libraries it renders and calls with — react, shadcn's own (radix, " +
        "cva, clsx, tailwind-merge, lucide, sonner, cmdk), tanstack query, " +
        "codemirror, marked, zod and hono's client — and never the hexagon, " +
        "the filesystem or " +
        "node:*.",
      from: { path: "^src/driver/portal/page/" },
      to: {
        pathNot:
          "^src/driver/portal/page/|^src/hexagon/port/driver/dtos/|^src/driver/portal/routes\\.ts$|" +
          "node_modules/.*/(react|react-dom|@tanstack/react-query|radix-ui|class-variance-authority|clsx|tailwind-merge|lucide-react|sonner|cmdk|@codemirror/[^/]+|marked|zod|hono)/",
      },
    },
    {
      name: "page-knows-routes-only-as-types",
      severity: "error",
      comment:
        "The page calls the routes through hono's client, typed by the app " +
        "routes.ts exports. It imports its type and nothing else: the routes " +
        "call the engine, and none of that is bundled into the browser.",
      from: { path: "^src/driver/portal/page/" },
      to: { path: "^src/driver/portal/routes\\.ts$", dependencyTypesNot: ["type-only"] },
    },
    {
      name: "models-know-no-dto",
      severity: "error",
      comment:
        "A model knows nothing of what a driver reads: the domain and its " +
        "services import no driver port, DTOs included. The application turns " +
        "what they hand back into DTOs.",
      from: { path: "^src/hexagon/(domain|service)/" },
      to: { path: "^src/hexagon/port/driver/" },
    },
    {
      name: "adapters-do-not-know-each-other",
      severity: "error",
      comment:
        "A driving adapter and a driven adapter meet only at the composition " +
        "root, through the ports they each face.",
      from: { path: "^src/(driver|zdriven)" },
      to: { path: "^src/(driver|zdriven)", pathNot: "^src/$1" },
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
      comment: "A module nothing imports is either dead or wired up wrong.",
      from: { orphan: true, pathNot: "^main\\.ts$" },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    // A script of the engine's own layer is an asset it puts down, imported as
    // its text and run only on the developer's machine: not a module of the
    // hexagon, so not held to its rules.
    exclude: { path: "^src/hexagon/domain/models/charter/builtin/.+\\.(mjs|d\\.mts)$" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: { exportsFields: ["exports"], conditionNames: ["import", "require", "node"] },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
