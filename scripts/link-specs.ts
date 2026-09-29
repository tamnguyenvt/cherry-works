/**
 * Turns every id the spec cites — FR-xxx, SC-xxx, "Story n" — into a link to
 * where it is defined, so a click in the editor
 * or on GitHub lands on it. Idempotent: the links and anchors it wrote last time
 * are taken off and written again, so a renumbered id follows its definition.
 *
 *   node --import tsx scripts/link-specs.ts          rewrite the specs
 *   node --import tsx scripts/link-specs.ts --check  change nothing; fail if a
 *                                                     file is stale or an id is
 *                                                     cited that nothing defines
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const SPECS = join(import.meta.dirname, "..", "specs");
const SPEC = join(SPECS, "spec.md");
const LINKED_FILES = [SPEC];

type Target = { file: string; fragment: string };

// The slug GitHub and VS Code both give a heading: letters, marks, numbers,
// underscores, spaces and hyphens kept, spaces made hyphens, repeats suffixed.
function headingSlugsOf(text: string): Map<string, string> {
  const slugsByHeading = new Map<string, string>();
  const seenSlugCounts = new Map<string, number>();
  for (const line of text.split("\n")) {
    const heading = /^#{1,6} (.*?)#*\s*$/.exec(line)?.[1];
    if (heading === undefined) continue;
    const base = heading.trim().toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "").replace(/ /g, "-");
    const seen = seenSlugCounts.get(base) ?? 0;
    seenSlugCounts.set(base, seen + 1);
    slugsByHeading.set(heading, seen ? `${base}-${seen}` : base);
  }
  return slugsByHeading;
}

const ANCHOR = /<a id="[^"]*"><\/a>/g;
const GENERATED_LINK = /\[((?:FR|SC)-\d+|Story \d+)\]\([^)\s]*\)/g;
const ITEM_DEFINITION = /^(- )\*\*((?:FR|SC)-\d+)\*\*/;

const originalTextByFile = new Map(LINKED_FILES.map((file) => [file, readFileSync(file, "utf8")]));
const plainTextByFile = new Map(
  [...originalTextByFile].map(([file, text]) => [file, text.replace(ANCHOR, "").replace(GENERATED_LINK, "$1")]),
);

// Where each id is defined: an item carries an anchor of its own id; a story
// is a heading, reached by its slug.
const targetsById = new Map<string, Target>();
for (const [file, text] of plainTextByFile) {
  for (const line of text.split("\n")) {
    const itemId = ITEM_DEFINITION.exec(line)?.[2];
    if (itemId) targetsById.set(itemId, { file, fragment: itemId.toLowerCase() });
  }
}
for (const [file, text] of plainTextByFile) {
  for (const [heading, slug] of headingSlugsOf(text)) {
    const storyNumber = /^User Story (\d+)\b/.exec(heading)?.[1];
    if (storyNumber) targetsById.set(`Story ${storyNumber}`, { file, fragment: slug });
  }
}

const unresolvedCitations: string[] = [];
const CITATION = /(?<![\w.[-])((?:FR|SC)-\d{3}|Story \d+)(?![\w-]|\.\d)/g;

function linkedLineOf(line: string, file: string, lineNumber: number): string {
  return line.replace(CITATION, (citation, id: string) => {
    const target = targetsById.get(id);
    if (!target) {
      unresolvedCitations.push(`${relative(SPECS, file)}:${lineNumber}: ${citation}`);
      return citation;
    }
    const href = `${target.file === file ? "" : relative(dirname(file), target.file)}#${target.fragment}`;
    return `[${id}](${href})`;
  });
}

let staleFiles = 0;
for (const [file, text] of plainTextByFile) {
  let inCodeBlock = false;
  const linkedText = text
    .split("\n")
    .map((line, index) => {
      if (line.startsWith("```")) inCodeBlock = !inCodeBlock;
      if (inCodeBlock || line.startsWith("#")) return line;
      const [definition, listMarker, itemId] = ITEM_DEFINITION.exec(line) ?? [];
      const anchored =
        definition && itemId
          ? `${listMarker}<a id="${itemId.toLowerCase()}"></a>**${itemId}**${line.slice(definition.length)}`
          : line;
      // Code spans are left as they are; only the prose between them is linked.
      return anchored
        .split(/(`[^`]*`)/)
        .map((part) => (part.startsWith("`") ? part : linkedLineOf(part, file, index + 1)))
        .join("")
        .replace(/(<a id="[^"]*"><\/a>)\*\*\[([^\]]+)\]\([^)]*\)\*\*/, "$1**$2**");
    })
    .join("\n");
  if (linkedText === originalTextByFile.get(file)) continue;
  staleFiles++;
  if (process.argv.includes("--check")) console.error(`stale: ${relative(SPECS, file)}`);
  else writeFileSync(file, linkedText);
}

for (const citation of unresolvedCitations) console.error(`nothing defines ${citation}`);
if (process.argv.includes("--check") && (staleFiles || unresolvedCitations.length)) process.exit(1);
if (!process.argv.includes("--check")) console.log(`linked ${staleFiles} file(s)`);
