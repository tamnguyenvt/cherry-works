/** One charter of primitives as its store keeps it, before the engine reads
 *  it: its name, the text of its `cw-package.json` where it holds one, and
 *  where it and that file are kept, said back and never read
 *  (VENDOR-FR-009, VENDOR-FR-010). */
export class RawCharterMetadata {
  constructor(
    readonly name: string,
    readonly installedCharterRecordText: string | undefined,
    readonly uri: string,
    readonly installedCharterRecordUri: string,
  ) {}
}
