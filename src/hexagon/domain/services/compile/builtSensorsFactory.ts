import type { CharterRoot } from "../../models/charter/CharterRoot.js";
import type { Primitive } from "../../models/charter/primitive/Primitive.js";
import { REFERENCE } from "../../models/charter/primitive/BasePrimitive.js";
import { SensorPrimitive } from "../../models/charter/primitive/SensorPrimitive.js";
import type { CompiledPrimitive } from "../../models/output/common/CompiledPrimitive.js";
import type { BuiltSensor } from "../../models/output/common/BuiltSensor.js";

/**
 * Every sensor of the charter, its command as it runs, in order of id (FR-169,
 * FR-179).
 *
 * What runs is handed the command and looks nothing up, so a script named in
 * it is written as the file a build put down, from the repository's root; the
 * charter has refused a script it does not hold (FR-162).
 */
export function builtSensorsOf(
  charter: CharterRoot,
  compiledPrimitiveByPrimitive: ReadonlyMap<Primitive, CompiledPrimitive>,
): readonly BuiltSensor[] {
  return [...charter.primitives]
    .flatMap((primitive) => (primitive.kind === SensorPrimitive.kind ? [primitive] : []))
    .sort((one, another) => (one.headers.id < another.headers.id ? -1 : 1))
    .map(({ headers: { id, signal, run, "agent-provider": agentProviders } }) => ({
      id,
      signal,
      ...(agentProviders === undefined ? {} : { "agent-provider": agentProviders }),
      command: run.replace(REFERENCE, (reference, referencedId: string) => {
        const scriptPrimitive = charter.primitiveById.get(referencedId);
        const executionFile = scriptPrimitive && compiledPrimitiveByPrimitive.get(scriptPrimitive)?.projections.find((projection) => projection.executable)?.file;
        return executionFile ?? reference;
      }),
    }));
}
