/** One suite of self-regression tests as what keeps them keeps it, before the
 *  engine reads it: the name it is asked for by (`untitled-1.json`, FR-124),
 *  what it holds, and where it is kept, said back and never read
 *  (CORE-FR-213). */
export class RawTestSuite {
  constructor(
    readonly name: string,
    readonly text: string,
    readonly uri: string,
  ) {}
}
