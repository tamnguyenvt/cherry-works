/** One file of a primitive's folder beside its `index.md`: the path it has in
 *  that folder, and the bytes it holds, never decoded, so it is copied whole
 *  whatever it holds (FR-168, CORE-FR-207). */
export class AssetFile {
  constructor(
    readonly assetPath: string,
    readonly contents: Uint8Array,
  ) {}
}
