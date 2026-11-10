import type { FaultDTOs } from "#module/shared/module.js";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert.js";

/** A fault no file is wrong with — nothing is listed — said as the engine said
 *  it, an internal one in the system's own words (SDK-FR-018). */
export function FaultAlert({ fault }: { fault: FaultDTOs.Fault }) {
  return (
    <Alert variant="destructive" className="rounded-xl border-[#f6d9d9] bg-[#fef6f6]">
      <AlertTitle className="text-[12.5px] font-bold text-foreground">{fault.data.message}</AlertTitle>
      <AlertDescription>{fault.data.fix}</AlertDescription>
    </Alert>
  );
}
