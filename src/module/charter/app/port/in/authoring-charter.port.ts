import type { FaultDTOs } from "../../../../shared/module.js";
import { PrimitiveLayer } from "../../../domain/models/primitive/primitive-layer.value-object.js";
import type { CharterDTOs } from "./charter.dto.js";

/*
 * What a driver reads or says beside the DTOs themselves — the words a
 * charter is made of — named again here: a driver names this port and nothing
 * behind it, and dependency-cruiser refuses it anything else. No fault is
 * among them: a driver reads a fault as the DTO it is answered with.
 */

export type { LayerName } from "../../../domain/models/primitive/primitive-layer.value-object.js";

/** The names of the three layers a primitive may come from. */
export const BUILTIN_LAYER_NAME = PrimitiveLayer.BUILTIN.name;
export const REPO_LAYER_NAME = PrimitiveLayer.REPO.name;
export const VENDOR_LAYER_NAME = PrimitiveLayer.vendorName;

/** What one primitive's author answered, under the header each answer fills
 *  in: a line, or the entries of a list — not yet read by the kind's schema,
 *  which is what refuses what the kind will not take. */
export type UnparsedHeaders = Readonly<Record<string, string | readonly string[]>>;

/** One mcp origin a token is asked for: the address its credential is kept
 *  under, its endpoint where it has one, and the id of an mcp at it, which
 *  `cw mcp auth` signs in by. */
export interface McpOriginAddress {
  readonly address: string;
  readonly endpoint?: string;
  readonly mcpId: string;
}

/**
 * DRIVER PORT — charter authoring: its primitives, the vendors it
 * installs, the test and eval cases written beside it, testing it, and the mcp
 * origins it reaches, signed in to (CORE-FR-222). Runtime asks it, through
 * this port alone, for a token to an mcp origin (CORE-FR-229).
 *
 * What is authored is what a repository keeps, so nothing here reads what the
 * repository configured itself with, and nothing needs it to be under version
 * control: a vendor's source is fetched, and nothing of the repository's own
 * history is asked. Its settings are the build's.
 *
 * Every answer is a DTO, told apart from the others it may be by its `type`: a
 * driver reads what the engine said and never holds a model of the engine's.
 * Whatever stops an operation is among them, a `FaultDTOs.Fault`, and never
 * thrown: an internal one is logged and said in the system's own words
 * (SDK-FR-004, SDK-FR-017, SDK-FR-018).
 */
export interface ForAuthoringCharter {
  /**
   * What this repository's charter holds, listed (FR-011, FR-012).
   *
   * Reads and says: there is no way through this to write anything (FR-041).
   * What comes back is the listing the charter compiles to and not a second
   * one made for this command, so what a user reads and what an agent reads
   * are the same listing said twice (SC-004).
   *
   * Narrowed to one kind where a kind is named, and the whole charter where none
   * is. The word is taken as typed: whether it is a kind at all is asked behind
   * this port, and a word that is none is answered as one fault rather than under a file, since it
   * leaves nothing to narrow by and there is no file it is wrong with.
   *
   * A charter with an error is refused with nothing listed and the errors given
   * back, for the reason a build is: a listing of a charter that does not hold
   * would say a charter holds primitives it has not got (FR-009).
   */
  listCatalogue(kind?: string): Promise<CharterDTOs.Catalogue | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;

  /**
   * Every primitive of every layer, off the charter as it was read rather than
   * the catalogue it compiles to: each with its file, the layer it arrived in,
   * and every header it declared (FR-112, FR-114). What the portal lists by;
   * `listCatalogue` stays what an agent surveys by.
   *
   * Given a word, only the primitives that mention it — in the id, the
   * kind, the description, when the kind comes up, the file or any header
   * value, ignoring case.
   *
   * A charter with an error is refused with nothing listed and the errors given
   * back, as `listCatalogue` refuses it.
   */
  listPrimitives(searchText?: string): Promise<CharterDTOs.Primitives | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;

