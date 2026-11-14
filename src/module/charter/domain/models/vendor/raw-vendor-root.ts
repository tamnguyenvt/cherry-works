/** What this repository installed from others, as what keeps it keeps it,
 *  before the engine reads it: the name each vendor is kept under,
 *  `<owner>/<repository>/<name>` (FR-050, CORE-FR-196). */
export class RawVendorRoot {
  constructor(readonly vendorNames: readonly string[]) {}
}
