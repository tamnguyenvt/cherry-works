/** Where a charter this repository installs rather than authors comes from:
 *  the source as it was typed, handed to version control as it is (FR-049,
 *  FR-050). */
export class CharterSourceOrigin {
  constructor(readonly sourceUri: string) {}
}
