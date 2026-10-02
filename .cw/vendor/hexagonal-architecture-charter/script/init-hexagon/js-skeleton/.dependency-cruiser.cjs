/**
 * The architecture, enforced on the real dependency graph rather than on the
 * text of an import line: transitive edges, `require`, and dynamic `import()`
 * all count. Run with `depcruise src main.js`.
 *
 * Ports are JSDoc typedefs, so `detectJSDocImports` makes an
 * `import("…")` inside a JSDoc comment count as an edge like any other.
 *
 * Three roles, and the direction between them is the whole design:
 * a driver calls in, the hexagon decides, a driven adapter is called out to.
 */

/** The only libraries the hexagon may import: ones that answer questions about
 *  values and know nothing about where a value came from. Add one here
 *  deliberately, never to get an adapter's work done inside the hexagon. */
const HEXAGON_LIBRARIES = ["zod"];

const libraryPattern = (names) => (names.length ? `|node_modules/.*/(${names.join("|")})/` : "");

module.exports = {
  forbidden: [
    {
      name: "hexagon-is-sealed",
      severity: "error",
      comment:
        "The hexagon declares ports and forgets who fills them. It imports " +
        "nothing outside itself — not node:*, not an adapter, and no library " +
        "but the ones named in HEXAGON_LIBRARIES.",
      from: { path: "^src/hexagon" },
      to: { pathNot: `^src/hexagon${libraryPattern(HEXAGON_LIBRARIES)}` },
    },
    {
      name: "driver-enters-through-its-port",
      severity: "error",
      comment:
        "A driving adapter reaches the hexagon through a driver port, or the " +
        "application behind it, and nothing else. Whatever it needs from inside " +
        "is exported by the port, so the domain can be rearranged without a " +
        "driver noticing.",
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
      name: "dtos-know-only-dtos",
      severity: "error",
      comment:
        "A DTO is what a driver reads. It imports other DTOs and the schema " +
        "library, and nothing more of the hexagon.",
      from: { path: "^src/hexagon/port/driver/dtos/" },
      to: { pathNot: `^src/hexagon/port/driver/dtos/${libraryPattern(HEXAGON_LIBRARIES)}` },
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
      name: "domain-is-pure",
      severity: "error",
      comment:
        "The domain holds rules and nothing that reaches out: it imports no " +
        "port, no service and no application.",
      from: { path: "^src/hexagon/domain/" },
      to: { path: "^src/hexagon/(port|service|application)/" },
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
      from: { orphan: true, pathNot: "^main\\.js$" },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    detectJSDocImports: true,
  },
};
