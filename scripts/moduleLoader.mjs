// What a build does with tsup's `loader`, for whatever runs the sources
// through tsx: a `.mjs` file under the engine's own layer is an asset the
// engine puts down, imported as its text and never run (`pnpm test`, `pnpm cw`).
import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`
import { readFile } from "node:fs/promises";
export async function load(url, context, nextLoad) {
  if (!/\\/src\\/hexagon\\/domain\\/models\\/charter\\/builtin\\/.+\\.mjs$/.test(url)) return nextLoad(url, context);
  const assetText = await readFile(new URL(url), "utf8");
  return { format: "module", source: "export default " + JSON.stringify(assetText), shortCircuit: true };
}`),
);
