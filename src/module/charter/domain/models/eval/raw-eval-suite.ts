/** One file of evaluation cases as what keeps them keeps it, before the
 *  engine reads it: the name it is reported under, what it holds, and where it
 *  is kept, said back and never read (CORE-FR-213). */
export class RawEvalSuite {
  constructor(
    readonly name: string,
    /** The charter it is kept in (VENDOR-FR-009). */
    readonly charterName: string,
    readonly text: string,
    readonly uri: string,
  ) {}
}
