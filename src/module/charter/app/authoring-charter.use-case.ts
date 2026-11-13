import {
  AdapterFault,
  ApplicationService,
  DomainFault,
  type FaultDTOs,
  Faults,
  type ForReportingProgress,
  type ForTellingTime,
  ManyFindingsFault,
} from "../../shared/module.js";
import { vendorSourcePath } from "../domain/constants.js";
import { RepoLayerPrimitiveSpec } from "../domain/models/charter/repo-layer-primitive.specification.js";
import {
  ClaimedIdFault,
  EmptyTokenFault,
  ExpiredSignInFault,
  InsecureEndpointFault,
  NotSignedInFault,
  PrimitiveChangedFault,
  ReadOnlyPrimitiveFault,
  UnknownEvalSuiteFault,
  UnknownIdFault,
  UnknownKindFault,
  UnknownSignInAddressFault,
  UnknownTestSuiteFault,
  UnknownVendorFault,
  UnplaceableVendorFault,
  UnsupportedSignInMethodFault,
} from "../domain/models/charter.fault.js";
import { CatalogueFactory } from "../domain/models/charter-output/catalogue.factory.js";
import type { McpOrigin } from "../domain/models/charter-output/mcp-origin.js";
import { EvalRootFactory } from "../domain/models/eval/eval-root.factory.js";
import type { EvalRoot } from "../domain/models/eval/eval-root.js";
import { EvalSuiteFactory } from "../domain/models/eval/eval-suite.factory.js";
import { EvalSuite } from "../domain/models/eval/eval-suite.js";
import { McpAuthMethod, type McpAuthMethodName } from "../domain/models/mcp/mcp-auth-method.value-object.js";
import { McpClientRegistration } from "../domain/models/mcp/mcp-client-registration.js";
import { AssetFile } from "../domain/models/primitive/asset-file.js";
import { McpPrimitive } from "../domain/models/primitive/mcp-primitive.js";
import { PrimitiveFactory } from "../domain/models/primitive/primitive.factory.js";
import { type Kind, type Primitive, Primitives } from "../domain/models/primitive/primitive.js";
import { PrimitiveLayer } from "../domain/models/primitive/primitive-layer.value-object.js";
import { RawPrimitive } from "../domain/models/primitive/raw-primitive.js";
import { ScriptPrimitive } from "../domain/models/primitive/script-primitive.js";
import { SecureEndpointSpec } from "../domain/models/primitive/secure-endpoint.specification.js";
import { SkillPrimitive } from "../domain/models/primitive/skill-primitive.js";
import { TestRootFactory } from "../domain/models/test/test-root.factory.js";
import type { TestRoot } from "../domain/models/test/test-root.js";
import { TestSuiteFactory } from "../domain/models/test/test-suite.factory.js";
import { TestSuite } from "../domain/models/test/test-suite.js";
import { VendorSourceFactory } from "../domain/models/vendor/vendor-source.factory.js";
import type { SourceCharter, VendorSource } from "../domain/models/vendor/vendor-source.js";
import { VendorSourceOriginFactory } from "../domain/models/vendor/vendor-source-origin.factory.js";
import { TestService } from "../domain/services/test.service.js";
import type { ForAuthoringCharter, McpOriginAddress, UnparsedHeaders } from "./port/in/authoring-charter.port.js";
import { CharterDTOs } from "./port/in/charter.dto.js";
import type { ForAuthorizingOAuthClients } from "./port/out/authorizing-oauth-clients.port.js";
import type { ForManagingCharter } from "./port/out/managing-charter.port.js";
import type { ForStoringCredentials } from "./port/out/storing-credentials.port.js";
import type { InstallCharterService } from "./services/install-charter.service.js";
import type { LoadCharterService } from "./services/load-charter.service.js";

/**
 * APPLICATION SERVICE — authoring the charter: its primitives, the vendors it
 * installs, the test files beside it, and the developer's sign-in to the mcp
 * origins it reaches (CORE-FR-222).
 *
 * What it reads and writes is what the repository keeps — the charter, the
 * vendors, the test suites — and the credentials kept on this machine; never
 * what the repository configured itself with, and never the repository's
 * history. Nothing is compiled here: the build is projecting the charter's.
 *
 * What it answers a driver with is the DTO its schema makes of what the domain
 * handed back, and never the model itself; whatever an operation raises is
 * answered as a `FaultDTOs.Fault` by `answerWithFaultDTO` (SDK-FR-004).
 */

export class AuthoringCharter extends ApplicationService implements ForAuthoringCharter {
  readonly #loadCharterService: LoadCharterService;
  readonly #installCharterService: InstallCharterService;
  readonly #charterRepository: ForManagingCharter;
  readonly #credentialsRepository: ForStoringCredentials;
  readonly #oauthAuthorizer: ForAuthorizingOAuthClients;
  readonly #clock: ForTellingTime;

