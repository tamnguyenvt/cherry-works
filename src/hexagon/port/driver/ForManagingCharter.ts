import type { AgentProvider } from "../../domain/models/AgentProvider.js";
import type { DataDTOs, OutcomeDTOs } from "./dtos/index.js";

/** What a driver reads or says beside the DTOs themselves — the fault a use
 *  case raises, the words a charter is made of — named again here: a driver
 *  names this port and nothing behind it, and dependency-cruiser refuses it
 *  anything else. */
export { DomainFault } from "../../domain/models/DomainFault.js";
export { AGENT_PROVIDERS, isAgentProvider, type AgentProvider } from "../../domain/models/AgentProvider.js";
export { BUILTIN_LAYER, REPO_LAYER, VENDOR_LAYER, type LayerName } from "../../domain/models/charter/PrimitiveLayer.js";
export { TEST_DIRECTORY } from "../../domain/path.js";

/**
 * DRIVER PORT — everything the engine offers to be driven with. The command
 * line calls this; the later interface calls the same one.
 *
 * One port rather than one per kind of use case: managing a charter is one
 * conversation, and the reader/writer split (FR-041) is what each use case is
 * rather than what it is grouped under — `doctor` reads and says, and there
 * is no way through it to write anything.
 *
 * Every answer is a DTO, told apart from the others it may be by its `type`: a
 * driver reads what the engine said and never holds a model of the engine's.
 */
export interface ForManagingCharter {
  /**
   * The four questions about this repository, asked in one go (FR-040): which
   * agents it compiles for, what validating its charter finds, which installed
   * charters have been edited here, and how many of those four are unwell.
   *
   * What validating finds is everything wrong with the charter, under the file
   * that has to change, named from the repository. Warnings come back with the
   * errors, since a warning is worth saying and not worth stopping on; which of
   * them stop a build is each one's severity (FR-005). Given back rather than
   * thrown: a caller asking what is wrong is not surprised by the answer
   * (FR-009). Counted too — how many are errors and how many warnings, and how
   * many files a build would still change, the preview run for it where the
   * charter holds and nothing where it does not.
   *
   * Reads and says: there is no way through this to write anything (FR-041).
   * Whether each question is well is part of the answer rather than something a
   * caller works out, so the command line and the portal report one repository
   * the same way (SC-003).
   *
   * Which repository is asked is what this was constructed with and not what
   * each call passes: one of these speaks for one repository, so a caller names
   * it once and no use case can be pointed somewhere else halfway through
   * (FR-008).
   */
  doctor(): Promise<OutcomeDTOs.DoctorOutcome>;

  /**
   * What this repository's charter holds, listed (FR-011, FR-012).
   *
   * Reads and says, as `doctor` does: there is no way through this to write
   * anything (FR-041). What comes back is the listing the charter compiles to
   * and not a second one made for this command, so what a user reads and what an
   * agent reads are the same listing said twice (SC-004).
   *
   * Narrowed to one kind where a kind is named, and the whole charter where none
   * is. The word is taken as typed: whether it is a kind at all is asked behind
   * this port, and a word that is none is raised rather than given back, since it
   * leaves nothing to narrow by and there is no file it is wrong with.
   *
   * A charter with an error is refused with nothing listed and the errors given
   * back, for the reason a build is: a listing of a charter that does not hold
   * would say a charter holds primitives it has not got (FR-009).
   */
  list(kind?: string): Promise<DataDTOs.Catalogue | DataDTOs.FaultsByFile>;

  /**
   * Every primitive of every layer, off the charter as it was read rather than
   * the catalogue it compiles to: each with its file, the layer it arrived in,
   * and every header it declared (FR-112, FR-114). What the portal lists by;
   * `list` stays what an agent surveys by.
   *
   * Given a word, only the primitives that mention it — in the id, the
   * kind, the description, when the kind comes up, the file or any header
   * value, ignoring case.
   *
   * A charter with an error is refused with nothing listed and the errors given
   * back, as `list` refuses it.
   */
  fullList(matching?: string): Promise<DataDTOs.Primitives | DataDTOs.FaultsByFile>;

  /**
   * Which file declares one id, and which layer that file arrived in
   * (FR-017, SC-006); the mixins it uses and the corpus it cites, and what
   * uses, cites or names it (FR-014, FR-163).
   *
   * Reads and says, as `doctor` and `list` do: there is no way through this to
   * write anything (FR-041).
   *
   * The id is taken as typed. Text that is not an id, `<kind>:<id>` among it, and an
   * id this charter holds nothing of, are raised rather than given back,
   * for the reason an unknown kind is: there is no file it is wrong with, and
   * nothing to explain.
   *
   * A charter with an error explains nothing and hands the errors back, the way
   * a listing does: a charter that does not hold would answer for a primitive it
   * has not got (FR-009). The collision SC-006 asks about is among those errors,
   * naming both files that claim the id, so it is read where every other
   * fault is.
   */
  explain(id: string): Promise<OutcomeDTOs.ExplanationOutcome | DataDTOs.FaultsByFile>;

