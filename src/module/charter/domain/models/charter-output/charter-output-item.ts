/**
 * One item of what a build compiles to: its text (CORE-FR-220). Every item of
 * a `CharterOutput` is one of these — the catalogues, `CHARTER.md`, the mcp
 * origins, the built sensors and each compiled primitive — each made by its
 * own factory.
 *
 * Where it lands inside the output, and how another item's text names it, is
 * `OutputPath`'s; where the output lands is the projection's (CORE-FR-221).
 */
export abstract class CharterOutputItem {
  /** What it holds, as a build lays it. */
  abstract get text(): string;
}