  constructor(
    /** How the repository's charter is read off its layers. */
    loadCharterService: LoadCharterService,
    /** How a vendor's source is chosen of, planned and put down. */
    installCharterService: InstallCharterService,
    /** Where the charter is kept, all of it (CORE-FR-228): its primitives
     *  read and the repository's own written, a source read and the vendors
     *  installed kept and taken away, and its test and eval cases read and
     *  written. */
    charterRepository: ForManagingCharter,
    /** Where the developer's credentials to the mcp origins are kept, on this
     *  machine rather than in the repository (FR-149). */
    credentialsRepository: ForStoringCredentials,
    oauthAuthorizer: ForAuthorizingOAuthClients,
    /** What now is, which a credential's expiry is read against. */
    clock: ForTellingTime,
    /** Where an internal fault is logged for whoever runs the system, before
     *  the caller is answered in the system's own words (SDK-FR-017). */
    progressReporter: ForReportingProgress,
  ) {
    super(progressReporter);
    this.#loadCharterService = loadCharterService;
    this.#installCharterService = installCharterService;
    this.#charterRepository = charterRepository;
    this.#credentialsRepository = credentialsRepository;
    this.#oauthAuthorizer = oauthAuthorizer;
    this.#clock = clock;
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
  async listCatalogue(kind?: string): Promise<CharterDTOs.Catalogue | FaultDTOs.FaultsByFile | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("AuthoringCharter.listCatalogue", async () => {
      // Asked before the charter is read: a word that is no kind leaves this
      // nothing to narrow by, so it is answered as one fault rather than under a
      // file — there is none it is wrong with — and a typo costs no reading
      // (FR-001).
      if (kind !== undefined && !Primitives.isKind(kind))
        throw new UnknownKindFault(
          `"${kind}" is not a kind the charter knows.`,
          `Ask for one the charter knows: ${Primitives.kinds.join(", ")}.`,
          { internal: false },
        );

      // A warning is said and lets the run through; what refuses it is only the
      // errors among the faults (FR-005, FR-009).
      const charter = await this.#loadCharterService.loadCharterRoot(this.#charterRepository);
      const charterErrorFaultsByFile = charter.allFaultsByFiles.filterErrors();
      if (!charterErrorFaultsByFile.isEmpty) return this.faultsByFileDTOOf(charterErrorFaultsByFile);

      const catalogue = CatalogueFactory.create(charter, (primitive) => primitive.uri);
      return CharterDTOs.Catalogue.of({
        // Each entry copied out of its model, so the caller is answered plain
        // data (CORE-FR-223).
        entries: (kind === undefined ? catalogue : catalogue.filterByKind(kind)).entries.map(
          ({ agentProviders, id, kind: entryKind, description, file: filePath, globs }) =>
            CharterDTOs.CatalogueEntry.of({
              agentProviders:
                agentProviders === "all" ? "all" : agentProviders.map((agentProvider) => agentProvider.name),
              id,
              kind: entryKind,
              description,
              file: filePath,
              ...(globs === undefined ? {} : { globs }),
            }),
        ),
      });
    });
  }

