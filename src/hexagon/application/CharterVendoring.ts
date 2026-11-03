import { injectVendor } from "../service/injectVendorService.js";
import { addVendor, loadVendorNames, removeVendor } from "../service/vendorRepo.js";
import { vendorAddOutcomeDTO } from "./dtos.js";
import type { ForVendoringCharters } from "../port/driver/ForVendoringCharters.js";
import type { OutcomeDTOs } from "../port/driver/dtos/index.js";
import type { ForParsingYaml } from "../port/zdriven/ForParsingYaml.js";
import type { ForReadingFiles } from "../port/zdriven/ForReadingFiles.js";
import type { ForFetchingSources } from "../port/zdriven/ForFetchingSources.js";
import type { ForWritingFiles } from "../port/zdriven/ForWritingFiles.js";

/**
 * APPLICATION SERVICE — the charters a repository installs rather than authors
 * (FR-023, FR-027).
 *
 * The fetching port reaches the source and puts what it fetched in place. What
 * this writes itself is a skill converted from a skills repository, beside the
 * files fetching put there, and what removing deletes, so it holds the writing
 * port and the parser a `SKILL.md` is read with (CORE-FR-186). Installing,
 * removing and listing are `vendorRepo`'s.
 */
export class CharterVendoring implements ForVendoringCharters {
  readonly #repoPath: URL;
  readonly #fileReader: ForReadingFiles;
  readonly #sourceFetcher: ForFetchingSources;
  readonly #fileWriter: ForWritingFiles;
  readonly #yamlParser: ForParsingYaml;

  constructor(
    /** The repository this speaks for, named once: a vendor is installed into
     *  one repository and removed from the same one, so it is what this is
     *  constructed with rather than what every call carries. */
    repoPath: URL,
    fileReader: ForReadingFiles,
    sourceFetcher: ForFetchingSources,
    fileWriter: ForWritingFiles,
    yamlParser: ForParsingYaml,
  ) {
    this.#repoPath = repoPath;
    this.#fileReader = fileReader;
    this.#sourceFetcher = sourceFetcher;
    this.#fileWriter = fileWriter;
    this.#yamlParser = yamlParser;
  }

  async add(source: string, version?: string, skillIds: readonly string[] = [], charterNames: readonly string[] = []): Promise<OutcomeDTOs.VendorAddOutcome> {
    return vendorAddOutcomeDTO(await addVendor(this.#repoPath, this.#fileReader, this.#fileWriter, this.#sourceFetcher, this.#yamlParser, source, version, skillIds, charterNames));
  }

  async inject(source: string, version?: string, skillIds: readonly string[] = [], charterNames: readonly string[] = []): Promise<OutcomeDTOs.VendorAddOutcome> {
    return vendorAddOutcomeDTO(await injectVendor(this.#repoPath, this.#fileReader, this.#fileWriter, this.#sourceFetcher, this.#yamlParser, source, version, skillIds, charterNames));
  }

  async remove(name: string): Promise<string> {
    return removeVendor(this.#repoPath, this.#fileReader, this.#fileWriter, name);
  }

  async installed(): Promise<readonly string[]> {
    return loadVendorNames(this.#repoPath, this.#fileReader);
  }
}
