import { loadCharters, writeCharter } from "../service/charterRepo.js";
import { loadSettings } from "../service/settingsRepo.js";
import { loadTestSuites } from "../service/testSuitesRepo.js";
import { driftedVendors } from "../service/vendorRepo.js";
import { runSuite, TestRunReport, findUntestedPrimitives } from "../domain/services/testService.js";
import { Fault, Faults, FaultsByFile } from "../domain/models/Fault.js";
import { REPO_SCOPE, ScopedPrimitive, type CharterRoot } from "../domain/models/charter/CharterRoot.js";
import { RepoScopedPrimitive } from "../domain/specifications/RepoScopedPrimitive.js";
import type { DataDTOs, OutcomeDTOs } from "../port/driver/dtos/index.js";
import {
  catalogueDTO,
  doctorOutcomeDTO,
  explanationOutcomeDTO,
  faultsByFileDTO,
  faultsDTO,
  primitiveSnapshotDTO,
  planSummaryDTO,
  primitiveKindsDTO,
  primitiveRequirementsDTO,
  scopedPrimitiveDTO,
  scopedPrimitivesDTO,
  testRunReportDTO,
  workspaceSettingsDTO,
} from "./dtos.js";
import { contentHashOf } from "./helper.js";
import { compile } from "../domain/services/compileService.js";
import { executePlan, plan, previewPlan } from "../service/buildService.js";
import type { WorkspaceSettings } from "../domain/models/Settings.js";
import { AGENT_PROVIDERS } from "../domain/models/AgentProvider.js";
import { CHARTER_DIRECTORY, settingsFileIn, testFolderIn } from "../domain/path.js";
import type { UnparsedHeaders, ForManagingCharter, SettingsOptions } from "../port/driver/ForManagingCharter.js";
import type { ForVCS } from "../port/zdriven/ForVCS.js";
import {
  isKind,
  KINDS,
  PRIMITIVE_CLASSES,
  PrimitiveRequirements,
  identityOf,
  primitiveOf,
  primitiveHeadersOf,
  primitiveSampleOf,
  type Kind,
  type Primitive,
} from "../domain/models/charter/primitive/Primitive.js";
import type { ForReadingFiles } from "../port/zdriven/ForReadingFiles.js";
import type { ForWritingFiles } from "../port/zdriven/ForWritingFiles.js";
import type { ForParsingYaml } from "../port/zdriven/ForParsingYaml.js";

/**
 * APPLICATION SERVICE — everything the engine does with a charter, in one
 * place. Every use case here is the same two steps: read the charter, then ask
 * it. The reading is `charterRootOf`, the rules are the charter's own; what is
 * here is the order of the two and the driven ports that make it possible.
 *
 * What it answers a driver with is the DTO `./dtos.ts` makes of what the domain
 * handed back, and never the model itself (plan §3.0).
 */
export class CharterAuthoring implements ForManagingCharter {
  readonly #repoPath: URL;
  readonly #fileReader: ForReadingFiles;
  readonly #yamlParser: ForParsingYaml;
  readonly #fileWriter: ForWritingFiles;
  readonly #vcs: ForVCS;

  constructor(
    /** The repository this speaks for, named once: every use case reads the
     *  charter of one repository and writes what it compiles to under the same
     *  one, so it is what this is constructed with rather than what every call
     *  carries (FR-008). It is the directory, so it ends in a separator — a
     *  compiled file's path is resolved against it, and a URL naming a file
     *  would put them beside the repository instead of inside it. */
    repoPath: URL,
    fileReader: ForReadingFiles,
    yamlParser: ForParsingYaml,
    fileWriter: ForWritingFiles,
    vcs: ForVCS,
  ) {
    this.#repoPath = repoPath;
    this.#fileReader = fileReader;
    this.#yamlParser = yamlParser;
    this.#fileWriter = fileWriter;
    this.#vcs = vcs;
  }