  /** Every primitive the charter read, or those mentioning a word, each as the
   *  whole charter sees it (FR-112, FR-114). Whether one mentions the word is
   *  the primitive's own to say. */
  async listPrimitives(
    searchText?: string,
  ): Promise<CharterDTOs.Primitives | FaultDTOs.FaultsByFile | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("AuthoringCharter.listPrimitives", async () => {
      const charter = await this.#loadCharterService.loadCharterRoot(this.#charterRepository);
      const charterErrorFaultsByFile = charter.allFaultsByFiles.filterErrors();
      if (!charterErrorFaultsByFile.isEmpty) return this.faultsByFileDTOOf(charterErrorFaultsByFile);

      // Ordered by id, the way the catalogue orders its entries.
      const shownPrimitives =
        searchText === undefined
          ? charter.primitives
          : charter.primitives.filter((primitive) => primitive.hasWord(searchText));
      return CharterDTOs.Primitives.of({
        primitives: [...shownPrimitives]
          .sort((leftPrimitive, rightPrimitive) =>
            leftPrimitive.headers.id < rightPrimitive.headers.id
              ? -1
              : leftPrimitive.headers.id > rightPrimitive.headers.id
                ? 1
                : 0,
          )
          .map((primitive) => this.#primitiveDTOOf(primitive)),
      });
    });
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
   * An id nothing answers to is answered as one fault rather than reported, the way a
   * word that is no kind is: there is no file it is wrong with, and the next
   * move is to go and look at what the charter does hold.
   *
   * Reads and says: this holds a writing port and never reaches for it (FR-041).
   */
  async explainPrimitive(
    id: string,
  ): Promise<CharterDTOs.ExplanationOutcome | FaultDTOs.FaultsByFile | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("AuthoringCharter.explainPrimitive", async () => {
      // Held to the shape an id is written in before anything is read: text
      // that is not one names nothing to look for (FR-014).
      const primitiveId = Primitives.idOf(id);
      const charter = await this.#loadCharterService.loadCharterRoot(this.#charterRepository);
      const charterErrorFaultsByFile = charter.allFaultsByFiles.filterErrors();
      if (!charterErrorFaultsByFile.isEmpty) return this.faultsByFileDTOOf(charterErrorFaultsByFile);

      const declaredPrimitive = charter.primitiveById.get(primitiveId);
      if (declaredPrimitive === undefined)
        throw new UnknownIdFault(
          `This charter holds no "${id}".`,
          'Run "cw list --min" to see every id it does hold.',
          { internal: false },
        );

      // The cases are read once the id is known: an id the charter
      // holds nothing of has nothing to name, and a test file that will not read
      // names nothing either — there are no cases in it to match, and `cw test` is
      // the command that refuses it (plan §3.3).
      const testRoot = await this.#loadTestRoot();
      // Which primitive a case activates and how its situation reads are the
      // case's own to say, so both are asked of it: the situation is the same line
      // a run reports it under, and whoever read `cw test` and then asks what pins
      // this primitive down is looking at the situation they already saw. A file
      // activating it in none of its cases is left out rather than carried as an
      // empty list, the way a file nothing is wrong with is left out of the
      // faults.
      const testCasesByFile = Object.fromEntries(
        Object.entries(testRoot.suitesByFile)
          .map(
            ([filePath, suite]) =>
              [
                filePath,
                suite.cases
                  .filter((testCase) => testCase.activatedId === primitiveId)
                  .map((testCase) => testCase.describeCase()),
              ] as const,
          )
          .filter(([, situations]) => situations.length > 0),
      );

      const rationalePrimitive = charter.rationaleOf(declaredPrimitive);
      return CharterDTOs.ExplanationOutcome.of({
        primitive: this.#primitiveDTOOf(declaredPrimitive),
        // When it comes up is its kind's to say, in the words `cw kinds` says it
        // in, so it is read off the class that reads the kind (FR-029).
        activatesWhen: declaredPrimitive.activatesWhen,
        useMixins: charter.mixinsOf(declaredPrimitive).map((primitive) => this.#primitiveDTOOf(primitive)),
        ...(rationalePrimitive === undefined ? {} : { rationale: this.#primitiveDTOOf(rationalePrimitive) }),
        usedByPrimitives: charter.pullersOf(declaredPrimitive).map((primitive) => this.#primitiveDTOOf(primitive)),
        citers: charter.citersOf(declaredPrimitive).map((primitive) => this.#primitiveDTOOf(primitive)),
        mentioners: charter.mentionersOf(declaredPrimitive).map((primitive) => this.#primitiveDTOOf(primitive)),
        testCasesByFile: CharterDTOs.TestCasesByFile.of(testCasesByFile),
      });
    });
  }

  /** What one kind takes of whoever authors a primitive of it, asked of the
   *  kind itself (FR-004, FR-039). No charter is read: a kind's contract is the
   *  same in a repository that has authored nothing. A word that is no kind is
   *  answered as a fault the way a listing answers it — there is no file it is
   *  wrong with. */
  async listPrimitiveRequirements(kind: string): Promise<CharterDTOs.PrimitiveRequirements | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("AuthoringCharter.listPrimitiveRequirements", async () => {
      const primitiveKind = this.#findKind(kind);
      return CharterDTOs.PrimitiveRequirements.of({
        headers: Primitives.headersOf(primitiveKind).map(({ field, shape, isRequired, allowedValues }) =>
          CharterDTOs.PrimitiveHeader.of({
            field,
            shape,
            required: isRequired,
            ...(allowedValues === undefined ? {} : { allowedValues }),
          }),
        ),
        sample: Primitives.sampleOf(primitiveKind),
      });
    });
  }

  /** Every kind the charter knows, and when a primitive of that kind comes up
   *  (FR-010). Asked of the classes themselves, as the requirements above are:
   *  no charter is read, and a kind this repository has authored nothing of is a
   *  kind all the same. */
  async listKinds(): Promise<CharterDTOs.PrimitiveKinds | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("AuthoringCharter.listKinds", async () => {
      // Where a kind's line names a place, it is where the projection lays it.
      // Read off the class that reads each kind (FR-010): the same declarations
      // the compiled orientation says it in, so a listing and what an agent
      // reads cannot come to say different things.
      return CharterDTOs.PrimitiveKinds.of(
        Object.fromEntries(Primitives.classes.map(({ kind, activatesWhen }) => [kind, activatesWhen])),
      );
    });
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
  async addPrimitive(
    kindWord: string,
    id: string,
    headers: UnparsedHeaders,
    body = "",
  ): Promise<CharterDTOs.Primitive | FaultDTOs.Faults | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("AuthoringCharter.addPrimitive", async () => {
      const kind = this.#findKind(kindWord);

      let primitive: Primitive;
      try {
        primitive = PrimitiveFactory.create(
          new RawPrimitive(PrimitiveLayer.REPO, kind, id, { headers: { ...headers, kind, id }, body }, [], ""),
        );
      } catch (raisedValue) {
        // Every fault the answers have, not the first, the way a charter's are
        // read (FR-009).
        if (!(raisedValue instanceof ManyFindingsFault)) throw raisedValue;
        const findingFaults = raisedValue.faults.filter(
          (error): error is DomainFault => error instanceof DomainFault && !error.internal,
        );
        if (findingFaults.length !== raisedValue.faults.length) throw raisedValue;
        return this.faultsDTOOf(new Faults(findingFaults));
      }

      const charter = await this.#loadCharterService.loadCharterRoot(this.#charterRepository);
      const claimingPrimitive = charter.primitiveById.get(id);
      if (claimingPrimitive !== undefined)
        throw new ClaimedIdFault(
          `"${id}" is already there, declared by ${claimingPrimitive.uri}, and one id names one primitive in the whole charter.`,
          `Open ${claimingPrimitive.uri}, or run this again with an id this charter has not got.`,
          { internal: false },
        );

      return this.#primitiveDTOOf(await this.#writeNewPrimitive(primitive));
    });
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
  async openPrimitive(id: string): Promise<CharterDTOs.Primitive | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("AuthoringCharter.openPrimitive", async () => {
      return this.#primitiveDTOOf(await this.#findPrimitiveById(id));
    });
  }

  /**
   * One repository primitive's file written over with new headers and a new
   * body, keeping its kind, its id and the file it is in (FR-075).
   *
   * Refused — answered as a fault, with nothing written — for a primitive this repository
   * did not author (FR-077), and for one whose hash is no longer the one its
   * author opened it at, so an edit made on disk since is not lost under
   * this one (FR-078). Answers the kind will not take come back as the faults
   * `addPrimitive` gives for them, since both read answers the one way.
   *
   * Kind and id are the id's, never the headers': an edit cannot move a
   * file, and a rename is a new primitive and a deletion. Nothing is compiled
   * and nothing committed (FR-079).
   */
  async rewritePrimitive(
    id: string,
    headers: UnparsedHeaders,
    body: string,
    openedHash: string,
  ): Promise<CharterDTOs.Primitive | FaultDTOs.Faults | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("AuthoringCharter.rewritePrimitive", async () => {
      const authoredPrimitive = await this.#findPrimitiveById(id);
      if (!new RepoLayerPrimitiveSpec().isSatisfiedBy(authoredPrimitive))
        throw new ReadOnlyPrimitiveFault(
          `${id} was not authored in this repository, and ${authoredPrimitive.uri} is read-only here.`,
          `To differ from it, author a primitive of your own under an id of its own.`,
          { internal: false },
        );
      // Read again now and hashed the way `openPrimitive` hashed it: the two differ only
      // if the file changed since (FR-078).
      if (authoredPrimitive.hash !== openedHash)
        throw new PrimitiveChangedFault(
          `${authoredPrimitive.uri} changed on disk after it was opened, and saving would write over that change.`,
          `Open it again to see what changed, then make your edit there.`,
          { internal: false },
        );

      // Kind and id are the id's, whatever the headers say.
      let primitive: Primitive;
      try {
        primitive = PrimitiveFactory.create(
          new RawPrimitive(
            PrimitiveLayer.REPO,
            authoredPrimitive.kind,
            authoredPrimitive.headers.id,
            { headers: { ...headers, kind: authoredPrimitive.kind, id: authoredPrimitive.headers.id }, body },
            authoredPrimitive.assets,
            authoredPrimitive.uri,
          ),
        );
      } catch (raisedValue) {
        if (!(raisedValue instanceof ManyFindingsFault)) throw raisedValue;
        const findingFaults = raisedValue.faults.filter(
          (error): error is DomainFault => error instanceof DomainFault && !error.internal,
        );
        if (findingFaults.length !== raisedValue.faults.length) throw raisedValue;
        return this.faultsDTOOf(new Faults(findingFaults));
      }

      await this.#charterRepository.rewritePrimitive(primitive);
      return this.#primitiveDTOOf(primitive);
    });
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
  async removePrimitive(id: string): Promise<CharterDTOs.Primitive | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("AuthoringCharter.removePrimitive", async () => {
      const primitive = await this.#findPrimitiveById(id);
      if (!new RepoLayerPrimitiveSpec().isSatisfiedBy(primitive))
        throw new ReadOnlyPrimitiveFault(
          `${id} was not authored in this repository, and ${primitive.uri} is read-only here.`,
          `To differ from it, author a primitive of your own under an id of its own.`,
          { internal: false },
        );
      // Its assets go with it: nothing else names them (FR-167).
      await this.#charterRepository.removePrimitive(primitive);
      return this.#primitiveDTOOf(primitive);
    });
  }

  /**
   * Install one source under the name of its owner and its repository, pinned
   * to this version where one is named, left unstaged and uncommitted for the
   * user to read, whatever else is in hand (FR-042, FR-047, FR-050,
   * CORE-FR-190). The source is fetched once, and what is installed is read off
   * that one commit; nothing is installed where anything it would install is
   * refused.
   *
   * A charter is installed whole — the source's one charter, or each picked
   * from a source of many under a name of its own — brought up to date and
   * removed on its own (CORE-FR-196). The skills `selectedSkillIds` names are
   * installed, or every one where the source's shape takes them and it names
   * none, asking nothing, each converted (CORE-FR-186 to CORE-FR-188). A skill
   * installed again replaces the one before; the others are left as they were
   * (CORE-FR-189).
   */
  async addVendor(
    sourceUri: string,
    version?: string,
    selectedSkillIds: readonly string[] = [],
    selectedCharterNames: readonly string[] = [],
  ): Promise<CharterDTOs.VendorAddOutcome | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("AuthoringCharter.addVendor", async () => {
      const rawVendorSource = await this.#charterRepository.fetchVendorSource(
        VendorSourceOriginFactory.create(sourceUri),
        version,
      );
      try {
        const filteredSource = this.#installCharterService.filterSource(
          VendorSourceFactory.create(rawVendorSource),
          selectedSkillIds,
          selectedCharterNames,
        );
        await this.#charterRepository.storeVendor(filteredSource);
        return this.#vendorAddOutcomeDTOOf(filteredSource);
      } finally {
        await this.#charterRepository.removeTempSource(rawVendorSource);
      }
    });
  }

