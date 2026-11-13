import {
  CharterMd,
  type CharterOutput,
  type CharterRoot,
  CompiledPrimitive,
  MainContextText,
} from "../../app/port/out/managing-local-agent-output.port.js";
import { resolveLaidText } from "../helper.js";
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
    const charterMd = charterOutput.findCharterOutputItem(CharterMd);
    const compiledPrimitives = charterOutput.charterOutputItems.filter(
      (charterOutputItem): charterOutputItem is CompiledPrimitive => charterOutputItem instanceof CompiledPrimitive,
    );
    const compiledPrimitiveById = new Map(
      compiledPrimitives.map((compiledPrimitive) => [compiledPrimitive.id, compiledPrimitive]),
    );
    return [
      ...CodexComponentFactory.create(charter, charterOutput).flatMap((component): MainContextText[] => {
        if (component instanceof CodexEntryFile)
          return [
            new MainContextText(
              placeOf(component),
              "charter",
              resolveLaidText(component.text, placeOf(component)),
              component.folder === "" ? undefined : [`${component.folder}/**`],
            ),
          ];
        if (component instanceof CodexSkill) {
          const primitive = charter.primitives.find((primitive) => primitive.normId === component.name)!;
          return [
            new MainContextText(
              primitive.headers.id,
              primitive.kind,
              `${component.headers.name}: ${component.headers.description}`,
            ),
          ];
        }
        return [];
      }),
      new MainContextText("CHARTER.md", "charter", charterMd.text),
      ...charter.primitives
        .filter((primitive) => primitive.supportsAgent(CodexComponents.agentProvider))
        .flatMap((primitive): MainContextText[] => {
          if (primitive.kind === "agent")
            return [
              new MainContextText(
                primitive.headers.id,
                primitive.kind,
                `${primitive.normId}: ${primitive.composeDescription()}`,
              ),
            ];
          if (primitive.kind !== "posture") return [];
          return [
            new MainContextText(
              primitive.headers.id,
              primitive.kind,
              compiledPrimitiveById.get(primitive.headers.id)?.text ?? "",
            ),
          ];
        }),
    ];
  }

  private constructor() {}
}
