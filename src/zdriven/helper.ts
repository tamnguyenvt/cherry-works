/** A file's text, decoded where it was written as bytes, as a disk would. */
export function decodeContents(contents: string | Uint8Array): string {
  return typeof contents === "string" ? contents : new TextDecoder("utf-8", { ignoreBOM: true }).decode(contents);
}

/** A file's bytes, encoded where it was written as text, as a disk would, bytes as a copy of their own. */
export function encodeContents(contents: string | Uint8Array): Uint8Array {
  return typeof contents === "string" ? new TextEncoder().encode(contents) : contents.slice();
}