  /** Take the same source as adding a vendor, preflight every primitive, then
   *  write into the repository's own charter without keeping provenance. */
  async injectVendor(
    sourceUri: string,
    version?: string,
    selectedSkillIds: readonly string[] = [],
    selectedCharterNames: readonly string[] = [],
  ): Promise<CharterDTOs.VendorAddOutcome | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("AuthoringCharter.injectVendor", async () => {
      const rawVendorSource = await this.#charterRepository.fetchVendorSource(
        VendorSourceOriginFactory.create(sourceUri),
        version,
      );
      try {
        const filteredSource = this.#installCharterService.filterSource(
          VendorSourceFactory.create(rawVendorSource),
          selectedSkillIds,
          selectedCharterNames,
        );
        const charterRoot = await this.#loadCharterService.loadCharterRoot(this.#charterRepository);
        // Each kept as the source keeps it, a skill as the skill it converts to,
        // in this repository's own layer, under the kind and id it declares.
        const injectedPrimitives = [
          ...[
            ...(filteredSource.ownCharter === undefined ? [] : [filteredSource.ownCharter]),
            ...filteredSource.charters,
          ].flatMap(({ rawPrimitives }) =>
            rawPrimitives.map((rawPrimitive) => {
              const primitive = PrimitiveFactory.create(rawPrimitive);
              return new RawPrimitive(
                PrimitiveLayer.REPO,
                primitive.kind,
                primitive.headers.id,
                rawPrimitive.contents,
                rawPrimitive.assets,
                rawPrimitive.uri,
              );
            }),
          ),
          ...filteredSource.skills.map(
            ({ convertedSkill, assets, uri }) =>
              new RawPrimitive(
                PrimitiveLayer.REPO,
                SkillPrimitive.kind,
                convertedSkill.headers.id,
                convertedSkill.writeMarkdown(),
                assets,
                uri,
              ),
          ),
        ];
        // A whole injection must fit the charter's single id space before any
        // file is written (CORE-FR-194): where each is kept apart is the
        // charter repository's to refuse.
        const uriById = new Map(charterRoot.primitives.map((primitive) => [primitive.headers.id, primitive.uri]));
        for (const injectedPrimitive of injectedPrimitives) {
          const existingUri = uriById.get(injectedPrimitive.id);
          if (existingUri !== undefined)
            throw new ClaimedIdFault(
              `${existingUri} and ${injectedPrimitive.uri} claim id "${injectedPrimitive.id}".`,
              "Inject primitives with ids this charter does not already hold.",
              { internal: false },
            );
          uriById.set(injectedPrimitive.id, injectedPrimitive.uri);
        }
        // What keeps the charter refuses a folder as it refuses any; refused
        // here, it is a vendor that cannot be injected (FR-167).
        await this.#charterRepository.injectPrimitives(injectedPrimitives).catch((raisedValue: unknown) => {
          throw raisedValue instanceof AdapterFault
            ? new UnplaceableVendorFault(raisedValue.message, raisedValue.fix, {
                internal: raisedValue.internal,
                cause: raisedValue,
              })
            : raisedValue;
        });
        return this.#vendorAddOutcomeDTOOf(filteredSource, this.#charterRepository.findCharterUri());
      } finally {
        await this.#charterRepository.removeTempSource(rawVendorSource);
      }
    });
  }

  /** Take away the vendor installed under one name, and each folder above it
   *  that leaves empty, leaving that in the working tree to commit, whatever
   *  else is in hand; and answer where it was kept (FR-047, CORE-FR-204). The
   *  name is as it is listed: owner and repository, or the one folder an
   *  earlier version named it by (FR-180). A name not listed is refused,
   *  changing nothing. */
  async removeVendor(name: string): Promise<CharterDTOs.VendorFolder | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("AuthoringCharter.removeVendor", async () => {
      const installedVendor = (await this.#charterRepository.loadVendorRoot()).vendors.find(
        (listedVendor) => listedVendor.name === name,
      );
      if (installedVendor === undefined)
        throw new UnknownVendorFault(
          `No vendor folder is named "${name}".`,
          "Name the folder as cw vendor list names it among the charter's vendors.",
          { internal: false },
        );
      await this.#charterRepository.removeVendor(installedVendor.name);
      return CharterDTOs.VendorFolder.of({ folder: installedVendor.uri });
    });
  }

  async listVendors(): Promise<CharterDTOs.VendorFolders | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("AuthoringCharter.listVendors", async () => {
      // Listed the way the charter finds its vendor layers, so what is listed is
      // what the charter reads (FR-053).
      return CharterDTOs.VendorFolders.of({
        folders: (await this.#charterRepository.loadVendorRoot()).vendors.map(({ uri }) => uri),
      });
    });
  }

  /** Every test file as it was read, with its text, one that does not read
   *  among them (FR-124). No charter is read: resolving the cases against it
   *  is testing the charter's. */
  async listTestSuites(): Promise<CharterDTOs.TestSuites | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("AuthoringCharter.listTestSuites", async () => {
      const { suitesByFile, faultsByFiles, suiteNameByFile } = await this.#loadTestRoot();
      // In the order their paths sort in: one that reads with its name, body,
      // description and each case said; one that does not with its name and
      // the fault that says why (FR-124).
      const suitePaths = [...Object.keys(suitesByFile), ...Object.keys(faultsByFiles.faultsByFilePath)].sort(
        (leftPath, rightPath) => leftPath.localeCompare(rightPath),
      );
      return CharterDTOs.TestSuites.of({
        testSuites: suitePaths.map((path) => {
          const suite = suitesByFile[path];
          const [fault] = faultsByFiles.faultsByFilePath[path] ?? [];
          return CharterDTOs.TestSuite.of({
            name: suiteNameByFile[path] ?? path,
            ...(suite === undefined ? {} : { text: suite.body }),
            ...(suite?.description === undefined ? {} : { description: suite.description }),
            cases: (suite?.cases ?? []).map(({ situation, expectation, activatedId }) =>
              CharterDTOs.TestCase.of({
                situation,
                expectation,
                ...(activatedId === undefined ? {} : { id: activatedId }),
              }),
            ),
            ...(fault === undefined ? {} : { fault: this.findingDTOOf(fault) }),
          });
        }),
      });
    });
  }

  async addTestSuite(): Promise<CharterDTOs.TestSuiteName | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("AuthoringCharter.addTestSuite", async () => {
      // Named `untitled-<n>.json` for the first `n` no test file has, holding
      // one sample case that reads as a suite (FR-091).
      const testSuiteName = (await this.#loadTestRoot()).untitledName;
      await this.#charterRepository.writeTestSuite(testSuiteName, TestSuiteFactory.create(TestSuite.defaultBody));
      return CharterDTOs.TestSuiteName.of({ name: testSuiteName });
    });
  }

  async writeTestSuite(name: string, text: string): Promise<CharterDTOs.TestSuiteName | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("AuthoringCharter.writeTestSuite", async () => {
      await this.#ensureTestSuiteNamed(name);
      // Refused with nothing written where the text does not read as a suite —
      // the refusal and sample `cw test` gives (FR-090).
      await this.#charterRepository.writeTestSuite(name, TestSuiteFactory.create(text));
      return CharterDTOs.TestSuiteName.of({ name });
    });
  }

  async removeTestSuite(name: string): Promise<CharterDTOs.TestSuiteName | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("AuthoringCharter.removeTestSuite", async () => {
      await this.#ensureTestSuiteNamed(name);
      await this.#charterRepository.removeTestSuite(name);
      return CharterDTOs.TestSuiteName.of({ name });
    });
  }

  /** Every file of evaluation cases as it was read, with its text, one that
   *  does not read among them. No charter is read: whether a case names what
   *  it holds is evaluating the charter's. */
  async listEvalSuites(): Promise<CharterDTOs.EvalSuites | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("AuthoringCharter.listEvalSuites", async () => {
      const { suitesByFile, faultsByFiles, suiteNameByFile, suiteTextByFile } = await this.#loadEvalRoot();
      // In the order their paths sort in: one that reads with its name, text,
      // description and each case said; one that does not with its name, its
      // text and the fault that says why.
      const suitePaths = [...Object.keys(suitesByFile), ...Object.keys(faultsByFiles.faultsByFilePath)].sort(
        (leftPath, rightPath) => leftPath.localeCompare(rightPath),
      );
      return CharterDTOs.EvalSuites.of({
        evalSuites: suitePaths.map((path) => {
          const suite = suitesByFile[path];
          const suiteText = suiteTextByFile[path];
          const [fault] = faultsByFiles.faultsByFilePath[path] ?? [];
          return CharterDTOs.EvalSuite.of({
            name: suiteNameByFile[path] ?? path,
            ...(suiteText === undefined ? {} : { text: suiteText }),
            ...(suite?.description === undefined ? {} : { description: suite.description }),
            cases: (suite?.cases ?? []).map(({ prompt, expect }) => CharterDTOs.EvalCase.of({ prompt, ...expect })),
            ...(fault === undefined ? {} : { fault: this.findingDTOOf(fault) }),
          });
        }),
      });
    });
  }

  async addEvalSuite(): Promise<CharterDTOs.EvalSuiteName | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("AuthoringCharter.addEvalSuite", async () => {
      const evalSuiteName = (await this.#loadEvalRoot()).untitledName;
      await this.#charterRepository.writeEvalSuite(evalSuiteName, EvalSuiteFactory.create(EvalSuite.defaultBody));
      return CharterDTOs.EvalSuiteName.of({ name: evalSuiteName });
    });
  }

  async writeEvalSuite(name: string, text: string): Promise<CharterDTOs.EvalSuiteName | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("AuthoringCharter.writeEvalSuite", async () => {
      await this.#ensureEvalSuiteNamed(name);
      // Refused with nothing written where the text does not read as a suite.
      await this.#charterRepository.writeEvalSuite(name, EvalSuiteFactory.create(text));
      return CharterDTOs.EvalSuiteName.of({ name });
    });
  }

  async removeEvalSuite(name: string): Promise<CharterDTOs.EvalSuiteName | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("AuthoringCharter.removeEvalSuite", async () => {
      await this.#ensureEvalSuiteNamed(name);
      await this.#charterRepository.removeEvalSuite(name);
      return CharterDTOs.EvalSuiteName.of({ name });
    });
  }

  async listSignInStatuses(): Promise<CharterDTOs.SignInStatuses | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("AuthoringCharter.listSignInStatuses", async () => {
      return CharterDTOs.SignInStatuses.of({
        signInStatuses: await Promise.all(
          (await this.#loadSignInAddresses()).map(async (signInAddress) =>
            this.#signInStatusDTOOf(
              signInAddress,
              (await this.#credentialsRepository.readCredential(signInAddress.address))?.method,
            ),
          ),
        ),
      });
    });
  }

  async signInWithToken(address: string, token: string): Promise<CharterDTOs.SignInStatus | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("AuthoringCharter.signInWithToken", async () => {
      const signInAddress = await this.#findSignInAddress(address, McpAuthMethod.TOKEN);
      if (token.trim() === "")
        throw new EmptyTokenFault(
          `No token was given for ${address}, so nothing was kept.`,
          'Run "cw mcp auth" again and paste the token.',
          { internal: false },
        );
      await this.#credentialsRepository.writeCredential({ address, method: McpAuthMethod.TOKEN, accessToken: token });
      return this.#signInStatusDTOOf(signInAddress, McpAuthMethod.TOKEN);
    });
  }

  async signInWithOAuth(
    address: string,
    showAuthorizationUrl: (authorizationUrl: string) => void,
  ): Promise<CharterDTOs.SignInStatus | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("AuthoringCharter.signInWithOAuth", async () => {
      const signInAddress = await this.#findSignInAddress(address, McpAuthMethod.OAUTH);
      const oauthGrant = await this.#oauthAuthorizer.authorizeInBrowser(address, showAuthorizationUrl);
      // What the authorization server registered `cw` as is kept as the
      // domain's registration, read off the grant in OAuth's words.
      await this.#credentialsRepository.writeCredential({
        address,
        method: McpAuthMethod.OAUTH,
        ...oauthGrant,
        client: new McpClientRegistration(oauthGrant.client),
      });
      return this.#signInStatusDTOOf(signInAddress, McpAuthMethod.OAUTH);
    });
  }

  /**
   * Every situation this repository wrote down, resolved against its charter
   * (FR-048, FR-049, FR-050).
   *
   * Read the charter, then ask it. What is added is the cases, read off
   * wherever the charter repository keeps them, and the resolving each one
   * comes out of — which runs nothing, fetches nothing and asks no agent, so a
   * run is decided by the charter alone.
   *
   * A charter with an error resolves nothing, for the reason a listing lists
   * nothing, and neither does a test file that is there and will not read — both
   * come back as faults under the file that has to change (FR-009). A repository
   * that wrote no tests resolves nothing either, and that is no fault: it has
   * not pinned its charter down yet, and the command says so.
   *
   * Reads and says: nothing here writes (FR-041).
   */
  async testCharter(): Promise<CharterDTOs.TestRunReport | FaultDTOs.FaultsByFile | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("AuthoringCharter.testCharter", async () => {
      const charter = await this.#loadCharterService.loadCharterRoot(this.#charterRepository);
      // A warning is said and lets the run through; what refuses it is only the
      // errors among the faults (FR-005).
      const charterErrorFaultsByFile = charter.allFaultsByFiles.filterErrors();
      if (!charterErrorFaultsByFile.isEmpty) return this.faultsByFileDTOOf(charterErrorFaultsByFile);

      const testRoot = TestRootFactory.create(await this.#charterRepository.loadTestSuites());

      // One bad file stops the run: the cases beside it would report a pass that
      // does not cover what the bad one was written to cover (FR-009). Every one
      // of them is named, not the first.
      if (!testRoot.faultsByFiles.isEmpty) return this.faultsByFileDTOOf(testRoot.faultsByFiles);

      return CharterDTOs.TestRunReport.of({
        testCaseReports: Object.entries(testRoot.suitesByFile)
          .flatMap(([filePath, suite]) =>
            TestService.runSuite(charter, testRoot.suiteNameByFile[filePath] ?? filePath, suite),
          )
          .map(({ suiteName, situation, hasPassed, unmetFault }) =>
            CharterDTOs.TestCaseReport.of({
              suiteName,
              situation,
              passed: hasPassed,
              ...(unmetFault === undefined ? {} : { unmet: this.findingDTOOf(unmetFault) }),
            }),
          ),
      });
    });
  }

  async setUpCharter(): Promise<CharterDTOs.CharterLayout | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("AuthoringCharter.setUpCharter", async () => {
      // A folder per kind, and one each for the tests, the eval cases and the
      // vendors, which a filesystem only keeps once there is a file in it
      // (FR-001, CORE-FR-224).
      await this.#charterRepository.createCharter();
      return CharterDTOs.CharterLayout.of({ charterUri: this.#charterRepository.findCharterUri() });
    });
  }

  /** Refused where the repository is laid out the old way, naming the skill
   *  that moves it (CORE-FR-226); what keeps the charter knows its layout. */
  async readCharterLayout(): Promise<CharterDTOs.CharterLayout | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("AuthoringCharter.readCharterLayout", async () => {
      await this.#charterRepository.assertLayout();
      return CharterDTOs.CharterLayout.of({ charterUri: this.#charterRepository.findCharterUri() });
    });
  }

  /**
   * The access token a call to this mcp origin is made with: the developer's own,
   * renewed first where it has expired, asking nobody (FR-151, SC-035).
   *
   * An mcp origin nobody signed in to, or whose credential expired and cannot be
   * renewed, is refused naming the command that signs in again there. A renewal
   * is kept, so the next call uses it rather than renewing again. An mcp origin at
   * plain `http` on another machine is refused before anything is read: the
   * credential would travel in the clear.
   *
   * `isRefused` says the mcp origin has just refused this credential, so it is renewed
   * whatever its expiry says.
   */
  async getAccessToken(
    { address, endpoint, mcpId }: McpOriginAddress,
    isRefused: boolean,
  ): Promise<CharterDTOs.AccessToken | FaultDTOs.Fault> {
    return this.answerWithFaultDTO("AuthoringCharter.getAccessToken", async () => {
      if (endpoint !== undefined && !new SecureEndpointSpec().isSatisfiedBy(endpoint))
        throw new InsecureEndpointFault(
          `${address} is plain http to another machine, so no credential is sent there.`,
          'Declare its endpoint as https://, then run "cw build".',
          { internal: false },
        );
      const signInAgain = `Run "cw mcp auth ${mcpId}" at a terminal to sign in there.`;
      const credential = await this.#credentialsRepository.readCredential(address);
      if (credential === undefined)
        throw new NotSignedInFault(`You are not signed in to ${address}.`, signInAgain, { internal: false });

      // A credential the mcp origin has just refused is renewed as an expired one is:
      // the mcp origin knows better than `expiresAt` (FR-151).
      const isExpired =
        isRefused ||
        (credential.expiresAt !== undefined && Date.parse(credential.expiresAt) <= this.#clock.tellTime().getTime());
      if (!isExpired) return CharterDTOs.AccessToken.of({ accessToken: credential.accessToken });

      const { method, client, address: _keptAddress, ...tokens } = credential;
      const renewedGrant =
        endpoint !== undefined && client !== undefined && tokens.refreshToken !== undefined
          ? await this.#oauthAuthorizer.renewGrant(endpoint, { ...tokens, client })
          : undefined;
      if (renewedGrant === undefined)
        throw new ExpiredSignInFault(`Your sign-in to ${address} has expired and could not be renewed.`, signInAgain, {
          internal: false,
        });

      await this.#credentialsRepository.writeCredential({
        address,
        method,
        ...renewedGrant,
        client: new McpClientRegistration(renewedGrant.client),
      });
      return CharterDTOs.AccessToken.of({ accessToken: renewedGrant.accessToken });
    });
  }

  /** The primitive one id names, off the files as read and not the
   *  validation. Raised when the charter holds nothing of it, the way `explainPrimitive`
   *  raises it: there is no file it is wrong with. */
  async #findPrimitiveById(id: string): Promise<Primitive> {
    const primitiveId = Primitives.idOf(id);
    const charter = await this.#loadCharterService.loadCharterRoot(this.#charterRepository);
    const primitive = charter.primitiveById.get(primitiveId);
    if (primitive === undefined)
      throw new UnknownIdFault(`This charter holds no "${id}".`, 'Run "cw list --min" to see every id it does hold.', {
        internal: false,
      });
    return primitive;
  }

  /** One word read as the kind it names. Raised rather than reported, the way a
   *  listing's is: there is no file it is wrong with, and what comes back names
   *  every kind there is. */
  #findKind(kind: string): Kind {
    if (!Primitives.isKind(kind))
      throw new UnknownKindFault(
        `"${kind}" is not a kind the charter knows.`,
        `Ask for one the charter knows: ${Primitives.kinds.join(", ")}.`,
        { internal: false },
      );
    return kind;
  }

  /**
   * One primitive put where its kind's primitives are authored (FR-039).
   *
   * Where it is kept is the charter repository's to say: it refuses one
   * kept already, or one that would sit inside another primitive or hold it,
   * writing nothing then (FR-141, FR-167). A file already there is refused
   * rather than written over: what somebody authored is theirs.
   *
   * What comes back is the primitive as the charter will hold it once read: its
   * id, this repository's layer, and where it was kept — so a caller can say
   * what it wrote without going and looking.
   */
  async #writeNewPrimitive(primitive: Primitive): Promise<Primitive> {
    // The asset a script runs, empty, so its author knows where to write it; one
    // already standing there is theirs and is left as it is (FR-167).
    const assets =
      primitive instanceof ScriptPrimitive ? [new AssetFile(primitive.executionPathInFolder, new Uint8Array())] : [];
    const markdownText = primitive.writeMarkdown();
    const keptUri = await this.#charterRepository.addPrimitive(
      new RawPrimitive(PrimitiveLayer.REPO, primitive.kind, primitive.headers.id, markdownText, assets, ""),
    );
    return PrimitiveFactory.create(
      new RawPrimitive(PrimitiveLayer.REPO, primitive.kind, primitive.headers.id, markdownText, assets, keptUri),
    );
  }

  /** One repository's self-regression tests (FR-047): what each file holds is
   *  `TestRootFactory.create`'s to read, as a charter's is `CharterRootFactory.create`'s. */
  async #loadTestRoot(): Promise<TestRoot> {
    return TestRootFactory.create(await this.#charterRepository.loadTestSuites());
  }

  /** Refused unless a test file is listed under this name. A name that is none — a name reaching
   *  outside the store's tests among them — is refused, so nothing but a test file is
   *  ever written over or taken away. */
  async #ensureTestSuiteNamed(testSuiteName: string): Promise<void> {
    if (!(await this.#loadTestRoot()).hasTestSuiteNamed(testSuiteName))
      throw new UnknownTestSuiteFault(
        `The charter holds no test file called "${testSuiteName}".`,
        'Run "cw suite add" to write a new one.',
        { internal: false },
      );
  }

  /** One repository's evaluation cases, as `EvalRootFactory.create` reads
   *  them. */
  async #loadEvalRoot(): Promise<EvalRoot> {
    return EvalRootFactory.create(await this.#charterRepository.loadEvalSuites());
  }

  /** Refused unless a file of evaluation cases is listed under this name, so
   *  nothing but one is ever written over or taken away. */
  async #ensureEvalSuiteNamed(evalSuiteName: string): Promise<void> {
    if (!(await this.#loadEvalRoot()).hasEvalSuiteNamed(evalSuiteName))
      throw new UnknownEvalSuiteFault(
        `The charter holds no evaluation file called "${evalSuiteName}".`,
        "List the evaluation files, or add a new one.",
        { internal: false },
      );
  }

  /**
   * Every address a developer signs in to, once, ordered by address (plan
   * §19.5): one address is one account at one service, whatever path each
   * mcp origin there names. A local command taking no token signs in to nothing and
   * is left out.
   *
   * Read off the charter rather than the last build (FR-148): a build stops on
   * an mcp origin it is not signed in to (EVAL-FR-031), so an mcp added since
   * would never be listed for the sign-in that lets it build.
   */
  async #loadSignInAddresses(): Promise<readonly Pick<McpOrigin, "address" | "endpoint" | "ids" | "auth">[]> {
    const charter = await this.#loadCharterService.loadCharterRoot(this.#charterRepository);
    const signInAddressByAddress = new Map<
      string,
      { endpoint?: string; ids: Set<string>; auth: Set<McpAuthMethodName> }
    >();
    for (const mcpPrimitive of charter.primitives) {
      if (!(mcpPrimitive instanceof McpPrimitive) || mcpPrimitive.headers.auth === undefined) continue;
      const { id, endpoint, auth } = mcpPrimitive.headers;
      const signInAddress = signInAddressByAddress.get(mcpPrimitive.address) ?? {
        ...(endpoint !== undefined && { endpoint }),
        ids: new Set(),
        auth: new Set(),
      };
      signInAddress.ids.add(id);
      for (const method of auth) signInAddress.auth.add(method);
      signInAddressByAddress.set(mcpPrimitive.address, signInAddress);
    }
    return [...signInAddressByAddress]
      .sort(([leftAddress], [rightAddress]) => leftAddress.localeCompare(rightAddress))
      .map(([address, { endpoint, ids, auth }]) => ({
        address,
        ...(endpoint !== undefined && { endpoint }),
        ids: [...ids].sort(),
        auth: McpAuthMethod.names.filter((methodName) => auth.has(methodName)).map(McpAuthMethod.of),
      }));
  }

  /** Refused where no mcp origin is at this address, or none there allows signing
   *  in this way: a credential nothing would use is not kept. Refused too where
   *  the address is plain `http` to another machine, whatever the build said:
   *  the list is a committed file, and a credential sent there travels in the
   *  clear. What comes back is the address taken. */
  async #findSignInAddress(
    address: string,
    method: McpAuthMethod,
  ): Promise<Pick<McpOrigin, "address" | "endpoint" | "ids" | "auth">> {
    const signInAddress = (await this.#loadSignInAddresses()).find(
      (originAddress) => originAddress.address === address,
    );
    if (signInAddress === undefined)
      throw new UnknownSignInAddressFault(
        `No mcp in the charter is at ${address}.`,
        'Run "cw mcp auth --status" to see every address.',
        { internal: false },
      );
    if (signInAddress.endpoint !== undefined && !new SecureEndpointSpec().isSatisfiedBy(signInAddress.endpoint))
      throw new InsecureEndpointFault(
        `${address} is plain http to another machine, so no credential is sent there.`,
        'Declare its endpoint as https://, then run "cw build".',
        { internal: false },
      );
    if (!signInAddress.auth.includes(method))
      throw new UnsupportedSignInMethodFault(
        `${address} is not signed in to by ${method}; it allows ${signInAddress.auth.join(" or ")}.`,
        `Sign in there by ${signInAddress.auth.join(" or ")}.`,
        { internal: false },
      );
    return signInAddress;
  }

  /** One primitive as the whole charter sees it: what it is called and what it
   *  is for, the file it was authored in, which layer that file arrived in,
   *  every header it declared, its body and its hash (FR-017, FR-078). */
  #primitiveDTOOf(primitive: Primitive): CharterDTOs.Primitive {
    const { layer, uri, body, hash } = primitive;
    return CharterDTOs.Primitive.of({
      id: primitive.headers.id,
      kind: primitive.kind,
      description: primitive.headers.description,
      file: uri,
      layerName: layer.name,
      // A header nobody wrote is left out rather than carried as undefined: this
      // says what the file declared. A yes or no is carried as the line an
      // author types for it.
      headers: Object.fromEntries(
        Object.entries(primitive.headers).flatMap(
          ([field, headerValue]: [string, string | readonly string[] | boolean | undefined]) =>
            headerValue === undefined
              ? []
              : [[field, typeof headerValue === "boolean" ? String(headerValue) : headerValue]],
        ),
      ),
      body,
      hash,
    });
  }

  /** One address a developer signs in to, and how they signed in there, never
   *  the credential itself (FR-150, SC-036). */
  #signInStatusDTOOf(
    { address, ids, auth }: Pick<McpOrigin, "address" | "ids" | "auth">,
    method: McpAuthMethod | undefined,
  ): CharterDTOs.SignInStatus {
    return CharterDTOs.SignInStatus.of({
      address,
      ids,
      auth: auth.map((authMethod) => authMethod.name),
      signedIn: method !== undefined,
      ...(method !== undefined && { method: method.name }),
    });
  }

  /** What installing one vendor source came to: each folder it filled — each
   *  vendor's own, or the charter's where it was injected into it — and the
   *  primitives installed there (CORE-FR-184, CORE-FR-196). */
  #vendorAddOutcomeDTOOf(filteredSource: VendorSource, injectedCharterUri?: string): CharterDTOs.VendorAddOutcome {
    const rootName = vendorSourcePath.ownCharterName;
    const findVendorFolderUri = (charterName: string) =>
      injectedCharterUri ?? this.#charterRepository.findVendorUri(`${filteredSource.origin.name}/${charterName}`);
    const composeVendorAddOutcome = (charterName: string, sourceCharter: SourceCharter) => ({
      folder: findVendorFolderUri(charterName),
      primitives: sourceCharter.rawPrimitives.map((rawPrimitive) =>
        CharterDTOs.VendorPrimitive.of({
          kind: rawPrimitive.kind,
          id: rawPrimitive.id,
          description: sourceCharter.descriptionOf(rawPrimitive),
          leftOutHeaders: [],
        }),
      ),
    });
    return CharterDTOs.VendorAddOutcome.of([
      ...(filteredSource.ownCharter === undefined
        ? []
        : [composeVendorAddOutcome(rootName, filteredSource.ownCharter)]),
      ...filteredSource.charters.map((sourceCharter) => composeVendorAddOutcome(sourceCharter.name, sourceCharter)),
      ...(filteredSource.skills.length === 0
        ? []
        : [
            {
              folder: findVendorFolderUri(rootName),
              primitives: filteredSource.skills.map(({ convertedSkill, leftOutHeaders }) =>
                CharterDTOs.VendorPrimitive.of({
                  kind: SkillPrimitive.kind,
                  id: convertedSkill.headers.id,
                  description: convertedSkill.headers.description,
                  leftOutHeaders,
                }),
              ),
            },
          ]),
    ]);
  }
}
