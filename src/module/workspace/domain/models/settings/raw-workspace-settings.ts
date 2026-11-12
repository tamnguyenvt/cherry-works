/** A repository's settings as they are kept, raw, before the engine reads
 *  them: the text they are written in (FR-037). */
export class RawWorkspaceSettings {
  constructor(readonly text: string) {}
}
