import { DomainFault } from "./domain.fault.js";

/**
 * What a driven adapter raises when what stands behind its port refuses: git,
 * the credential store. Nothing is wrong with the charter; the message says
 * what the tool said, and the fix what to check on this machine.
 *
 * A `DomainFault` still, so a driver reports it as it reports any other: one
 * message, one next move.
 */
export class AdapterFault extends DomainFault {}

/** What an adapter raises when an mcp origin refuses the credential a call was made
 *  with (`401`): the one refusal the caller can do something about, by renewing
 *  and asking again (FR-151). */
export class UnauthorizedMcpFault extends AdapterFault {}

// What the shared adapters raise.

/** A path from a folder that starts at `/` or steps out of it with `..`, or
 *  an address outside the folder an adapter was set up on (CORE-FR-044). */
export class PathOutsideFolderFault extends AdapterFault {}

/** A file the disk would not let be read. */
export class UnreadableFileFault extends AdapterFault {}

/** A folder the disk would not let be listed. */
export class UnreadableFolderFault extends AdapterFault {}

/** A file the disk would not let be written. */
export class UnwritableFileFault extends AdapterFault {}

/** A folder the disk would not let be taken away. */
export class UndeletableFolderFault extends AdapterFault {}

/** An mcp origin that did not answer in the time it was given (FR-152). */
export class UnansweringMcpOriginFault extends AdapterFault {}

/** An mcp origin that could not be reached or started, or failed a call
 *  (FR-152, FR-154). */
export class UnreachableMcpOriginFault extends AdapterFault {}

/** An address that names no folder: its path does not start at `/`, or does
 *  not end in the separator a folder needs (SDK-FR-010). */
export class NoFolderAddressFault extends AdapterFault {}

/** A file a test's map of files was asked for and does not hold. */
export class MissingHeldFileFault extends AdapterFault {}

/** A file reader handed that sets up no reader over another folder, so `cw`'s
 *  own sessions store cannot read the home (SDK-FR-020). */
export class MissingFolderReaderFault extends AdapterFault {}

// What the charter's adapters raise.

/** An output or a projection asked for a checkout that its class built over
 *  another folder: an extending class whose constructor takes other
 *  arguments, and that does not build itself over the checkout (EVAL-FR-021). */
export class UnbuiltCheckoutAdapterFault extends AdapterFault {}

/** A primitive's index.md where one is already written (FR-039). */
export class OccupiedPrimitiveFileFault extends AdapterFault {}

/** Two primitives whose folders would hold one another's files (CORE-FR-199). */
export class OverlappingPrimitiveFoldersFault extends AdapterFault {}

/** A file that would land outside the folder it belongs in (CORE-FR-044). */
export class FileOutsideFolderFault extends AdapterFault {}

/** A repository, or a source, laid out the old way (CORE-FR-226). */
export class OldLayoutFault extends AdapterFault {}

/** Vendor folders laid out the way an earlier version installed them (FR-180). */
export class OldVendorLayoutFault extends AdapterFault {}

/** A machine with no git to reach a source with (CORE-FR-205). */
export class MissingGitFault extends AdapterFault {}

/** A temporary store for a source that could not be made. */
export class UnwritableSourceStoreFault extends AdapterFault {}

/** A repository whose git config git could not read. */
export class UnreadableGitConfigFault extends AdapterFault {}

/** A source git could not fetch (FR-031). */
export class UnreachableSourceFault extends AdapterFault {}

/** A fetched source whose files could not be listed or read. */
export class UnreadableFetchedSourceFault extends AdapterFault {}

/** A link on the way to a folder a source would be written into (CORE-FR-044). */
export class LinkedFolderFault extends AdapterFault {}

/** A folder a source could not be checked out into. */
export class FailedCheckoutFault extends AdapterFault {}

/** What a folder held, which a failed checkout could not put back. */
export class UnrestoredFolderFault extends AdapterFault {}

/** A folder a checkout left beside the one it replaced, which could not be deleted. */
export class LeftoverFolderFault extends AdapterFault {}

/** A key the keychain cannot keep a secret under (FR-149). */
export class UnkeepableSecretKeyFault extends AdapterFault {}

/** A platform whose credential store cw does not know (FR-149). */
export class UnsupportedPlatformFault extends AdapterFault {}

/** A credential store that refused to read, write or remove a secret (FR-149). */
export class RefusedSecretStoreFault extends AdapterFault {}

/** A sign-in nobody came back from in time (FR-148). */
export class SignInTimedOutFault extends AdapterFault {}

/** A sign-in that came back without an authorization (FR-148). */
export class RefusedSignInFault extends AdapterFault {}

/** A sign-in that failed on the way, or ended without a token (FR-148). */
export class FailedSignInFault extends AdapterFault {}

/** A renewal of a sign-in that failed on the way (FR-151). */
export class FailedRenewalFault extends AdapterFault {}

// What the runtime's adapters raise.

/** An agent's command line that stopped with an error (EVAL-FR-004). */
export class FailedAgentCliFault extends AdapterFault {}

/** An agent's command line that answered with an error, such as one not
 *  signed in (EVAL-FR-004). */
export class ErroredAgentAnswerFault extends AdapterFault {}

/** A worktree git would not add: no repository, or nothing committed
 *  (EVAL-FR-021). */
export class RefusedWorktreeFault extends AdapterFault {}

/** promptfoo and the agents' SDKs that npm would not install (EVAL-FR-019). */
export class FailedPromptfooInstallFault extends AdapterFault {}

/** A `promptfoo eval` that stopped with an error, not a failed test. */
export class FailedPromptfooEvalFault extends AdapterFault {}

/** A `promptfoo eval` that wrote no result. */
export class MissingPromptfooResultFault extends AdapterFault {}

/** One evaluation case that failed on its way, its log kept and named. */
export class FailedEvaluationCaseFault extends AdapterFault {}

/** An agent's session folder that could not be read. */
export class UnreadableSessionFolderFault extends AdapterFault {}

/** The folder of evaluation runs that could not be read. */
export class UnreadableEvaluationRunsFault extends AdapterFault {}

/** An evaluation log asked for that could not be read. */
export class UnreadableEvaluationLogFault extends AdapterFault {}

/** An evaluation log asked for that is no log `cw eval` wrote. */
export class InvalidEvaluationLogFault extends AdapterFault {}
