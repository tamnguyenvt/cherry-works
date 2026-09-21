import picomatch from "picomatch";

/**
 * UTILITY — glob algebra. It knows about glob strings and nothing about
 * charters, primitives or files on a disk, which is why it sits outside the
 * domain's own vocabulary rather than inside it.
 */

/** Does everything `outer` matches include everything `inner` matches? Coverage
 *  rather than equality, decided by reading the narrower glob as though it were
 *  a path: `**\/*.ts` matches the text `src/**\/*.ts`, and `src/**\/*.ts` does not
 *  match the text `**\/*.ts`, which is the asymmetry coverage needs. Where that
 *  cannot decide, the answer is no — a charter is asked to say plainly what it
 *  means rather than being guessed at. */
export function covers(outer: string, inner: string): boolean {
  return outer === inner || matches(outer, inner);
}

/** Does this glob match this path? The plain question, asked where a charter
 *  speaks about files and a change touched one. */
export function matches(glob: string, path: string): boolean {
  return picomatch(glob, { dot: true })(path);
}
