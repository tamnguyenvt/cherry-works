import { AgentProvider } from "#module/shared/module.js";
import type { CharterRoot } from "../charter/charter-root.js";
import { AgentBasedPrimitive } from "../primitive/agent-based-primitive.js";
import type { Primitive } from "../primitive/primitive.js";
import { Catalogue, CatalogueEntry } from "./catalogue.js";

/** Makes the catalogue a build writes. */
export class CatalogueFactory {
  /**
   * Every primitive of the charter, listed under the file a reader is sent to for
   * its body (FR-011).
   *
   * Two readers, two files. The catalogue a build writes sends an agent to the
   * compiled primitive; the listing a person asks for sends them to the file they
   * would edit, which is also what says which layer it came from (FR-140). Which
   * is the caller's to say, and everything else an entry holds is the same.
   *
   * Globs nobody wrote are left out rather than listed as nothing. Every other
   * header is read from the file the entry names.
   */
  static create(charter: CharterRoot, fileOf: (primitive: Primitive) => string): Catalogue {
    return new Catalogue(
      // Ordered by id rather than by the order the files happened to be
      // read, so the same charter catalogues byte for byte the same (SC-007).
      [...charter.primitives]
        .sort((leftPrimitive, rightPrimitive) =>
          leftPrimitive.headers.id < rightPrimitive.headers.id
            ? -1
            : leftPrimitive.headers.id > rightPrimitive.headers.id
              ? 1
              : 0,
        )
        .map((primitive) => {
          const { description, globs } = primitive.headers;
          // Listed for every agent where it names none, and in each named
          // agent's own listing otherwise.
          const agentProviders =
            primitive instanceof AgentBasedPrimitive ? primitive.headers["agent-provider"] : undefined;
          return new CatalogueEntry({
            agentProviders:
              agentProviders === undefined || agentProviders.length === 0
                ? "all"
                : agentProviders.map((agentName) => new AgentProvider(agentName)),
            kind: primitive.kind,
            id: primitive.headers.id,
            description,
            file: fileOf(primitive),
            ...(globs === undefined ? {} : { globs }),
          });
        }),
    );
  }

  private constructor() {}
}
