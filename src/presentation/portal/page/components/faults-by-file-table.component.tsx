import type { FaultDTOs } from "#module/shared/module.js";
import { Badge } from "./ui/badge.js";
import { Table, TableBody, TableCell, TableRow } from "./ui/table.js";

/** Every fault under the file that has to change, in the words the engine
 *  gave: what is wrong and how to put it right, and whether it is an error or a
 *  warning. A file holding an error comes before one holding only warnings, and
 *  in each file the errors come first, the order `cw doctor` puts them in
 *  (FR-115, FR-121). */
export function FaultsByFileTable({ faultsByFile, label }: { faultsByFile: FaultDTOs.FaultsByFile; label: string }) {
  const hasError = (faults: readonly FaultDTOs.Fault[]) => faults.some(({ data: fault }) => fault.severity === "error");
  const faultEntries = Object.entries(faultsByFile.data.files).sort(
    ([, oneFaults], [, anotherFaults]) => Number(hasError(anotherFaults)) - Number(hasError(oneFaults)),
  );
  return (
    <div className="overflow-hidden rounded-[14px] border bg-background">
      <Table aria-label={label}>
        <TableBody>
          {faultEntries.map(([filePath, faults]) => (
            <TableRow key={filePath} className="border-zinc-100 align-top hover:bg-transparent">
              <TableCell
                className={`w-[210px] py-[11px] pl-4 font-mono text-[11.5px] font-bold whitespace-normal break-all ${hasError(faults) ? "text-destructive" : ""}`}
              >
                {filePath}
              </TableCell>
              <TableCell className="space-y-1.5 py-[11px] pr-4 whitespace-normal">
                {[...faults]
                  .sort(
                    (oneFault, anotherFault) =>
                      Number(anotherFault.data.severity === "error") - Number(oneFault.data.severity === "error"),
                  )
                  .map(({ data: { severity, message, fix } }) => (
                    <p key={message} className="text-xs leading-[1.55] text-zinc-700">
                      {/* Drawn in capitals by the font rather than by the text, so
                          what is read off the page is the severity as it was
                          given. */}
                      <Badge
                        className={`mr-2 rounded-[5px] px-[7px] py-0 align-[1px] text-[11.5px] font-bold tracking-[0.04em] [font-variant-caps:all-small-caps] ${severity === "error" ? "bg-[#fdeef0] text-[#b91c1c]" : "bg-[#fffbeb] text-[#b45309]"}`}
                      >
                        {severity}
                      </Badge>
                      {message} <span className="text-zinc-400">{fix}</span>
                    </p>
                  ))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
