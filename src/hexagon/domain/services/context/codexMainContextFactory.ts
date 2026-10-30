import type { CharterRoot } from "../../models/charter/CharterRoot.js";
import type { MainContextText } from "../../models/context/MainContext.js";
import { CodexEntryFile } from "../../models/output/provider-component/codex/CodexEntryFile.js";
import { CodexSkill } from "../../models/output/provider-component/codex/CodexSkill.js";
import { compile } from "../compile/compileService.js";

/** Estimate charter instructions and discovered skills, excluding Codex's own
 * system prompt. Scoped guide bodies are charged only when their globs apply. */
export function codexMainContextOf(charter: CharterRoot): readonly MainContextText[] {
  const { charterMd, compiledPrimitives, providerComponents } = compile(charter, ["codex"]);
  const compiledDocumentById = new Map(compiledPrimitives.map((primitive) => [primitive.id, primitive.projections[0]!.contents]));
  return [
    ...providerComponents.flatMap((component): MainContextText[] => {
      if (component instanceof CodexEntryFile) return [{ id: component.path, kind: "charter", text: component.document, ...(component.path === "AGENTS.md" ? {} : { globs: [`${component.path.slice(0, -"AGENTS.md".length)}**`] }) }];
      if (component instanceof CodexSkill) {
        const primitive = charter.primitives.find((primitive) => primitive.normId === component.name)!;
        return [{ id: primitive.headers.id, kind: primitive.kind, text: `${component.headers.name}: ${component.headers.description}` }];
      }
      return [];
    }),
    { id: "CHARTER.md", kind: "charter", text: charterMd.projections[0]!.contents },
    ...charter.primitives.filter((primitive) => primitive.supportsAgent("codex")).flatMap((primitive): MainContextText[] => {
      if (primitive.kind === "agent") return [{ id: primitive.headers.id, kind: primitive.kind, text: `${primitive.normId}: ${primitive.description()}` }];
      if (primitive.kind !== "posture") return [];
      return [{ id: primitive.headers.id, kind: primitive.kind, text: compiledDocumentById.get(primitive.headers.id) ?? "" }];
    }),
  ];
}
