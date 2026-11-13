import { ApplicationFault, DomainFault } from "../../../shared/module.js";

/**
 * What the charter's applications and domain refuse, whatever the adapters
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

/** A sign-in at an address no mcp in the charter is at (FR-148, FR-149). */
export class UnknownSignInAddressFault extends ApplicationFault {}

/** A sign-in by a method the mcp origin at that address does not take
 *  (FR-148). */
export class UnsupportedSignInMethodFault extends ApplicationFault {}

/** A vendor folder asked for by a name no installed vendor is under (FR-030). */
export class UnknownVendorFault extends ApplicationFault {}

/** A vendor source whose shape gives nothing to take as asked: no charter, no
 *  `charters/` or `skills/` holding what was named, or names that collide
 *  (CORE-FR-193). */
export class UnexpectedSourceShapeFault extends ApplicationFault {}

/** A test file asked for by a name no test file is under (FR-090, FR-092). */
export class UnknownTestSuiteFault extends ApplicationFault {}

/** An evaluation file asked for by a name no evaluation file is under. */
export class UnknownEvalSuiteFault extends ApplicationFault {}

/** An mcp origin at plain `http` on another machine, where a credential would
 *  travel in the clear (SC-035). */
export class InsecureEndpointFault extends ApplicationFault {}

/** An mcp origin nobody has signed in to (FR-151). */
export class NotSignedInFault extends ApplicationFault {}

/** A sign-in past its expiry that could not be renewed (FR-151). */
export class ExpiredSignInFault extends ApplicationFault {}

/** An agent this engine was composed to compile for none of (FR-033). */
export class UncompiledAgentFault extends ApplicationFault {}

/** A build whose files the disk refused to write (SC-003). */
export class UnwrittenBuildFault extends ApplicationFault {}

/** No list of mcp origins laid yet: nothing has been built (FR-152). */
export class MissingMcpOriginsFault extends ApplicationFault {}

/** A list of mcp origins laid that does not read as one (FR-152). */
export class UnreadableMcpOriginsFault extends ApplicationFault {}

/** A tool an mcp declares that its mcp origin does not list (FR-153). */
export class UnlistedMcpToolFault extends ApplicationFault {}

/** An mcp origin a build could not ask for its tools (FR-153). */
export class UnlistableMcpToolsFault extends ApplicationFault {}

/**
 * One thing wrong with a charter taken as a whole.
 *
 * What it says needs more than one file to be seen: two files claiming one
 * id, a mixin nothing answers to, a rationale citing a corpus that is not
 * there. Collected under the file that has to change rather than thrown, so one
 * reading names every one of them (FR-009).
 */
export class InconsistentCharterFault extends DomainFault {}

/**
 * One thing wrong inside one primitive file: a header its kind requires and did
 * not get, a kind nothing knows, frontmatter that does not parse (FR-002,
 * FR-004).
 *
 * Its own file is enough to know it is wrong, which is what tells it apart from
 * an `InconsistentCharterFault`. A file usually has more than one, and an author wants
 * them all in one go, so reading throws them together rather than one at a time
 * (FR-009).
 */
export class InvalidPrimitiveFault extends DomainFault {}

/**
 * One thing wrong with one test file: a case naming no file, a field nothing
 * reads, an expectation that is not an id (FR-047).
 *
 * Its own file is the file that has to change, which is what tells it apart from
 * an `InconsistentCharterFault` — and it is no primitive's fault either, because a test
 * is not a primitive: nothing compiles it, and an agent is instructed by none of
 * it.
 */
export class InvalidTestSuiteFault extends DomainFault {}

/**
 * One expectation the charter did not meet (FR-048).
 *
 * Nothing is wrong with the file it was written in — it reads, and what it puts
 * is a fair question — so this is not an `InvalidTestSuiteFault`: what has to change is
 * the charter, or the expectation about it, and the fix says which of the two an
 * author is likelier to have meant.
 */
export class UnmetExpectationFault extends DomainFault {}

/** An evaluation file that does not read as a suite of cases, or a case
 *  naming what the charter does not hold (EVAL-FR-026). */
export class InvalidEvalSuiteFault extends DomainFault {}

/** A vendor whose primitives have no folder to land in: the store refused
 *  where they would go (FR-167). */
export class UnplaceableVendorFault extends DomainFault {}

/** A vendor source whose address names no owner and repository, so no
 *  folder to land in (FR-044). */
export class InvalidSourceAddressFault extends DomainFault {}

/** Vendor folders laid out the way an earlier version installed them (FR-044). */
export class OldVendorLayoutFault extends DomainFault {}

/** A charter of a source named as a kind is, or as the source's own charter,
 *  whose vendor folder would be another's (CORE-FR-195). */
export class ReservedCharterNameFault extends ApplicationFault {}

/** A primitive no test case names, so nothing notices when it stops coming
 *  up where it should (FR-048). */
export class UntestedPrimitiveFault extends DomainFault {}

/** A `SKILL.md` of a vendor source that does not read as a skill: no
 *  frontmatter, or headers a skill will not take (CORE-FR-184). */
export class InvalidSourceSkillFault extends DomainFault {}

/** A primitive an author answered, asked for an index.md it has not got. */
export class MissingIndexTextFault extends DomainFault {}

/** The compiled output holding no item of a class every build adds: the
 *  engine's own fault (FR-021). */
export class MissingCharterOutputItemFault extends DomainFault {}

/** An item of the compiled output, of a class the output's layout places nowhere: the
 *  engine's own fault (CORE-FR-220). */
export class UnplaceableCharterOutputItemFault extends DomainFault {}