  /**
   * Compile this repository's charter and put it on disk: the catalogues, the
   * neutral files, and every projection each agent reads (FR-018 – FR-021).
   *
   * Writes, and is the only thing here that does. What it gives back is what it
   * did — the files written, the ones taken away because no primitive compiles
   * to them any more — so a caller can say it without going and looking.
   *
   * A charter with an error is refused with nothing written and the errors
   * given back, which are the same faults `doctor` reads and for the same reason:
   * a caller asking for a build is told why there is not one, not surprised by
   * a thrown error (FR-009).
   *
   * Nothing is ever half done: a build either wrote everything this reading of
   * the charter produces or wrote nothing at all (FR-021).
   */
  build(): Promise<DataDTOs.PlanSummary | DataDTOs.FaultsByFile>;

  /**
   * What running a build would do, and nothing done (FR-022).
   *
   * Reads and says, as `doctor` and `list` do: there is no way through this to
   * write anything (FR-041). It is the build worked out and stopped short of
   * disk — the same files compiled and the same ones found stale — so what it
   * says is what a build would do rather than a second opinion about it, in the
   * same `DataDTOs.PlanSummary` a build answers with.
   *
   * Every file a build would touch comes back, the ones it would leave exactly
   * as they are included: a repository where every file is unchanged is one
   * whose agents are reading the charter as it stands (SC-007).
   *
   * A charter with an error previews nothing and hands the errors back, the way
   * a build does and for the reason a build does (FR-009).
   */
  preview(): Promise<DataDTOs.PlanSummary | DataDTOs.FaultsByFile>;

  /**
   * Resolve every situation this repository wrote down against its charter, and
   * say how each one came out (FR-048, FR-050).
   *
   * Reads and says, as `doctor` and `list` do: there is no way through this to
   * write anything (FR-041). Nothing is run, nothing is fetched and no agent is
   * asked — resolution alone decides a case, so the same charter and the same
   * cases always come out the same way (FR-049).
   *
   * A charter with an error resolves nothing and hands the errors back, the way
   * a listing does: cases put to a charter that does not hold would be answered
   * by a charter nobody should be acting on (FR-009). A test file that is there
   * and does not read is raised rather than given back: there is nothing to
   * resolve, and reporting a run that skipped it would report a pass it does not
   * cover.
   */
  test(): Promise<DataDTOs.TestRunReport | DataDTOs.FaultsByFile>;

  /**
   * What one kind takes of whoever authors a primitive of it: each header,
   * whether it holds a line or a list, and whether a file written without it is
   * refused (FR-004, FR-039).
   *
   * Every header the kind takes is named, not only the ones it refuses a file
   * without: a header an author may write is one they have to know the shape of,
   * and the shape is read off the same schema the file is refused against.
   *
   * Reads and says, as `doctor` and `list` do: there is no way through this to
   * write anything (FR-041). No charter is read either — what a kind demands is
   * the kind's own contract, and it is the same in a repository that has
   * authored nothing.
   *
   * What it is for is the asking: whoever has an author in front of them has one
   * question per header the kind requires, and does not have to know the kinds
   * to put them. A word
   * that is no kind is raised rather than given back, the way a listing's is:
   * there is no file it is wrong with, and what comes back names every kind
   * there is.
   */
  listPrimitiveRequirements(kind: string): Promise<DataDTOs.PrimitiveRequirements>;

  /**
   * Every kind the charter knows, and when a primitive of that kind comes up
   * (FR-010).
   *
   * Reads and says, and reads no charter either: what a kind is and when it
   * applies is the kind's own contract, so the answer is the same in a
   * repository that has authored nothing. The same declarations the compiled
   * orientation says it in, so a listing and what the agent reads cannot come to
   * say different things.
   *
   * What it is for is listing: whoever shows a charter shows it by kind, and the
   * kinds a charter holds nothing of are kinds all the same.
   */
  kinds(): Promise<DataDTOs.PrimitiveKinds>;

