/** A charter this repository installs rather than authors: the source as it
 *  was typed, handed to version control as it is, and the name of the folder
 *  it lands in under the vendor folder, its owner and its repository (FR-049,
 *  FR-050). */
export class VendorSourceOrigin {
  constructor(
    readonly sourceUri: string,
    readonly name: string,
  ) {}
}
