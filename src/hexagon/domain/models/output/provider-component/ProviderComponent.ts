import type { Projection, ProjectionPolicy } from "../ProjectionPolicy.js";

/**
 * One file a host reads, whichever host: where it goes, what it holds, and how
 * it goes down over what is there — so putting it on disk knows nothing of the
 * host that asked for it (FR-018).
 *
 * A host's file is a document (`DocumentBasedComponent`) or settings
 * (`SettingBasedComponent`); each of a host's own kinds extends one of the two.
 */
export abstract class ProviderComponent {
  protected constructor(
    /** Where the host reads it, from the repository: the host's own kind
     *  decides it. */
    readonly path: string,
    /** The whole of what the file holds, or of this engine's part of it. */
    readonly document: string,
    readonly projectionPolicy: ProjectionPolicy,
  ) {}

  /** The file it is put down as, and how it goes down over what is there. */
  get projections(): readonly Projection[] {
    return [{ file: this.path, contents: this.document, projectionPolicy: this.projectionPolicy, executable: false }];
  }

  /** Which of its host's kinds this is. Each class declares it as a literal. */
  abstract readonly kind: string;
}
