import type { DataDTOs } from "#hexagon/port/driver/dtos/index.js";
import { Badge } from "./ui/badge.js";
import { Table, TableBody, TableCell, TableRow } from "./ui/table.js";

/** Every fault under the file that has to change, in the words the engine
 *  gave: what is wrong and how to put it right, and whether it is an error or a
 *  warning. A file holding an error comes before one holding only warnings, and
 *  in each file the errors come first, the order `cw doctor` puts them in
 *  (FR-115, FR-121). */
export function FaultsByFileTable({ faultsByFile, label }: { faultsByFile: DataDTOs.FaultsByFile; label: string }) {
  const hasError = (faults: readonly DataDTOs.Fault[]) => faults.some(({ data }) => data.severity === "error");
  const files = Object.entries(faultsByFile.data.files).sort(([, one], [, another]) => Number(hasError(another)) - Number(hasError(one)));
  return (
    <Table aria-label={label}>
      <TableBody>
        {files.map(([file, faults]) => (
          <TableRow key={file}>
            <TableCell className={`align-top font-mono text-xs font-semibold ${hasError(faults) ? "text-destructive" : ""}`}>{file}</TableCell>
            <TableCell className="whitespace-normal">
              {[...faults]
                .sort((one, another) => Number(another.data.severity === "error") - Number(one.data.severity === "error"))
                .map(({ data: { severity, message, fix } }) => (
                  <p key={message}>
                    <Badge variant={severity === "error" ? "destructive" : "secondary"} className="mr-2">
                      {severity}
                    </Badge>
                    {message} <span className="text-muted-foreground">{fix}</span>
                  </p>
                ))}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