  /**
   * Which file declares one id, and which layer that file arrived in
   * (FR-017, SC-006); the mixins it uses and the corpus it cites, and what
   * uses, cites or names it (FR-014, FR-163).
   *
   * Reads and says, as `listCatalogue` does: there is no way through this to write
   * anything (FR-041).
   *
   * The id is taken as typed. Text that is not an id, `<kind>:<id>` among it, and an
   * id this charter holds nothing of, are answered as one fault rather than under a file,
   * for the reason an unknown kind is: there is no file it is wrong with, and
   * nothing to explain.
   *
   * A charter with an error explains nothing and hands the errors back, the way
   * a listing does: a charter that does not hold would answer for a primitive it
   * has not got (FR-009). The collision SC-006 asks about is among those errors,
   * naming both files that claim the id, so it is read where every other
   * fault is.
   */
  explainPrimitive(id: string): Promise<CharterDTOs.ExplanationOutcome | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;

  /**
   * What one kind takes of whoever authors a primitive of it: each header,
   * whether it holds a line or a list, and whether a file written without it is
   * refused (FR-004, FR-039).
   *
   * Every header the kind takes is named, not only the ones it refuses a file
   * without: a header an author may write is one they have to know the shape of,
   * and the shape is read off the same schema the file is refused against.
   *
   * Reads and says, as `listCatalogue` does: there is no way through this to write
   * anything (FR-041). No charter is read either — what a kind demands is the
   * kind's own contract, and it is the same in a repository that has authored
   * nothing.
   *
   * What it is for is the asking: whoever has an author in front of them has one
   * question per header the kind requires, and does not have to know the kinds
   * to put them. A word
   * that is no kind is answered as one fault rather than under a file, the way a listing's is:
   * there is no file it is wrong with, and what comes back names every kind
   * there is.
   */
  listPrimitiveRequirements(kind: string): Promise<CharterDTOs.PrimitiveRequirements | FaultDTOs.Fault>;

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
  listKinds(): Promise<CharterDTOs.PrimitiveKinds | FaultDTOs.Fault>;

  /**
   * One primitive written where its kind's primitives are authored (FR-039).
   *
   * Writes exactly one file. What arrives is what the kind was asked for —
   * `listPrimitiveRequirements` said which headers, and these are the
   * answers — so the asking belongs to whoever had an author to ask and the
   * checking belongs here: answers the kind refuses come back as the faults they
   * are and no file is written (FR-004). What it gives back is the primitive as
   * `explainPrimitive` would say it — its id, the file it went into, this
   * repository's layer — so a caller can say it without going and looking.
   *
   * The body is what its author typed, and empty where none was: at the command
   * line the body is written in an editor afterwards (FR-117).
   *
   * Nothing is compiled: a build is the command that compiles a charter
   * (FR-020, FR-079).
   *
   * A word that is no kind, and an id the charter already holds in any
   * layer, are answered as one fault rather than under a file: neither leaves a file to report a
   * fault under, and the second names the file already holding it.
   */
  addPrimitive(
    kind: string,
    id: string,
    headers: UnparsedHeaders,
    body?: string,
  ): Promise<CharterDTOs.Primitive | FaultDTOs.Faults | FaultDTOs.Fault>;

  /**
   * One primitive as the charter read it — its headers, its body, the file
   * and the layer — and the hash of it written out, what a save is made over
   * (FR-075, FR-078).
   *
   * Reads and says: there is no way through this to write anything (FR-041).
   * Asked of the files as read rather than of the validation, so a primitive
   * opens whatever else in the charter is wrong. An id the charter holds
   * nothing of is answered as a fault, as `explainPrimitive` answers it.
   */
  openPrimitive(id: string): Promise<CharterDTOs.Primitive | FaultDTOs.Fault>;

  /**
   * One repository primitive's headers and body written over, its kind, id and
   * file kept (FR-075).
   *
   * Refused, as a fault, with nothing written for a vendored or builtin primitive, naming
   * where it came from (FR-077), and for a primitive that, read again, no
   * longer has the hash it was opened at, `openedHash`, naming the file
   * (FR-078). Answers the kind will not take come back as the faults `addPrimitive`
   * gives for them. Nothing is compiled or committed
   * (FR-079).
   */
  rewritePrimitive(
    id: string,
    headers: UnparsedHeaders,
    body: string,
    openedHash: string,
  ): Promise<CharterDTOs.Primitive | FaultDTOs.Faults | FaultDTOs.Fault>;

