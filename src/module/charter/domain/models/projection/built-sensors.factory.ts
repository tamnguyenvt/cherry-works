import type { CharterRoot } from "../charter/charter-root.js";
import type { Primitive } from "../primitive/primitive.js";
import { BasePrimitive } from "../primitive/base-primitive.js";
import { SensorPrimitive } from "../primitive/sensor-primitive.js";
import type { CompiledPrimitive } from "./compiled-primitive.js";
import { BuiltSensor } from "./built-sensor.js";

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
  ): readonly BuiltSensor[] {
    return [...charter.primitives]
      .flatMap((primitive) => (primitive.kind === SensorPrimitive.kind ? [primitive] : []))
      .sort((leftSensorPrimitive, rightSensorPrimitive) => (leftSensorPrimitive.headers.id < rightSensorPrimitive.headers.id ? -1 : 1))
      .map(({ headers: { id, signal, run, "agent-provider": agentProviders } }) => new BuiltSensor({
        id,
        signal,
        ...(agentProviders === undefined ? {} : { "agent-provider": agentProviders }),
        command: run.replace(BasePrimitive.referencePattern, (reference, referencedId: string) => {
          const scriptPrimitive = charter.primitiveById.get(referencedId);
          const compiledScript = scriptPrimitive && compiledPrimitiveByPrimitive.get(scriptPrimitive);
          const executionFile = compiledScript?.assets.find((asset) => asset.executable)?.file;
          return compiledScript === undefined || executionFile === undefined ? reference : compiledScript.outputPart.linkOf(executionFile);
        }),
      }));
  }

  private constructor() {}
}
