import { loadCharterRoot, writeCharter } from "../service/charterRepo.js";
import { loadSettings } from "../service/settingsRepo.js";
import { loadTestRoot } from "../service/testSuitesRepo.js";
import { driftedVendors } from "../service/vendorRepo.js";
import { runSuite, TestRunReport, validateTestRoot } from "../domain/services/testService.js";
import { DomainFault, Faults, FaultsByFile } from "../domain/models/DomainFault.js";
import { testSuiteNameOf } from "../domain/models/test/TestRoot.js";
import type { CharterRoot } from "../domain/models/charter/CharterRoot.js";
import { REPO_LAYER } from "../domain/models/charter/PrimitiveLayer.js";
import { RepoLayerPrimitive } from "../domain/specifications/RepoLayerPrimitive.js";
import type { DataDTOs, OutcomeDTOs } from "../port/driver/dtos/index.js";
import {
  catalogueDTO,
  doctorOutcomeDTO,
  explanationOutcomeDTO,
  faultsByFileDTO,
  faultsDTO,
  planSummaryDTO,
  primitiveKindsDTO,
  primitiveRequirementsDTO,
  primitiveDTO,
  primitivesDTO,
  testRunReportDTO,
  workspaceSettingsDTO,
  mainContextsDTO,
} from "./dtos.js";
import { catalogueOf } from "../domain/services/compile/catalogueFactory.js";
import { executePlan, plan, previewPlan } from "../service/buildService.js";
import type { McpReaching } from "../service/mcpOriginsRepo.js";
import { WorkspaceSettingsSchema, type WorkspaceSettings } from "../domain/models/WorkspaceSettings.js";
import { AGENT_PROVIDERS } from "../domain/models/AgentProvider.js";
import { CHARTER_DIRECTORY, EVAL_WORKTREES_GITIGNORE_LINE, VENDOR_DIRECTORY, WORKSPACE_GITIGNORE_FILE, settingsFileIn } from "../domain/path.js";
import type { UnparsedHeaders, ForManagingCharter, SettingsOptions } from "../port/driver/ForManagingCharter.js";
import type { ForVCS } from "../port/zdriven/ForVCS.js";
import {
  isKind,
  KINDS,
  PRIMITIVE_CLASSES,
  PrimitiveRequirements,
  primitiveIdOf,
  primitiveOf,
  primitiveHeadersOf,
  primitiveSampleOf,
  type Kind,
  type Primitive,
} from "../domain/models/charter/primitive/Primitive.js";
import type { ForReadingFiles } from "../port/zdriven/ForReadingFiles.js";
import type { ForWritingFiles } from "../port/zdriven/ForWritingFiles.js";
import type { ForParsingYaml } from "../port/zdriven/ForParsingYaml.js";
import type { ForCountingTokens } from "../port/zdriven/ForCountingTokens.js";
import type { ForRunningAgentCli } from "../port/zdriven/ForRunningAgentCli.js";
import type { ForCallingMcpServers } from "../port/zdriven/ForCallingMcpServers.js";
import type { ForKeepingSecrets } from "../port/zdriven/ForKeepingSecrets.js";
import type { ForAuthorizing } from "../port/zdriven/ForAuthorizing.js";
import type { AgentProvider } from "../domain/models/AgentProvider.js";
import { DEFAULT_MAIN_CONTEXT_CEILING } from "../domain/models/context/MainContext.js";
import { estimatedMainContextOf, exactMainContextOf } from "../service/contextService.js";

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
  readonly #tokenCounter: ForCountingTokens;
  readonly #agentCliByProvider: Readonly<Record<AgentProvider, ForRunningAgentCli>>;
  readonly #mcpReaching: McpReaching | undefined;

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
    /** What a main context is estimated by, on this machine (EVAL-FR-001). */
    tokenCounter: ForCountingTokens,
    /** Each agent's own command line, what a main context is counted exactly
     *  by (EVAL-FR-004). */
    agentCliByProvider: Readonly<Record<AgentProvider, ForRunningAgentCli>>,
    /** The mcp origins' MCP servers, and the developer's credentials to them: what
     *  a build asks each mcp origin for its tools with, and stops where one cannot
     *  be asked (EVAL-FR-031). Without them, a build keeps the tools the last
     *  one kept. */
    mcpServers?: ForCallingMcpServers,
    secrets?: ForKeepingSecrets,
    authorizing?: ForAuthorizing,
  ) {
    this.#repoPath = repoPath;
    this.#fileReader = fileReader;
    this.#yamlParser = yamlParser;
    this.#fileWriter = fileWriter;
    this.#vcs = vcs;
    this.#tokenCounter = tokenCounter;
    this.#agentCliByProvider = agentCliByProvider;
    this.#mcpReaching =
      mcpServers === undefined || secrets === undefined || authorizing === undefined ? undefined : { mcpServers, secrets, authorizing };
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
   *
   * The warnings under `.cw/vendor/` are left out before anything is counted,
   * so the summary line and the faults below it say one thing: a vendor is
   * tested and checked in its own repository. Its errors stay, since they stop
   * the build here.
   */
  async doctor(): Promise<OutcomeDTOs.DoctorOutcome> {
    const [settings, [charter, , faultsByFiles], drifted, testRoot] = await Promise.all([
      loadSettings(this.#repoPath, this.#fileReader),
      this.#read(),
      driftedVendors(this.#repoPath, this.#vcs),
      loadTestRoot(this.#repoPath, this.#fileReader),
    ]);
    const allFaultsByFile =
      charter === undefined
        ? faultsByFiles
        : faultsByFiles.with(validateTestRoot(charter, testRoot));
    const heardFaultsByFile = new FaultsByFile(
      Object.fromEntries(
        Object.entries(allFaultsByFile.files)
          .map(([file, faults]) => [file, file.startsWith(`${VENDOR_DIRECTORY}/`) ? faults.filter((fault) => fault.severity !== "warn") : faults] as const)
          .filter(([, faults]) => faults.length > 0),
      ),
    );
    if (charter === undefined) return doctorOutcomeDTO(settings, heardFaultsByFile, undefined, drifted, [], this.#repoPath);

    // Asked often, so no mcp origin is reached: what the last build kept is what a
    // build would keep where nothing changed there.
    const doctorPlan = await plan(this.#repoPath, charter, settings.agents, this.#fileReader, this.#mcpReaching, { refreshMcpOrigins: false });
    return doctorOutcomeDTO(
      settings,
      heardFaultsByFile,
      doctorPlan instanceof FaultsByFile ? undefined : previewPlan(doctorPlan.cleanupPlan, doctorPlan.projectionPlan),
      drifted,
      settings.agents.map((agent) => estimatedMainContextOf(charter, agent, this.#tokenCounter)),
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
      loadCharterRoot(this.#repoPath, this.#fileReader, this.#yamlParser),
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
   * Read off the charter, not off what it compiles to: a person is shown the
   * file each primitive was authored in, which is the one they would edit and
   * what says which layer it came from, where the catalogue a build writes sends
   * an agent to the compiled one (FR-140).
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
      throw new DomainFault(`"${kind}" is not a kind the charter knows.`, `Ask for one the charter knows: ${KINDS.join(", ")}.`);

    const [charter, , faultsByFiles] = await this.#read();
    if (charter === undefined) return faultsByFileDTO(faultsByFiles.errors(), this.#repoPath);

    const catalogue = catalogueOf(charter, (one) => one.file);
    return catalogueDTO(kind === undefined ? catalogue : catalogue.filterByKind(kind));
  }

  /** Every primitive the charter read, or those mentioning a word, each as the
   *  whole charter sees it (FR-112, FR-114). Whether one mentions the word is
   *  the primitive's own to say. */
  async fullList(matching?: string): Promise<DataDTOs.Primitives | DataDTOs.FaultsByFile> {
    const [charter, , faultsByFiles] = await this.#read();
    if (charter === undefined) return faultsByFileDTO(faultsByFiles.errors(), this.#repoPath);

    return primitivesDTO(
      matching === undefined ? charter.primitives : charter.primitives.filter((one) => one.search(matching)),
    );
  }

  /**
   * Which file declares one id, which layer it arrived in, when it comes
   * up, the mixins it uses and the corpus it cites, what uses, cites or names
   * it, and the situations this repository wrote down about it (FR-014, FR-017,
   * FR-163).
   *
   * The charter is asked, not searched here: one id space covers every
   * layer, and which file answers to a name, and which names one primitive
   * shares with another, are the charter's own questions (FR-014). What is here
   * is the order — read, refuse a charter that does not hold, then ask.
   *
   * An id nothing answers to is raised rather than reported, the way a
   * word that is no kind is: there is no file it is wrong with, and the next
   * move is to go and look at what the charter does hold.
   *
   * Reads and says: this holds a writing port and never reaches for it (FR-041).
   */
  async explain(id: string): Promise<OutcomeDTOs.ExplanationOutcome | DataDTOs.FaultsByFile> {
    // Held to the shape an id is written in before anything is read: text
    // that is not one names nothing to look for (FR-014).
    const primitiveId = primitiveIdOf(id);
    const [charter, , faultsByFiles] = await this.#read();
    if (charter === undefined) return faultsByFileDTO(faultsByFiles.errors(), this.#repoPath);

    const declared = charter.primitiveById.get(primitiveId);
    if (declared === undefined)
      throw new DomainFault(
        `This charter holds no "${id}".`,
        'Run "cw list --min" to see every id it does hold.',
      );

    // The cases are read once the id is known: an id the charter
    // holds nothing of has nothing to name, and a test file that will not read
    // names nothing either — there are no cases in it to match, and `cw test` is
    // the command that refuses it (plan §3.3).
    const testRoot = await loadTestRoot(this.#repoPath, this.#fileReader);
    // Which primitive a case activates and how its situation reads are the
    // case's own to say, so both are asked of it: the situation is the same line
    // a run reports it under, and whoever read `cw test` and then asks what pins
    // this primitive down is looking at the situation they already saw. A file
    // activating it in none of its cases is left out rather than carried as an
    // empty list, the way a file nothing is wrong with is left out of the
    // faults.
    const testCasesByFile = Object.fromEntries(
      Object.entries(testRoot.suitesByFile)
        .map(([file, suite]) => [
          file,
          suite.cases.filter((each) => each.activatedId === primitiveId).map((each) => each.describe()),
        ] as const)
        .filter(([, situations]) => situations.length > 0),
    );

    return explanationOutcomeDTO(
      declared,
      // When it comes up is its kind's to say, in the words `cw kinds` says it
      // in, so it is read off the class that reads the kind (FR-029).
      declared.activatesWhen,
      charter.mixinsOf(declared),
      charter.rationaleOf(declared),
      charter.hostsOf(declared),
      charter.citersOf(declared),
      charter.mentionersOf(declared),
      testCasesByFile,
    );
  }

  /** What each agent this repository compiles for is sent of the charter when
   *  a session opens, estimated or counted exactly (EVAL-FR-001 –
   *  EVAL-FR-004). Reads and says (FR-041). */
  async predictMainContext({ exact }: { readonly exact: boolean }): Promise<DataDTOs.MainContexts | DataDTOs.FaultsByFile> {
    const [charter, settings, faultsByFiles] = await this.#read();
    if (charter === undefined) return faultsByFileDTO(faultsByFiles.errors(), this.#repoPath);

    return mainContextsDTO(
      exact
        ? await Promise.all(settings.agents.map((agent) => exactMainContextOf(charter, agent, this.#agentCliByProvider[agent])))
        : settings.agents.map((agent) => estimatedMainContextOf(charter, agent, this.#tokenCounter)),
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

    // An mcp origin that cannot be asked for its tools, or lacks one declared,
    // stops the build as an error in the charter does (EVAL-FR-031).
    const buildPlan = await plan(this.#repoPath, charter, settings.agents, this.#fileReader, this.#mcpReaching, { refreshMcpOrigins: true });
    if (buildPlan instanceof FaultsByFile) return faultsByFileDTO(buildPlan, this.#repoPath);
    const { cleanupPlan, projectionPlan } = buildPlan;

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

    // An mcp origin that cannot be asked for its tools, or lacks one declared,
    // stops the build as an error in the charter does (EVAL-FR-031).
    const buildPlan = await plan(this.#repoPath, charter, settings.agents, this.#fileReader, this.#mcpReaching, { refreshMcpOrigins: true });
    if (buildPlan instanceof FaultsByFile) return faultsByFileDTO(buildPlan, this.#repoPath);
    const { cleanupPlan, projectionPlan } = buildPlan;
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

    const testRoot = await loadTestRoot(this.#repoPath, this.#fileReader);

    // One bad file stops the run: the cases beside it would report a pass that
    // does not cover what the bad one was written to cover (FR-009). Every one
    // of them is named, not the first.
    if (!testRoot.faultsByFiles.isEmpty) return faultsByFileDTO(testRoot.faultsByFiles, this.#repoPath);

    return testRunReportDTO(
      new TestRunReport(
        Object.entries(testRoot.suitesByFile).flatMap(([file, suite]) => runSuite(charter, testSuiteNameOf(file), suite)),
      ),
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
   * ids it already holds. What arrives is what an author answered, and
   * reading it as the primitive it claims to be is what refuses an answer its
   * kind will not take — the same reading a file of it would get, so there is no
   * second contract here to keep in step with the kind's (FR-004). Where it goes
   * is the convention: a directory per kind, since nothing reads the directory
   * (FR-002).
   *
   * An id the charter already holds, in any layer, is refused naming the
   * file holding it: one id names one primitive in the whole charter, and
   * a second file claiming it is a collision the next read would report
   * (FR-014). The files are read without being validated, so a charter wrong
   * somewhere else can still be added to.
   */
  async add(
    kindWord: string,
    id: string,
    headers: UnparsedHeaders,
    body = "",
  ): Promise<DataDTOs.Primitive | DataDTOs.Faults> {
    const kind = this.#kindOf(kindWord);

    let primitive: Primitive;
    try {
      primitive = primitiveOf({ headers: { ...headers, kind, id }, body });
    } catch (raised) {
      // Every fault the answers have, not the first, the way a charter's are
      // read (FR-009).
      if (!(raised instanceof AggregateError)) throw raised;
      return faultsDTO(new Faults(raised.errors as readonly DomainFault[]));
    }

    const charter = await loadCharterRoot(this.#repoPath, this.#fileReader, this.#yamlParser);
    const claimingPrimitive = charter.primitiveById.get(id);
    if (claimingPrimitive !== undefined)
      throw new DomainFault(
        `"${id}" is already there, declared by ${claimingPrimitive.file}, and one id names one primitive in the whole charter.`,
        `Open ${claimingPrimitive.file}, or run this again with an id this charter has not got.`,
      );

    return primitiveDTO(await writeCharter(this.#repoPath, primitive, this.#fileReader, this.#fileWriter));
  }

  /**
   * One primitive as the charter read it: its headers, its body, the file and
   * layer it is in, and its hash (FR-075, FR-078).
   *
   * Asked of the files as read rather than of the validation, so a primitive
   * opens whatever else in the charter is wrong — which is when its author most
   * needs to open it. A save made over its hash is checked against the
   * primitive read again then.
   */
  async open(id: string): Promise<DataDTOs.Primitive> {
    return primitiveDTO(await this.#primitiveById(id));
  }

  /**
   * One repository primitive's file written over with new headers and a new
   * body, keeping its kind, its id and the file it is in (FR-075).
   *
   * Refused — raised, with nothing written — for a primitive this repository
   * did not author (FR-077), and for one whose hash is no longer the one its
   * author opened it at, so an edit made on disk since is not lost under
   * this one (FR-078). Answers the kind will not take come back as the faults
   * `add` gives for them, since both read answers the one way.
   *
   * Kind and id are the id's, never the headers': an edit cannot move a
   * file, and a rename is a new primitive and a deletion. Nothing is compiled
   * and nothing committed (FR-079).
   */
  async rewrite(
    id: string,
    headers: UnparsedHeaders,
    body: string,
    openedHash: string,
  ): Promise<DataDTOs.Primitive | DataDTOs.Faults> {
    const authoredPrimitive = await this.#primitiveById(id);
    if (!RepoLayerPrimitive.isSatisfiedBy(authoredPrimitive))
      throw new DomainFault(
        `${id} was not authored in this repository, and ${authoredPrimitive.file} is read-only here.`,
        `To differ from it, author a primitive of your own under an id of its own.`,
      );
    // Read again now and hashed the way `open` hashed it: the two differ only
    // if the file changed since (FR-078).
    if (authoredPrimitive.hash !== openedHash)
      throw new DomainFault(
        `${authoredPrimitive.file} changed on disk after it was opened, and saving would write over that change.`,
        `Open it again to see what changed, then make your edit there.`,
      );

    // Kind and id are the id's, whatever the headers say.
    let primitive: Primitive;
    try {
      primitive = primitiveOf({
        headers: { ...headers, kind: authoredPrimitive.kind, id: authoredPrimitive.headers.id },
        body,
      });
    } catch (raised) {
      if (!(raised instanceof AggregateError)) throw raised;
      return faultsDTO(new Faults(raised.errors as readonly DomainFault[]));
    }

    await this.#fileWriter.write(new URL(authoredPrimitive.file, this.#repoPath), primitive.toMarkdown());
    return primitiveDTO(primitive);
  }

  /**
   * One repository primitive's index.md taken away, with its assets, and
   * nothing else (FR-076, FR-167).
   *
   * Refused for a primitive this repository did not author, as a rewrite is
   * (FR-077). What still names it is left as it is: the next validation reports
   * each as dangling, and what to do about them is its author's call. Nothing is
   * compiled and nothing committed (FR-079).
   */
  async remove(id: string): Promise<DataDTOs.Primitive> {
    const primitive = await this.#primitiveById(id);
    if (!RepoLayerPrimitive.isSatisfiedBy(primitive))
      throw new DomainFault(
        `${id} was not authored in this repository, and ${primitive.file} is read-only here.`,
        `To differ from it, author a primitive of your own under an id of its own.`,
      );
    const file = new URL(primitive.file, this.#repoPath);
    await this.#fileWriter.delete(file);
    // Its assets go with it: nothing else names them (FR-167).
    for (const assetFile of primitive.assets) await this.#fileWriter.delete(new URL(assetFile.file, file));
    return primitiveDTO(primitive);
  }

  /** The primitive one id names, off the files as read and not the
   *  validation. Raised when the charter holds nothing of it, the way `explain`
   *  raises it: there is no file it is wrong with. */
  async #primitiveById(id: string): Promise<Primitive> {
    const primitiveId = primitiveIdOf(id);
    const charter = await loadCharterRoot(this.#repoPath, this.#fileReader, this.#yamlParser);
    const primitive = charter.primitiveById.get(primitiveId);
    if (primitive === undefined)
      throw new DomainFault(
        `This charter holds no "${id}".`,
        'Run "cw list --min" to see every id it does hold.',
      );
    return primitive;
  }

  /** One word read as the kind it names. Raised rather than reported, the way a
   *  listing's is: there is no file it is wrong with, and what comes back names
   *  every kind there is. */
  #kindOf(kind: string): Kind {
    if (!isKind(kind))
      throw new DomainFault(`"${kind}" is not a kind the charter knows.`, `Ask for one the charter knows: ${KINDS.join(", ")}.`);
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
      throw new DomainFault(
        "This folder is not inside a git repository, and a charter is authored inside one.",
        'Run "git init" here, then "cw init", or run this again where your repository is.',
      );

    if ((await this.#fileReader.readIfThere(settingsFileIn(this.#repoPath))) === undefined)
      throw new DomainFault("This repository was never set up under a charter.", 'Run "cw init" first.');
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
   * with, and a directory per kind for a charter to be authored in — and a
   * build over them, so the skill the engine brings is in the agent's hands
   * before anything is authored (FR-057, FR-096). What comes back is what that
   * build did, or what refused it; what stops setup itself is raised.
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
  async init({ agents, mainContextCeiling }: SettingsOptions): Promise<DataDTOs.PlanSummary | DataDTOs.FaultsByFile> {
    if (!(await this.#vcs.isInstalled(this.#repoPath)))
      throw new DomainFault(
        "This folder is not inside a git repository, and a charter is authored inside one.",
        'Run "git init" here, or run this again where your repository is.',
      );

    if (agents.length === 0)
      throw new DomainFault(
        "Setup was given no agent to compile for, and a charter compiles for at least one.",
        `Choose at least one of: ${AGENT_PROVIDERS.join(", ")}.`,
      );

    if (!WorkspaceSettingsSchema.shape.mainContextCeiling.safeParse(mainContextCeiling).success)
      throw new DomainFault(
        `A context ceiling is the tokens past which the health check warns, and ${mainContextCeiling} is no whole number above 0.`,
        "Give one, as in --mainContextCeiling 20000.",
      );

    // The ceiling is kept where one was set, now or before, and left out where
    // it is the 20,000 that none means (EVAL-FR-006).
    const keptCeiling = mainContextCeiling ?? (await loadSettings(this.#repoPath, this.#fileReader).catch(() => undefined))?.mainContextCeiling;
    await this.#fileWriter.write(
      settingsFileIn(this.#repoPath),
      `${JSON.stringify({ agents, ...(keptCeiling === undefined || keptCeiling === DEFAULT_MAIN_CONTEXT_CEILING ? {} : { mainContextCeiling: keptCeiling }) }, null, 2)}\n`,
    );

    // A directory per kind, which a filesystem only keeps once there is a file
    // in it — and which git only records at all once there is one. The kinds
    // are read off the domain rather than listed again here (FR-001).
    const kindFolders = KINDS.map((kind) => `${CHARTER_DIRECTORY}/${kind}/.gitkeep`);
    for (const path of kindFolders) await this.#fileWriter.write(new URL(path, this.#repoPath), "");

    // Version control ignores the worktrees an evaluation runs each case in
    // (EVAL-FR-021). Written here, once, and not by a build: the file is the
    // workspace's, not something the charter compiles to, and every other line
    // of it is the repository's and kept.
    const gitignoreFile = new URL(WORKSPACE_GITIGNORE_FILE, this.#repoPath);
    const gitignoreText = (await this.#fileReader.readIfThere(gitignoreFile)) ?? "";
    if (!gitignoreText.split("\n").includes(EVAL_WORKTREES_GITIGNORE_LINE))
      await this.#fileWriter.write(gitignoreFile, `${gitignoreText}${gitignoreText === "" || gitignoreText.endsWith("\n") ? "" : "\n"}${EVAL_WORKTREES_GITIGNORE_LINE}\n`);

    return this.build();
  }
}
