import { z } from "zod";
import { BasePrimitive, CommonHeadersSchema, headersOf, GoodLineSchema, type RequiredHeaders, type AssetFile } from "./BasePrimitive.js";
import type { PrimitiveLayer } from "../PrimitiveLayer.js";

/** The events a charter knows how to be raised by, and the only ones a sensor
 *  may name (FR-004).
 *
 *  Closed the way the kinds are: a name outside it is a sensor nothing will
 *  ever fire, and saying so where the file is read is the one place an author
 *  finds out. A host that raises none of them compiles no hook for it, which is
 *  that host's to say and not this list's. */
export const SIGNALS = [
  "PreToolUse",
  "PostToolUse",
  "UserPromptSubmit",
  "Notification",
  "Stop",
  "SubagentStop",
  "PreCompact",
  "SessionStart",
  "SessionEnd",
] as const;

/** One of them, read off the list rather than written out again. */
export type Signal = (typeof SIGNALS)[number];

/** A command the agent's own harness runs when a signal fires (FR-004). */
export const SensorHeadersSchema = CommonHeadersSchema.extend({
  /** What raises it: one of the events every host of this engine speaks in. */
  signal: z.enum(SIGNALS),
  /** What is run when it does. A sensor that names no command is a sensor
   *  nothing can fire, so this is required. */
  run: GoodLineSchema,
});
export type SensorHeaders = Readonly<z.infer<typeof SensorHeadersSchema>>;

export class SensorPrimitive extends BasePrimitive<SensorHeaders> {
  static readonly kind = "sensor" as const;
  readonly kind = SensorPrimitive.kind;

  /** What this kind requires beyond the common headers, declared where its
   *  contract is: it is read both where a file is checked and where one is
   *  scaffolded (FR-004, FR-039). */
  static override readonly requires = { signal: "line", run: "line" } as const satisfies RequiredHeaders;

  /** The schema its headers are read by: what `headersOf` refuses a file
   *  against, and what says the shape of every header this kind takes, required
   *  or not (FR-004). */
  static override readonly schema = SensorHeadersSchema;

  /** When a reader of this charter is to open this kind at all, said
   *  where the kind's contract is: the neutral surface lists one
   *  line per kind and none of them is written down twice (FR-002). */
  static readonly activatesWhen = "the `signal` it names is raised, and the harness runs what it says to `run`";

  /** A sensor as an author writes one: what a refused header is fixed with. */
  static readonly sample: SensorHeaders = {
    id: "test-on-stop",
    description: "Run the tests when the agent stops.",
    signal: "Stop",
    run: "pnpm test",
  };

  /** One sensor, or every fault its headers have (FR-004). */
  static of(record: Readonly<Record<string, unknown>>, body: string, assets: readonly AssetFile[] = [], primitiveLayer?: PrimitiveLayer): SensorPrimitive {
    return new SensorPrimitive(headersOf(SensorPrimitive, SensorHeadersSchema, record), body, assets, primitiveLayer);
  }
}
