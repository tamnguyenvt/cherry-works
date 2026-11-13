/** What this repository installed from others: every vendor, by the name it
 *  was installed as, `<owner>/<repository>/<name>` (FR-050, CORE-FR-196), and
 *  where it is kept, said back and never read. */
export class VendorRoot {
  constructor(
    /** Every vendor installed, as `cw vendor list` names them (FR-053). */
    readonly vendors: readonly { readonly name: string; readonly uri: string }[],
  ) {}
}
