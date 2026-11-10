/**
 * One file a host reads, whichever host: what it is and what it holds, so
 * laying it knows nothing of the host that asked for it but its kind there
 * and its id (FR-018).
 *
 * A host's file is a document (`DocumentBasedComponent`) or settings
 * (`SettingBasedComponent`); each of a host's own kinds extends one of the two.
 * Where it lands, and how it goes over what is there, is its host's
 * projection's (CORE-FR-221).
 */
export abstract class ProviderComponent {
  protected constructor(
    /** The host that reads it. */
    readonly host: string,
    /** The kind of the primitive it was compiled from, or `charter` where it
     *  is the whole charter's. */
    readonly primitiveKind: string,
    /** What that host knows it by: the name it is called, or, for a file of
     *  the whole charter, the folder it is for or the part it plays. */
    readonly id: string,
    /** The whole of what the file holds, or of this engine's part of it, each
     *  path into the build's output under `$CW_OUT/`. */
    readonly document: string,
    readonly warnings: readonly string[] = [],
  ) {}

  get text(): string {
    return this.document;
  }

  /** Which of its host's kinds this is. Each class declares it as a literal. */
  abstract readonly kind: string;
}
