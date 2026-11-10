import { ApplicationFault, DomainFault } from "../../../shared/module.js";

/**
 * What the charter's applications refuse, whatever the domain and the adapters
 * say. Each is a class of its own where a driver tells it
 * apart, by the `name` its fault DTO carries, never by the class.
 */

/** A primitive whose file changed after it was opened: saving would write over
 *  that change (FR-078). The portal answers it as a 412. */
export class PrimitiveChangedFault extends ApplicationFault {}

/** A word that is no kind the charter knows (FR-001). */
export class UnknownKindFault extends ApplicationFault {}

/** An id the charter holds nothing of (FR-014). */
export class UnknownIdFault extends ApplicationFault {}

/** An id another file already claims, in any layer (FR-014). */
export class ClaimedIdFault extends ApplicationFault {}

/** A primitive this repository did not author, asked to change (FR-077). */
export class ReadOnlyPrimitiveFault extends ApplicationFault {}

/** A sign-in given no token (FR-148). */
export class EmptyTokenFault extends ApplicationFault {}

/** A sign-in at an address no mcp in the charter is at, or one it will not
 *  take a credential at (FR-148, FR-149). */
export class SignInAddressFault extends ApplicationFault {}

/**
 * One thing wrong with a charter taken as a whole.
 *
 * What it says needs more than one file to be seen: two files claiming one
 * id, a mixin nothing answers to, a rationale citing a corpus that is not
 * there. Collected under the file that has to change rather than thrown, so one
 * reading names every one of them (FR-009).
 */
export class CharterRootFault extends DomainFault {}

/**
 * One thing wrong inside one primitive file: a header its kind requires and did
 * not get, a kind nothing knows, frontmatter that does not parse (FR-002,
 * FR-004).
 *
 * Its own file is enough to know it is wrong, which is what tells it apart from
 * a `CharterRootFault`. A file usually has more than one, and an author wants
 * them all in one go, so reading throws them together rather than one at a time
 * (FR-009).
 */
export class CharterPrimitiveFault extends DomainFault {}

/**
 * One thing wrong with one test file: a case naming no file, a field nothing
 * reads, an expectation that is not an id (FR-047).
 *
 * Its own file is the file that has to change, which is what tells it apart from
 * a `CharterRootFault` — and it is no primitive's fault either, because a test
 * is not a primitive: nothing compiles it, and an agent is instructed by none of
 * it.
 */
export class TestSuiteFault extends DomainFault {}

/**
 * One expectation the charter did not meet (FR-048).
 *
 * Nothing is wrong with the file it was written in — it reads, and what it puts
 * is a fair question — so this is not a `TestSuiteFault`: what has to change is
 * the charter, or the expectation about it, and the fix says which of the two an
 * author is likelier to have meant.
 */
export class TestCaseFault extends DomainFault {}

/** An evaluation file that does not read as a suite of cases, or a case
 *  naming what the charter does not hold (EVAL-FR-026). */
export class EvalSuiteFault extends DomainFault {}

/** A vendor source whose address names no folder to land in (FR-044). */
export class VendorFault extends DomainFault {}
