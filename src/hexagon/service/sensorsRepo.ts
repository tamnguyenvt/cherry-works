import { BuiltSensors, type BuiltSensor } from "../domain/models/output/common/BuiltSensor.js";
import { outFolderIn } from "../domain/path.js";
import type { ForReadingFiles } from "../port/zdriven/ForReadingFiles.js";

/**
 * The sensors the last build compiled, as `.cw/out/sensors.json` holds them
 * (CORE-FR-179): never the charter, so a sensor runs as built.
 *
 * No list, or one that does not read, is no sensor: what reads it is a hook,
 * and the host is given that hook only by a build that wrote the list.
 */
export async function loadBuiltSensors(repo: URL, fileReader: ForReadingFiles): Promise<BuiltSensors> {
  const contents = await fileReader.readIfThere(new URL("sensors.json", outFolderIn(repo)));
  try {
    const sensorsJson: unknown = JSON.parse(contents ?? "{}");
    const sensors = (sensorsJson as { sensors?: unknown }).sensors;
    if (Array.isArray(sensors)) return new BuiltSensors(sensors as readonly BuiltSensor[]);
  } catch {
    // Said below, as no list is.
  }
  return new BuiltSensors([]);
}