  /**
   * One primitive written where its kind's primitives are authored (FR-039).
   *
   * Writes, as `build` does, and writes exactly one file. What arrives is what
   * the kind was asked for — `listPrimitiveRequirements` said which headers, and these are the
   * answers — so the asking belongs to whoever had an author to ask and the
   * checking belongs here: answers the kind refuses come back as the faults they
   * are and no file is written (FR-004). What it gives back is the primitive as
   * `explain` would say it — its id, the file it went into, this
   * repository's layer — so a caller can say it without going and looking.
   *
   * The body is what its author typed, and empty where none was: at the command
   * line the body is written in an editor afterwards (FR-117).
   *
   * Nothing is compiled: a build is the command that compiles a charter
   * (FR-020, FR-079).
   *
   * A word that is no kind, and an id the charter already holds in any
   * layer, are raised rather than given back: neither leaves a file to report a
   * fault under, and the second names the file already holding it.
   */
  add(
    kind: string,
    id: string,
    headers: UnparsedHeaders,
    body?: string,
  ): Promise<DataDTOs.Primitive | DataDTOs.Faults>;

  /**
   * One primitive as the charter read it — its headers, its body, the file
   * and the layer — and the hash of it written out, what a save is made over
   * (FR-075, FR-078).
   *
   * Reads and says: there is no way through this to write anything (FR-041).
   * Asked of the files as read rather than of the validation, so a primitive
   * opens whatever else in the charter is wrong. An id the charter holds
   * nothing of is raised, as `explain` raises it.
   */
  open(id: string): Promise<DataDTOs.Primitive>;

  /**
   * One repository primitive's headers and body written over, its kind, id and
   * file kept (FR-075).
   *
   * Raised with nothing written for a vendored or builtin primitive, naming
   * where it came from (FR-077), and for a primitive that, read again, no
   * longer has the hash it was opened at, `openedHash`, naming the file
   * (FR-078). Answers the kind will not take come back as the faults `add`
   * gives for them. Nothing is compiled or committed
   * (FR-079).
   */
  rewrite(
    id: string,
    headers: UnparsedHeaders,
    body: string,
    openedHash: string,
  ): Promise<DataDTOs.Primitive | DataDTOs.Faults>;

  /**
   * One repository primitive's file taken away, and nothing else (FR-076):
   * what still names it is reported dangling by the next validation. Raised for
   * a vendored or builtin primitive, as a rewrite is (FR-077). What comes back
   * is the primitive that was removed. Nothing is compiled or committed
   * (FR-079).
   */
  remove(id: string): Promise<DataDTOs.Primitive>;

  /**
   * What this repository configured itself with, on its own — no charter read
   * with it (FR-038).
   *
   * What setup needs: what the repository already chose is the default it
   * offers, and the charter has nothing to do with it. A repository that was
   * never set up configured itself with nothing, and that is what comes back.
   */
  settings(): Promise<DataDTOs.WorkspaceSettings>;

  /**
   * Whether this repository is one to serve a charter from: inside version
   * control, and set up under a charter (FR-004).
   *
   * Reads and says nothing but a refusal: a folder that is not versioned, and a
   * repository that has no settings of its own, are each raised with what to
   * run, and one that is both is told about the first. Asked by whoever is
   * about to stay open over this repository, before it is — a caller that ran
   * once can be refused by what it reads, and one that serves cannot.
   */
  ensureRepoReady(): Promise<void>;

  /**
   * Set this repository up under a charter: the workspace, a directory per
   * kind, and what it configured itself with (FR-037) — then the charter built,
   * so the skill the engine brings reaches the agent before anything is
   * authored (FR-057, FR-096).
   *
   * Takes every answer it acts on. It puts no question of its own: whoever
   * drove it had a person to ask and this has not, so what arrives here is
   * decided and what comes back is what the build did, or the faults it was
   * refused by — the repository set up either way — or a fault raised saying
   * why it is not (FR-032, FR-035).
   *
   * Re-running it is reconfiguring it: what setup writes is what setup owns,
   * and nothing authored is touched (FR-038).
   */
  init(settingsOptions: SettingsOptions): Promise<DataDTOs.PlanSummary | DataDTOs.FaultsByFile>;
}

/** What setup was answered, as one thing rather than a growing list of
 *  arguments: a question added to setup is a field added here, and every
 *  caller already passes it by name. */
export interface SettingsOptions {
  /** Which agents this repository compiles its charter for, as `.cw/settings.json`
   *  will keep them (FR-033). Empty is a repository that compiles for none and
   *  still gets the neutral surface (FR-019). */
  readonly agents: readonly AgentProvider[];
}

/** What one primitive's author answered, under the header each answer fills
 *  in: a line, or the entries of a list — not yet read by the kind's schema,
 *  which is what refuses what the kind will not take. */
export type UnparsedHeaders = Readonly<Record<string, string | readonly string[]>>;
