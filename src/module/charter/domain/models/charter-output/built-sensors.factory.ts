import { AgentProvider, type AgentProviderName } from "#module/shared/module.js";
import { outputPath } from "../../constants.js";
import { PrimitiveHelper } from "../../helper.js";
import type { CharterRoot } from "../charter/charter-root.js";
import type { Primitive } from "../primitive/primitive.js";
import { SensorPrimitive } from "../primitive/sensor-primitive.js";
import { BuiltSensor, BuiltSensors } from "./built-sensor.js";
import type { CompiledPrimitive } from "./compiled-primitive.js";

/** Makes the sensors a build lists. */
export class BuiltSensorsFactory {
  /**
   * Every sensor of the charter, its command as it runs, in order of id (FR-169,
   * FR-179).
   *
   * What runs is handed the command and looks nothing up, so a script named in
   * it is written as a link, under `$CW_OUT/`, to the file it runs
   * beside its compiled document; the charter has refused a script it does not
   * hold (FR-162).
   */
  static create(
    charterRoot: CharterRoot,
    compiledPrimitiveByPrimitive: ReadonlyMap<Primitive, CompiledPrimitive>,
  ): BuiltSensors {
    return new BuiltSensors(
      [...charterRoot.primitives]
        .flatMap((primitive) => (primitive.kind === SensorPrimitive.kind ? [primitive] : []))
        .sort((leftSensorPrimitive, rightSensorPrimitive) =>
          leftSensorPrimitive.headers.id < rightSensorPrimitive.headers.id ? -1 : 1,
        )
        .map(
          ({ headers: { id, signal, run: sensorRun, "agent-provider": agentProviderNames } }) =>
            new BuiltSensor({
              id,
              signal,
              ...(agentProviderNames === undefined
                ? {}
                : {
                    "agent-provider": agentProviderNames.map(
                      (agentProviderName) => new AgentProvider(agentProviderName),
                    ),
                  }),
              command: PrimitiveHelper.rewriteReferences(sensorRun, (reference, referencedId) => {
                const scriptPrimitive = charterRoot.primitiveById.get(referencedId);
                const compiledScriptPrimitive = scriptPrimitive && compiledPrimitiveByPrimitive.get(scriptPrimitive);
                const executionFilePath = compiledScriptPrimitive?.assets.find(
                  (asset) => asset.isExecutable,
                )?.assetPath;
                return compiledScriptPrimitive === undefined || executionFilePath === undefined
                  ? reference
                  : outputPath.getLink(compiledScriptPrimitive, executionFilePath);
              }),
            }),
        ),
    );
  }

  /**
   * The sensors the last build compiled, from the text it kept (CORE-FR-179):
   * never the charter, so a sensor runs as built.
   *
   * No list, or one that does not read, is no sensor: what reads it is a hook,
   * and the agent is given that hook only by a build that wrote the list.
   */
  static createFromBuiltText(sensorsText: string | undefined): BuiltSensors {
    try {
      const sensorsJson: unknown = JSON.parse(sensorsText ?? "{}");
      const sensors = (sensorsJson as { sensors?: unknown }).sensors;
      if (Array.isArray(sensors))
        return new BuiltSensors(
          (
            sensors as readonly (Omit<BuiltSensor, "agent-provider"> & {
              readonly "agent-provider"?: readonly AgentProviderName[];
            })[]
          ).map(
            ({ "agent-provider": agentProviderNames, ...builtSensor }) =>
              new BuiltSensor({
                ...builtSensor,
                ...(agentProviderNames === undefined
                  ? {}
                  : {
                      "agent-provider": agentProviderNames.map(
                        (agentProviderName) => new AgentProvider(agentProviderName),
                      ),
                    }),
              }),
          ),
        );
    } catch {
      // Said below, as no list is.
    }
    return new BuiltSensors([]);
  }

  private constructor() {}
}
