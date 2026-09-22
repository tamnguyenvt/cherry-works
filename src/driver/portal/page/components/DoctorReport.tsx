import { useBuild, useHealth } from "../queries.js";
import type { BuildAnswer } from "./CharterBuild.js";
import { FaultsByFileTable } from "./FaultsByFileTable.js";
import { Button } from "./ui/button.js";

/**
 * The health check, as `cw doctor` gives it (FR-121): the four answers —
 * agents, charter, vendors, compiled output — in the words it prints them in,
 * then every fault under its file, errors before warnings. Nothing is counted
 * or judged here; the engine did both. Where the compiled output is behind, the
 * build is offered from here.
 */
export function DoctorReport({ onBuilt }: { onBuilt: (buildAnswer: BuildAnswer) => void }) {
  const healthQuery = useHealth();
  const buildMutation = useBuild();

  if (healthQuery.data === undefined) return null;
  const { agents, errorCount, warnCount, pendingCount, faultsByFile, driftedVendors, problemCount } = healthQuery.data.data;

  const healthAnswers = [
    [
      "Agents",
      agents.length === 0 ? "none chosen, so only the neutral surface is compiled." : `${agents.join(", ")}.`,
    ],
    [
      "Charter",
      errorCount > 0
        ? `${errorCount} error${errorCount === 1 ? "" : "s"}.`
        : warnCount === 0
          ? "holds."
          : `holds, with ${warnCount} warning${warnCount === 1 ? "" : "s"}.`,
    ],
    [
      "Vendors",
      driftedVendors.length === 0
        ? "none edited here."
        : `edited here: ${driftedVendors.join(", ")}. Run "git checkout" under .cw/vendor/ to undo, or commit what you meant.`,
    ],
    [
      "Built",
      pendingCount === null
        ? "not known, since the charter does not hold."
        : pendingCount === 0
          ? "up to date."
          : `${pendingCount} file${pendingCount === 1 ? "" : "s"} out of date.`,
    ],
  ] as const;

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1 text-sm" aria-label="Health">
        {healthAnswers.map(([question, answer]) => (
          <div key={question} className="contents">
            <dt className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{question}</dt>
            <dd>{answer}</dd>
          </div>
        ))}
      </dl>
      {Object.keys(faultsByFile.data.files).length > 0 && <FaultsByFileTable faultsByFile={faultsByFile} label="Faults" />}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {problemCount === 0 ? "Nothing to fix." : `${problemCount} thing${problemCount === 1 ? "" : "s"} to fix.`}
        </span>
        {pendingCount !== null && pendingCount > 0 && (
          <Button disabled={buildMutation.isPending} onClick={() => buildMutation.mutate(undefined, { onSuccess: onBuilt })}>
            Build
          </Button>
        )}
      </div>
    </div>
  );
}
