import { z } from "zod";
import { SIGNALS } from "../charter/primitive/SensorPrimitive.js";
import { PrimitiveIdentitySchema, type PrimitiveIdentity } from "../charter/primitive/Primitive.js";

/**
 * What a case may say (FR-047).
 *
 * Three shapes, and only three, because only three things about a charter are
 * decided without an agent: a touched file matches a guide's globs, a raised
 * event is the one a sensor names, and a touched file is denied by a posture.
 * Everything else a charter holds — which skill a request wants, which agent
 * gets delegated to — is the agent's reading of words and not this engine's, so
 * it is not something a test here can assert (FR-049).
 *
 * An identity is `kind:id`, the way the whole charter names a primitive
 * (FR-014) — checked here against what an author typed rather than against what
 * a primitive declared. Every object is strict, and that is what closes the
 * set: a case holding both a `do` and a `when` is no branch of this union, and
 * neither is one raising an event and expecting a permission — an event touches no file for the charter
 * to allow or refuse. So the shapes nothing could ever answer do not exist to
 * be handled.
 */
export const TestCaseSchema = z.union([
  z.strictObject({
    do: z.strictObject({ touchFile: z.string().min(1) }),
    expect: z.union([
      z.strictObject({ activate: PrimitiveIdentitySchema }),
      z.strictObject({ allow: z.boolean() }),
    ]),
  }),
  z.strictObject({
    when: z.enum(SIGNALS),
    expect: z.strictObject({ run: PrimitiveIdentitySchema }),
  }),
]);

/**
 * One situation a test pins down, and what the charter is expected to make of
 * it (FR-047).
 *
 * A class rather than the record the schema read, because two things are asked
 * of a case wherever one turns up — the situation it puts, which a run reports
 * it under, and the identity it names, which an explanation finds it by
 * (FR-014, FR-048) — and neither is worth working out from the three shapes
 * twice. Every case the schema reads is made one, so nothing downstream meets
 * the record on its own.
 *
 * What was written is kept as it was read: which of the three shapes a case is
 * decides how it resolves, and that is the resolver's question to ask of it.
 */
export class TestCase {
  constructor(readonly written: z.infer<typeof TestCaseSchema>) {}

  /** The situation it puts, said as a line, and what it expects of it: what a
   *  run reports it under, and what an explanation names it by (FR-048,
   *  FR-014). */
  describe(): string {
    return `${this.situation} ${this.expectation}`;
  }

  /** The situation it puts: the file it touches, or the event it raises. */
  get situation(): string {
    return "when" in this.written ? `firing event ${this.written.when}` : `touching ${this.written.do.touchFile}`;
  }

  /** What it expects the charter to make of its situation. */
  get expectation(): string {
    const written = this.written;
    if ("when" in written) return `runs ${written.expect.run}`;
    if ("activate" in written.expect) return `activates ${written.expect.activate}`;
    return `is ${written.expect.allow ? "allowed" : "denied"}`;
  }

  /**
   * Which primitive this case expects to be activated: the sensor a raised event
   * is expected to run, or the guide a touched file is expected to bring up
   * (FR-014).
   *
   * Nothing for the third shape. That one expects a touched file to be allowed
   * or denied, which every posture in the charter answers between them, so it
   * activates no one primitive by name.
   */
  get activatedIdentity(): PrimitiveIdentity | undefined {
    if ("when" in this.written) return this.written.expect.run;
    if ("activate" in this.written.expect) return this.written.expect.activate;
    return undefined;
  }
}