  /**
   * One repository primitive's file taken away, and nothing else (FR-076):
   * what still names it is reported dangling by the next validation. Refused, as a fault, for
   * a vendored or builtin primitive, as a rewrite is (FR-077). What comes back
   * is the primitive that was removed. Nothing is compiled or committed
   * (FR-079).
   */
  removePrimitive(id: string): Promise<CharterDTOs.Primitive | FaultDTOs.Fault>;

  /**
   * Install one source under this repository's vendor folder, pinned to this
   * version where one is named (FR-023, FR-027).
   *
   * The source is passed on as it was written: which transport it names and
   * whether the credentials for it are there is version control's business, and
   * what it says when it refuses is what the caller is told (FR-031).
   *
   * Installing one that is already there brings it up to date instead, so a
   * repository has one way of saying what it wants rather than two (FR-030).
   *
   * The folder need not be a repository; a machine without git is refused
   * (CORE-FR-205). What it installs is left unstaged for the user to read and
   * commit, whatever else is in hand (CORE-FR-190).
   *
   * What is taken is read off the source's shape where neither `selectedSkillIds` nor
   * `selectedCharterNames` is given: its one charter, else every charter under its
   * `charters/`, else every skill under its `skills/` (CORE-FR-193).
   * `selectedCharterNames` picks charters from `charters/`, each installed whole in a
   * vendor folder of its own (CORE-FR-195, CORE-FR-196); `selectedSkillIds` takes
   * skills from `skills/`, every one it holds where the shape takes them and
   * none is named, asking nothing (CORE-FR-184, CORE-FR-188).
   *
   * What it answers is each folder it filled, and the primitives installed
   * there, each skill with the headers its `SKILL.md` declared that were left
   * out (CORE-FR-186).
   */
  addVendor(
    sourceUri: string,
    version?: string,
    selectedSkillIds?: readonly string[],
    selectedCharterNames?: readonly string[],
  ): Promise<CharterDTOs.VendorAddOutcome | FaultDTOs.Fault>;

  /** Copy source primitives into the own charter, unstaged, refusing collisions before writing (CORE-FR-198–200). */
  injectVendor(
    sourceUri: string,
    version?: string,
    selectedSkillIds?: readonly string[],
    selectedCharterNames?: readonly string[],
  ): Promise<CharterDTOs.VendorAddOutcome | FaultDTOs.Fault>;

  /**
   * Take one installed charter away, named by the folder it was installed as
   * (FR-030), and answer that folder.
   *
   * Named by the folder rather than by the address it came from: the folder is
   * what a reader of this repository sees, and what the charter is read out of.
   *
   * Its folder is left gone in the working tree for the user to commit, whatever
   * else is in hand, in a repository or out of one. A name no vendor folder
   * answers to is refused, changing nothing (CORE-FR-204).
   */
  removeVendor(name: string): Promise<CharterDTOs.VendorFolder | FaultDTOs.Fault>;

  /**
   * Every folder a source was installed as, under this repository's vendor
   * folder, sorted (FR-053, FR-122).
   *
   * The folder is all there is to say: nothing is recorded of where one came
   * from or at which version, since version control keeps no such record
   * either and a record kept beside it is one more thing to drift (FR-046).
   */
  listVendors(): Promise<CharterDTOs.VendorFolders | FaultDTOs.Fault>;

  /**
   * Every test file under `.cw/charter/test/`, run or not: its name, its text, and its
   * description and cases — or, for a file that does not read, why (FR-124).
   *
   * Reads and says, and reads no charter: nothing is resolved here, which is
   * what testing the charter does. A file that does not read is listed all the
   * same, since it is the one its author most needs to open.
   */
  listTestSuites(): Promise<CharterDTOs.TestSuites | FaultDTOs.Fault>;

  /**
   * A new test file, under a name no other test file has, holding one sample
   * case that reads as a suite (FR-091). What comes back is its name.
   */
  addTestSuite(): Promise<CharterDTOs.TestSuiteName | FaultDTOs.Fault>;

  /**
   * One existing test file written over with this text (FR-090). Text that does
   * not read as a suite is answered as a fault with the refusal and sample `cw test` gives,
   * and nothing is written; so is a name that is no test file. What comes back
   * is its name.
   */
  writeTestSuite(name: string, text: string): Promise<CharterDTOs.TestSuiteName | FaultDTOs.Fault>;

