import type {
  CharterOutput,
  CharterRoot,
  MainContextText,
} from "../../app/port/out/managing-local-agent-output.port.js";
import { laidTextOf } from "../helper.js";
import { CodexComponentFactory } from "./codex-component.factory.js";
import { CodexComponents } from "./codex-component.js";
import { CodexEntryFile } from "./codex-entry-file.js";
import { CodexSkill } from "./codex-skill.js";

/** Makes what Codex's main context holds of a charter. */
export class CodexMainContextFactory {
  /** Estimate charter instructions and discovered skills, excluding Codex's own
   * system prompt, each entry file laid at `placeOf` it. Scoped guide bodies
   * are charged only when their globs apply. */
  static create(
    charter: CharterRoot,
    charterOutput: CharterOutput,
    placeOf: (codexEntryFile: CodexEntryFile) => string,
  ): readonly MainContextText[] {
    const { charterMd, compiledPrimitives } = charterOutput;
    const compiledPrimitiveById = new Map(
      compiledPrimitives.map((compiledPrimitive) => [compiledPrimitive.id, compiledPrimitive]),
    );
    return [
      ...CodexComponentFactory.create(charter, charterOutput).flatMap((component): MainContextText[] => {
        if (component instanceof CodexEntryFile)
          return [
            {
              id: placeOf(component),
              kind: "charter",
              text: laidTextOf(component.text, placeOf(component)),
              ...(component.folder === "" ? {} : { globs: [`${component.folder}/**`] }),
            },
          ];
        if (component instanceof CodexSkill) {
          const primitive = charter.primitives.find((primitive) => primitive.normId === component.name)!;
          return [
            {
              id: primitive.headers.id,
              kind: primitive.kind,
              text: `${component.headers.name}: ${component.headers.description}`,
            },
          ];
        }
        return [];
      }),
      { id: "CHARTER.md", kind: "charter", text: charterMd.text },
      ...charter.primitives
        .filter((primitive) => primitive.supportsAgent(CodexComponents.agentProvider))
        .flatMap((primitive): MainContextText[] => {
          if (primitive.kind === "agent")
            return [
              {
                id: primitive.headers.id,
                kind: primitive.kind,
                text: `${primitive.normId}: ${primitive.description()}`,
              },
            ];
          if (primitive.kind !== "posture") return [];
          return [
            {
              id: primitive.headers.id,
              kind: primitive.kind,
              text: compiledPrimitiveById.get(primitive.headers.id)?.text ?? "",
            },
          ];
        }),
    ];
  }

  private constructor() {}
}