  /**
   * The four questions about this repository, asked in one go (FR-040): which
   * agents it compiles for, what validating its charter finds, which installed
   * charters are edited here, and how many of those are unwell.
   *
   * Each is asked of whoever already answers it — the settings, the charter's
   * validation, version control — and whether each is well is worked out here,
   * so what `cw doctor` says and what the portal's health check says are one
   * answer said twice (SC-003). Reads and says: nothing here writes (FR-041).
   *
   * Where the charter holds, what a build would still change is the preview run
   * for it, and every guide and sensor no test case names is a warning too, so
   * the test files are read here: a file that will not read names no case, and
   * `cw test` is what refuses it (FR-014). Nothing else reads them for this — a
   * warning stops nothing, and every other use case asks only for the errors.
   * Where it does not hold, nothing is previewed (FR-005, FR-009).
   */
  async doctor(): Promise<OutcomeDTOs.DoctorOutcome> {
    const [settings, [charter, , faultsByFiles], drifted, testSuitesByFile] = await Promise.all([
      loadSettings(this.#repoPath, this.#fileReader),
      this.#read(),
      driftedVendors(this.#repoPath, this.#vcs),
      loadTestSuites(this.#repoPath, this.#fileReader),
    ]);
    if (charter === undefined) return doctorOutcomeDTO(settings, faultsByFiles, undefined, drifted, this.#repoPath);

    const testSuites = testSuitesByFile.flatMap((one) => ("suite" in one ? [one.suite] : []));
    const { cleanupPlan, projectionPlan } = await plan(this.#repoPath, charter, settings.agents, this.#fileReader);
    return doctorOutcomeDTO(
      settings,
      faultsByFiles.with(findUntestedPrimitives(charter, testSuites)),
      previewPlan(cleanupPlan, projectionPlan),
      drifted,
      this.#repoPath,
    );
  }

  /** Everything wrong with this repository's charter under the file that has to
   *  change, and — where none of it is an error — the charter and what the
   *  repository configured itself with (FR-005, FR-009): what every use case
   *  here reads before it asks the charter anything. Settings that do not read
   *  are neither: there is nothing to validate against until they do, so
   *  reading them raises rather than reports. */
  async #read(): Promise<
    readonly [CharterRoot, WorkspaceSettings, FaultsByFile] | readonly [undefined, undefined, FaultsByFile]
  > {
    // The settings are read here even though validating asks nothing of them: a
    // charter validated against settings that do not read would be validated
    // against a guess, so reading them is what refuses the run and sends the user
    // back to `cw init` (FR-037). A build is handed what this read.
    const [charter, settings] = await Promise.all([
      loadCharters(this.#repoPath, this.#fileReader, this.#yamlParser),
      loadSettings(this.#repoPath, this.#fileReader),
    ]);

    // A warning is said and lets the run through, so what comes back is every
    // fault; what stops a build is only the errors among them (FR-005).
    const faultsByFiles = charter.allFaultsByFiles;
    return faultsByFiles.errors().isEmpty ? [charter, settings, faultsByFiles] : [undefined, undefined, faultsByFiles];
  }

  /**
   * What the charter holds, listed, narrowed to one kind where one is named
   * (FR-011, FR-012).
   *
   * The listing is the one the charter compiles to, asked for the way everything
   * else is: `compile` hands back everything one reading produces, and this
   * takes the listing out of it (SC-004). No agent is named, since what an agent
   * reads is not what is being asked for here — a repository that compiles for
   * none still lists what it holds.
   *
   * Whether the word narrowing it is a kind at all is asked here, of the
   * domain that holds the set. A caller passes on what was typed and knows
   * nothing about what a kind is.
   *
   * Reads and says: this holds a writing port and never reaches for it, which is
   * what keeps a reading use case unable to write (FR-041).
   */
  async list(kind?: string): Promise<DataDTOs.Catalogue | DataDTOs.FaultsByFile> {
    // Asked before the charter is read: a word that is no kind leaves this
    // nothing to narrow by, so it is raised rather than reported — there is no
    // file it is wrong with — and a typo costs no reading (FR-001).
    if (kind !== undefined && !isKind(kind))
      throw new Fault(`"${kind}" is not a kind the charter knows.`, `Ask for one the charter knows: ${KINDS.join(", ")}.`);

    const [charter, , faultsByFiles] = await this.#read();
    if (charter === undefined) return faultsByFileDTO(faultsByFiles.errors(), this.#repoPath);

    const { catalogue } = compile(charter, []);
    return catalogueDTO(kind === undefined ? catalogue : catalogue.filterByKind(kind));
  }

  /** Every primitive the charter read, or those mentioning a word, each as the
   *  whole charter sees it (FR-112, FR-114). Whether one mentions the word is
   *  the primitive's own to say. */
  async fullList(matching?: string): Promise<DataDTOs.ScopedPrimitives | DataDTOs.FaultsByFile> {
    const [charter, , faultsByFiles] = await this.#read();
    if (charter === undefined) return faultsByFileDTO(faultsByFiles.errors(), this.#repoPath);

    return scopedPrimitivesDTO(
      matching === undefined ? charter.primitives : charter.primitives.filter((one) => one.mentions(matching)),
    );
  }

  /**
   * Which file declares one identity, which layer it arrived in, when it comes
   * up, the mixins it uses and the corpus it cites, what uses or cites it, and
   * the situations this repository wrote down about it (FR-014, FR-017).
   *
   * The charter is asked, not searched here: one identity space covers every
   * layer, and which file answers to a name, and which names one primitive
   * shares with another, are the charter's own questions (FR-014). What is here
   * is the order — read, refuse a charter that does not hold, then ask.
   *
   * An identity nothing answers to is raised rather than reported, the way a
   * word that is no kind is: there is no file it is wrong with, and the next
   * move is to go and look at what the charter does hold.
   *
   * Reads and says: this holds a writing port and never reaches for it (FR-041).
   */
  async explain(identity: string): Promise<OutcomeDTOs.ExplanationOutcome | DataDTOs.FaultsByFile> {
    // Held to the shape an identity is written in before anything is read: text
    // that is not one names nothing to look for (FR-014).
    const primitiveIdentity = identityOf(identity);
    const [charter, , faultsByFiles] = await this.#read();
    if (charter === undefined) return faultsByFileDTO(faultsByFiles.errors(), this.#repoPath);

    const declared = charter.primitiveById.get(primitiveIdentity);
    if (declared === undefined)
      throw new Fault(
        `This charter holds no "${identity}".`,
        'Run "cw list --min" to see every identity it does hold.',
      );

    // The cases are read once the identity is known: an identity the charter
    // holds nothing of has nothing to name, and a test file that will not read
    // names nothing either — there are no cases in it to match, and `cw test` is
    // the command that refuses it (plan §3.3).
    const read = await loadTestSuites(this.#repoPath, this.#fileReader);
    // Which primitive a case activates and how its situation reads are the
    // case's own to say, so both are asked of it: the situation is the same line
    // a run reports it under, and whoever read `cw test` and then asks what pins
    // this primitive down is looking at the situation they already saw. A file
    // activating it in none of its cases is left out rather than carried as an
    // empty list, the way a file nothing is wrong with is left out of the
    // faults.
    const testCasesByFile = Object.fromEntries(
      read
        .flatMap((one) =>
          "suite" in one
            ? [
                [
                  one.file,
                  one.suite.cases.filter((each) => each.activatedIdentity === primitiveIdentity).map((each) => each.describe()),
                ] as const,
              ]
            : [],
        )
        .filter(([, situations]) => situations.length > 0),
    );

    return explanationOutcomeDTO(
      declared,
      // When it comes up is its kind's to say, in the words `cw kinds` says it
      // in, so it is read off the class that reads the kind (FR-029).
      PRIMITIVE_CLASSES.find((one) => one.kind === declared.primitive.kind)!.activatesWhen,
      charter.mixinsOf(declared),
      charter.rationaleOf(declared),
      charter.hostsOf(declared),
      charter.citersOf(declared),
      testCasesByFile,
    );
  }

  /**
   * One reading of the charter, put on disk (FR-020, FR-021).
   *
   * Read, ask what is wrong, take away what the last build left, then compile and
   * write. The order is the whole of this method: a charter with an error is
   * refused before anything is touched, so a half-built surface never stands —
   * and a warning is not an error, so a rationale citing a corpus that is gone
   * still builds (FR-005, FR-009).
   *
   * Which agents are compiled for is what the repository said at setup and
   * keeps in `.cw/settings.json`, never what happens to be installed on the
   * machine running this: the same charter checked out anywhere builds the same
   * files (FR-033). A repository naming none still gets its neutral surface
   * (FR-019), and one whose settings do not read is sent back to `cw init`
   * rather than built against a guess.
   *
   * What a file holds and where it goes is `compile` and the two plans; what is
   * here is the order of the three and the ports that make it possible.
   */
  async build(): Promise<DataDTOs.PlanSummary | DataDTOs.FaultsByFile> {
    const [charter, settings, faultsByFiles] = await this.#read();
    if (charter === undefined) return faultsByFileDTO(faultsByFiles.errors(), this.#repoPath);

    const { cleanupPlan, projectionPlan } = await plan(this.#repoPath, charter, settings.agents, this.#fileReader);

    // What it will have done, read off the plans before anything moves: a build
    // says the same thing a preview of it said (FR-022).
    const planSummary = previewPlan(cleanupPlan, projectionPlan);
    await executePlan(cleanupPlan, projectionPlan, this.#fileWriter);

    return planSummaryDTO(planSummary);
  }

  /**
   * The build, worked out and stopped short of disk (FR-022).
   *
   * The same two plans a build carries out, read rather than run: planning only
   * reads, and what a preview adds is `previewPlan` in place of `executePlan`.
   * It holds a writing port, as everything here does, and reaches for none of it
   * (FR-041).
   */
  async preview(): Promise<DataDTOs.PlanSummary | DataDTOs.FaultsByFile> {
    const [charter, settings, faultsByFiles] = await this.#read();
    if (charter === undefined) return faultsByFileDTO(faultsByFiles.errors(), this.#repoPath);

    const { cleanupPlan, projectionPlan } = await plan(this.#repoPath, charter, settings.agents, this.#fileReader);
    return planSummaryDTO(previewPlan(cleanupPlan, projectionPlan));
  }

  /**
   * Every situation this repository wrote down, resolved against its charter
   * (FR-048, FR-049, FR-050).
   *
   * The same two steps every use case here is: read the charter, then ask it.
   * What is added is the cases, read off `.cw/test/` by whoever knows where they
   * live, and the resolving each one comes out of — which runs nothing, fetches
   * nothing and asks no agent, so a run is decided by the charter alone.
   *
   * A charter with an error resolves nothing, for the reason a listing lists
   * nothing, and neither does a test file that is there and will not read — both
   * come back as faults under the file that has to change (FR-009). A repository
   * that wrote no tests resolves nothing either, and that is no fault: it has
   * not pinned its charter down yet, and the command says so.
   *
   * Reads and says: this holds a writing port and never reaches for it (FR-041).
   */
  async test(): Promise<DataDTOs.TestRunReport | DataDTOs.FaultsByFile> {
    const [charter, , faultsByFiles] = await this.#read();
    if (charter === undefined) return faultsByFileDTO(faultsByFiles.errors(), this.#repoPath);

    const read = await loadTestSuites(this.#repoPath, this.#fileReader);

    // One bad file stops the run: the cases beside it would report a pass that
    // does not cover what the bad one was written to cover (FR-009). Every one
    // of them is named, not the first.
    const faults = read.flatMap((one) => ("fault" in one ? [one.fault] : []));
    if (faults.length > 0) return faultsByFileDTO(new FaultsByFile({ [testFolderIn(this.#repoPath).href]: faults }), this.#repoPath);

    return testRunReportDTO(
      new TestRunReport(read.flatMap((one) => ("suite" in one ? runSuite(charter, one.suite) : []))),
    );
  }

  /** What one kind takes of whoever authors a primitive of it, asked of the
   *  kind itself (FR-004, FR-039). No charter is read: a kind's contract is the
   *  same in a repository that has authored nothing. A word that is no kind is
   *  raised the way a listing raises it — there is no file it is wrong with. */
  async listPrimitiveRequirements(kind: string): Promise<DataDTOs.PrimitiveRequirements> {
    const primitiveKind = this.#kindOf(kind);
    return primitiveRequirementsDTO(
      new PrimitiveRequirements(primitiveHeadersOf(primitiveKind), primitiveSampleOf(primitiveKind)),
    );
  }

  /** Every kind the charter knows, and when a primitive of that kind comes up
   *  (FR-010). Asked of the classes themselves, as the requirements above are:
   *  no charter is read, and a kind this repository has authored nothing of is a
   *  kind all the same. */
  async kinds(): Promise<DataDTOs.PrimitiveKinds> {
    return primitiveKindsDTO(PRIMITIVE_CLASSES);
  }

  /**
   * One primitive written where its kind is authored (FR-039), with the body
   * its author typed — empty from the command line, where the body is written
   * in an editor afterwards (FR-117).
   *
   * Nothing is validated and nothing is asked of the charter but which
   * identities it already holds. What arrives is what an author answered, and
   * reading it as the primitive it claims to be is what refuses an answer its
   * kind will not take — the same reading a file of it would get, so there is no
   * second contract here to keep in step with the kind's (FR-004). Where it goes
   * is the convention: a directory per kind, since nothing reads the directory
   * (FR-002).
   *
   * An identity the charter already holds, in any layer, is refused naming the
   * file holding it: one identity names one primitive in the whole charter, and
   * a second file claiming it is a collision the next read would report
   * (FR-014). The files are read without being validated, so a charter wrong
   * somewhere else can still be added to.
   */
  async add(
    kindWord: string,
    id: string,
    headers: UnparsedHeaders,
    body = "",
  ): Promise<DataDTOs.ScopedPrimitive | DataDTOs.Faults> {
    const kind = this.#kindOf(kindWord);

    let primitive: Primitive;
    try {
      primitive = primitiveOf({ headers: { ...headers, kind, id }, body });
    } catch (raised) {
      // Every fault the answers have, not the first, the way a charter's are
      // read (FR-009).
      if (!(raised instanceof AggregateError)) throw raised;
      return faultsDTO(new Faults(raised.errors as readonly Fault[]));
    }

    const charter = await loadCharters(this.#repoPath, this.#fileReader, this.#yamlParser);
    const claimingPrimitive = charter.primitiveById.get(identityOf({ kind, id }));
    if (claimingPrimitive !== undefined)
      throw new Fault(
        `"${identityOf({ kind, id })}" is already there, declared by ${claimingPrimitive.file}, and one identity names one primitive in the whole charter.`,
        `Open ${claimingPrimitive.file}, or run this again with an id this charter has not got.`,
      );

    return scopedPrimitiveDTO(await writeCharter(this.#repoPath, primitive, this.#fileReader, this.#fileWriter));
  }

  /**
   * One primitive as the charter read it: its headers, its body, the file and
   * layer it is in, and its revision (FR-075, FR-078).
   *
   * Asked of the files as read rather than of the validation, so a primitive
   * opens whatever else in the charter is wrong — which is when its author most
   * needs to open it. The revision is the content hash of `toMarkdown()`, the
   * text a save writes, so a save made over it is checked against the primitive
   * read again then.
   */
  async open(identity: string): Promise<DataDTOs.PrimitiveSnapshot> {
    const scopedPrimitive = await this.#scopedPrimitiveOf(identity);
    return primitiveSnapshotDTO(scopedPrimitive, await contentHashOf(scopedPrimitive.primitive.toMarkdown()));
  }

  /**
   * One repository primitive's file written over with new headers and a new
   * body, keeping its kind, its id and the file it is in (FR-075).
   *
   * Refused — raised, with nothing written — for a primitive this repository
   * did not author (FR-077), and for one whose revision is no longer the one
   * its author opened, so an edit made on disk since is not lost under
   * this one (FR-078). Answers the kind will not take come back as the faults
   * `add` gives for them, since both read answers the one way.
   *
   * Kind and id are the identity's, never the headers': an edit cannot move a
   * file, and a rename is a new primitive and a deletion. Nothing is compiled
   * and nothing committed (FR-079).
   */
  async rewrite(
    identity: string,
    headers: UnparsedHeaders,
    body: string,
    revision: string,
  ): Promise<DataDTOs.ScopedPrimitive | DataDTOs.Faults> {
    const scopedPrimitive = await this.#scopedPrimitiveOf(identity);
    if (!RepoScopedPrimitive.isSatisfiedBy(scopedPrimitive))
      throw new Fault(
        `${identity} was not authored in this repository, and ${scopedPrimitive.file} is read-only here.`,
        `To differ from it, author a primitive of your own under an identity of its own.`,
      );
    // Read again now and hashed the way `open` hashed it: the two differ only
    // if the file changed since (FR-078).
    if ((await contentHashOf(scopedPrimitive.primitive.toMarkdown())) !== revision)
      throw new Fault(
        `${scopedPrimitive.file} changed on disk after it was opened, and saving would write over that change.`,
        `Open it again to see what changed, then make your edit there.`,
      );

    // Kind and id are the identity's, whatever the headers say.
    let primitive: Primitive;
    try {
      primitive = primitiveOf({
        headers: { ...headers, kind: scopedPrimitive.primitive.kind, id: scopedPrimitive.primitive.headers.id },
        body,
      });
    } catch (raised) {
      if (!(raised instanceof AggregateError)) throw raised;
      return faultsDTO(new Faults(raised.errors as readonly Fault[]));
    }

    await this.#fileWriter.write(new URL(scopedPrimitive.file, this.#repoPath), primitive.toMarkdown());
    return scopedPrimitiveDTO(new ScopedPrimitive(identity, REPO_SCOPE, scopedPrimitive.file, primitive));
  }

  /**
   * One repository primitive's file taken away, and nothing else (FR-076).
   *
   * Refused for a primitive this repository did not author, as a rewrite is
   * (FR-077). What still names it is left as it is: the next validation reports
   * each as dangling, and what to do about them is its author's call. Nothing is
   * compiled and nothing committed (FR-079).
   */
  async remove(identity: string): Promise<DataDTOs.ScopedPrimitive> {
    const scopedPrimitive = await this.#scopedPrimitiveOf(identity);
    if (!RepoScopedPrimitive.isSatisfiedBy(scopedPrimitive))
      throw new Fault(
        `${identity} was not authored in this repository, and ${scopedPrimitive.file} is read-only here.`,
        `To differ from it, author a primitive of your own under an identity of its own.`,
      );
    await this.#fileWriter.delete(new URL(scopedPrimitive.file, this.#repoPath));
    return scopedPrimitiveDTO(scopedPrimitive);
  }

  /** The primitive one identity names, off the files as read and not the
   *  validation. Raised when the charter holds nothing of it, the way `explain`
   *  raises it: there is no file it is wrong with. */
  async #scopedPrimitiveOf(identity: string): Promise<ScopedPrimitive> {
    const primitiveIdentity = identityOf(identity);
    const charter = await loadCharters(this.#repoPath, this.#fileReader, this.#yamlParser);
    const scopedPrimitive = charter.primitiveById.get(primitiveIdentity);
    if (scopedPrimitive === undefined)
      throw new Fault(
        `This charter holds no "${identity}".`,
        'Run "cw list --min" to see every identity it does hold.',
      );
    return scopedPrimitive;
  }

  /** One word read as the kind it names. Raised rather than reported, the way a
   *  listing's is: there is no file it is wrong with, and what comes back names
   *  every kind there is. */
  #kindOf(kind: string): Kind {
    if (!isKind(kind))
      throw new Fault(`"${kind}" is not a kind the charter knows.`, `Ask for one the charter knows: ${KINDS.join(", ")}.`);
    return kind;
  }

  /** What this repository configured itself with, read the one way settings are
   *  ever read (FR-038). */
  async settings(): Promise<DataDTOs.WorkspaceSettings> {
    return workspaceSettingsDTO(await loadSettings(this.#repoPath, this.#fileReader));
  }

  /**
   * Refused outside version control, and then without a settings file, which
   * setup writes whatever it was answered: its absence is what a repository
   * never set up looks like, while `loadSettings` reads it as settings naming
   * no agent (FR-004, FR-037).
   */
  async ensureRepoReady(): Promise<void> {
    if (!(await this.#vcs.isInstalled(this.#repoPath)))
      throw new Fault(
        "This folder is not inside a git repository, and a charter is authored inside one.",
        'Run "git init" here, then "cw init", or run this again where your repository is.',
      );

    if ((await this.#fileReader.readIfThere(settingsFileIn(this.#repoPath))) === undefined)
      throw new Fault("This repository was never set up under a charter.", 'Run "cw init" first.');
  }

  /**
   * One repository, set up under a charter (FR-032, FR-037).
   *
   * Refused outside version control before anything is written: what setup
   * writes is committed as one change, and a folder with nothing to commit into
   * is a folder this has no business writing in (FR-032).
   *
   * Refused, too, without an agent to compile for: a charter is authored to
   * instruct one, and a repository compiling for none would build a surface no
   * agent it runs reads (FR-033).
   *
   * Then the two things setup owns — what the repository configured itself
   * with, and a directory per kind for a charter to be authored in — and
   * nothing more: compiling is `build`'s, run once there is a charter to
   * compile (FR-037). What comes back is that it is set up; what stops it is
   * raised.
   *
   * Nothing is written into an ignore file: everything under the workspace is
   * committed, what a vendor installed included, so a checkout of this
   * repository holds the whole charter it is governed by without fetching
   * anything.
   *
   * Every one of those is written whole and none of them is authored content,
   * so running this again reconfigures the repository and discards nothing
   * anybody wrote (FR-038).
   */
  async init({ agents }: SettingsOptions): Promise<boolean> {
    if (!(await this.#vcs.isInstalled(this.#repoPath)))
      throw new Fault(
        "This folder is not inside a git repository, and a charter is authored inside one.",
        'Run "git init" here, or run this again where your repository is.',
      );

    if (agents.length === 0)
      throw new Fault(
        "Setup was given no agent to compile for, and a charter compiles for at least one.",
        `Choose at least one of: ${AGENT_PROVIDERS.join(", ")}.`,
      );

    await this.#fileWriter.write(settingsFileIn(this.#repoPath), `${JSON.stringify({ agents }, null, 2)}\n`);

    // A directory per kind, which a filesystem only keeps once there is a file
    // in it — and which git only records at all once there is one. The kinds
    // are read off the domain rather than listed again here (FR-001).
    const kindFolders = KINDS.map((kind) => `${CHARTER_DIRECTORY}/${kind}/.gitkeep`);
    for (const path of kindFolders) await this.#fileWriter.write(new URL(path, this.#repoPath), "");

    return true;
  }
}
