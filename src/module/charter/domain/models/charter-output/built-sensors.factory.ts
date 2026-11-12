import { AgentProvider, type AgentProviderName } from "#module/shared/module.js";
import { outputPath } from "../../constants.js";
import type { CharterRoot } from "../charter/charter-root.js";
import { BasePrimitive } from "../primitive/base-primitive.js";
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
    charter: CharterRoot,
    compiledPrimitiveByPrimitive: ReadonlyMap<Primitive, CompiledPrimitive>,
  ): BuiltSensors {
    return new BuiltSensors(
      [...charter.primitives]
        .flatMap((primitive) => (primitive.kind === SensorPrimitive.kind ? [primitive] : []))
        .sort((leftSensorPrimitive, rightSensorPrimitive) =>
          leftSensorPrimitive.headers.id < rightSensorPrimitive.headers.id ? -1 : 1,
        )
        .map(
          ({ headers: { id, signal, run: sensorRun, "agent-provider": agentProviders } }) =>
            new BuiltSensor({
              id,
              signal,
              ...(agentProviders === undefined
                ? {}
                : { "agent-provider": agentProviders.map((agentName) => new AgentProvider(agentName)) }),
              command: sensorRun.replace(BasePrimitive.referencePattern, (reference, referencedId: string) => {
                const scriptPrimitive = charter.primitiveById.get(referencedId);
                const compiledScript = scriptPrimitive && compiledPrimitiveByPrimitive.get(scriptPrimitive);
                const executionFile = compiledScript?.assets.find((asset) => asset.isExecutable)?.assetPath;
                return compiledScript === undefined || executionFile === undefined
                  ? reference
                  : outputPath.getLink(compiledScript, executionFile);
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
            ({ "agent-provider": agentProviders, ...builtSensor }) =>
              new BuiltSensor({
                ...builtSensor,
                ...(agentProviders === undefined
                  ? {}
                  : { "agent-provider": agentProviders.map((agentName) => new AgentProvider(agentName)) }),
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
