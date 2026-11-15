// What a build does with tsup's `loader`, for whatever runs the sources
// through tsx: a `.mjs` file under the engine's own layer, and a file of
// `cw vendor init`'s template, is an asset put down, imported as its text and
// never run (`pnpm test`, `pnpm cw`).
import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`
import { readFile } from "node:fs/promises";
export async function load(url, context, nextLoad) {
  if (!/\\/src\\/(module\\/charter\\/domain\\/builtin\\/.+\\.mjs|presentation\\/cli\\/templates\\/.+\\.(mjs|md|txt))$/.test(url)) return nextLoad(url, context);
  const assetText = await readFile(new URL(url), "utf8");
  return { format: "module", source: "export default " + JSON.stringify(assetText), shortCircuit: true };
}`),
);
