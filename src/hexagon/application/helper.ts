/** The SHA-256 of one text, in hex: what a revision is, so two readings of a
 *  primitive are compared by a short string that crosses HTTP as it is (plan
 *  §9.4). Web Crypto is a global of the runtime rather than a module, so the
 *  hexagon imports nothing for it. */
export async function contentHashOf(content: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