  /**
   * One test file taken away, and nothing else (FR-092). A name that is no test
   * file is answered as a fault. What comes back is its name.
   */
  removeTestSuite(name: string): Promise<CharterDTOs.TestSuiteName | FaultDTOs.Fault>;

  /**
   * Every file of evaluation cases, evaluated or not: its name, its text, and
   * its description and cases — or, for a file that does not read, why
   * (CORE-FR-222). Reads and says, and reads no charter: whether a case names
   * what the charter holds is evaluating's to say.
   */
  listEvalSuites(): Promise<CharterDTOs.EvalSuites | FaultDTOs.Fault>;

  /**
   * A new file of evaluation cases, under a name no other has, holding one
   * sample case that reads as a suite. What comes back is its name.
   */
  addEvalSuite(): Promise<CharterDTOs.EvalSuiteName | FaultDTOs.Fault>;

  /**
   * One existing file of evaluation cases written over with this text. Text
   * that does not read as a suite is answered as a fault, with a sample, and
   * nothing is written; so is a name that is no such file. What comes back is
   * its name.
   */
  writeEvalSuite(name: string, text: string): Promise<CharterDTOs.EvalSuiteName | FaultDTOs.Fault>;

  /**
   * One file of evaluation cases taken away, and nothing else. A name that is
   * no such file is answered as a fault. What comes back is its name.
   */
  removeEvalSuite(name: string): Promise<CharterDTOs.EvalSuiteName | FaultDTOs.Fault>;

  /**
   * Every address an mcp origin of the charter takes a sign-in at, ordered by
   * address, and whether the developer has signed in there (FR-150). Asks
   * nothing and changes nothing: a credential past its expiry is still signed
   * in, since it is renewed when it is used.
   */
  listSignInStatuses(): Promise<CharterDTOs.SignInStatuses | FaultDTOs.Fault>;

  /**
   * Keep this token as the developer's credential at this address, replacing
   * whatever was kept there (FR-148, FR-149). Refused, keeping nothing, for an
   * address no mcp origin is at, one that takes no token, or an empty token.
   * What comes back is the address, signed in.
   */
  signInWithToken(address: string, token: string): Promise<CharterDTOs.SignInStatus | FaultDTOs.Fault>;

  /**
   * Sign in at this address in the developer's browser, and keep what the mcp origin
   * issued (FR-148). `showAuthorizationUrl` is handed the address to open.
   * Refused, keeping nothing, for an address no mcp origin is at or one that takes
   * no OAuth sign-in. What comes back is the address, signed in.
   */
  signInWithOAuth(
    address: string,
    showAuthorizationUrl: (authorizationUrl: string) => void,
  ): Promise<CharterDTOs.SignInStatus | FaultDTOs.Fault>;

  /**
   * Every situation this repository wrote down, resolved against its charter
   * (FR-048, FR-049, FR-050). Runs nothing, fetches nothing and asks no agent.
   * A charter with an error, or a test file that does not read, resolves
   * nothing and is answered as its faults (FR-009). Reads and says (FR-041).
   */
  testCharter(): Promise<CharterDTOs.TestRunReport | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;

  /**
   * A folder per kind for a charter to be authored in, and the parts kept
   * beside it, laid out where nothing is yet (FR-037, CORE-FR-224). Run again,
   * it discards nothing anybody wrote. What comes back is where the charter
   * is kept.
   */
  setUpCharter(): Promise<CharterDTOs.CharterLayout | FaultDTOs.Fault>;

  /** Where the charter is kept, refused where the repository is laid out the
   *  old way, naming the skill that moves it (CORE-FR-226): what a driver asks
   *  before any command. */
  readCharterLayout(): Promise<CharterDTOs.CharterLayout | FaultDTOs.Fault>;

  /**
   * The developer's access token to this mcp origin, renewed first where it
   * has expired or `isRefused` says the mcp origin has just refused it (FR-151,
   * SC-035). An mcp origin nobody signed in to, or whose credential cannot be
   * renewed, is answered as a fault naming the command that signs in again; one
   * at plain `http` on another machine is refused before anything is read.
   */
  getAccessToken(
    mcpOriginAddress: McpOriginAddress,
    isRefused: boolean,
  ): Promise<CharterDTOs.AccessToken | FaultDTOs.Fault>;
}
