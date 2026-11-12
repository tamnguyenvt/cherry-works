import type { AgentProvider } from "#module/shared/module.js";
import { CharterOutputItem } from "./charter-output-item.js";

/**
 * What a charter holds, listed for whoever reads it (FR-011, FR-013).
 *
 * Output, not charter: nothing here was authored and nothing here is read back,
 * and nothing here knows what a primitive is — reading one into an entry is the
 * service's, and this is handed the list (plan §2.6).
 *
 * It says itself what it is and what it holds; where it lands is the
 * projection's (CORE-FR-221).
 *
 * Ordered by id rather than by the order the files happened to be read, so
 * the same charter catalogues byte for byte the same and a committed catalogue
 * changes only when the charter does (SC-007).
 *
 * No bodies. What a primitive says is read from the file it names,
 * when the thing it applies to comes up and not before (FR-013).
 */
export class Catalogue extends CharterOutputItem {
  /** Entries in the order they are to be listed: by id (SC-007). */
  constructor(
    readonly entries: readonly CatalogueEntry[],
    readonly agent?: AgentProvider,
  ) {
    super();
  }

  /** What it holds: the charter's own. Indented, since it is committed and
   *  read in diffs, and a listing whose entries land one per line says what
   *  changed in the charter rather than that the listing changed. */
  get text(): string {
    const agentName = this.agent?.name;
    const catalogueEntries = this.entries
      .filter((catalogueEntry) =>
        agentName === undefined
          ? catalogueEntry.agentProviders === "all"
          : catalogueEntry.agentProviders !== "all" &&
            catalogueEntry.agentProviders.some((agentProvider) => agentProvider.name === agentName),
      )
      .map(({ agentProviders, ...catalogueEntry }) => catalogueEntry);
    return `${JSON.stringify(catalogueEntries, undefined, 2)}\n`;
  }

  /**
   * The same listing, narrowed to the primitives of one kind (FR-011).
   *
   * A narrowed listing is a listing: what comes back answers `entries` the way
   * this does, so whoever reads it never has to ask whether it was narrowed. Nothing is re-sorted — the entries keep the order they were
   * put in, which is the order by id they were made in.
   */
  filterByKind(kind: string): Catalogue {
    return new Catalogue(
      this.entries.filter((catalogueEntry) => catalogueEntry.kind === kind),
      this.agent,
    );
  }
}

/**
 * One primitive as the listing records it: what it is called, what it is for,
 * the files it applies to, and the file its body is in (FR-011). Its kind and
 * id are all it is known by, and every other header is read from that file.
 *
 * Globs nobody wrote are left out rather than recorded as nothing.
 */
export class CatalogueEntry {
  /** The agents it is listed for, or `all` where its primitive names none:
   *  what splits the catalogues in memory; omitted from their JSON files. */
  readonly agentProviders: "all" | readonly AgentProvider[];
  readonly kind: string;
  readonly id: string;
  readonly description: string;
  /** Where the body is: a link, under `$CW_OUT/`, to the compiled
   *  primitive, in what a build writes; the authored file's uri, in what a
   *  person is listed (FR-140). */
  readonly file: string;
  readonly globs?: readonly string[];

  constructor(catalogueEntry: CatalogueEntry) {
    this.agentProviders = catalogueEntry.agentProviders;
    this.kind = catalogueEntry.kind;
    this.id = catalogueEntry.id;
    this.description = catalogueEntry.description;
    this.file = catalogueEntry.file;
    if (catalogueEntry.globs !== undefined) this.globs = catalogueEntry.globs;
  }
}
