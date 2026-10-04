import { useBuild, useHealth } from "../queries.js";
import type { BuildAnswer } from "./CharterBuild.js";
import { FaultsByFileTable } from "./FaultsByFileTable.js";
import { Button } from "./ui/button.js";
import { DIALOG_FOOTER } from "../lib/utils.js";

/**
 * The health check, as `cw doctor` gives it (FR-121): the four answers —
 * agents, charter, vendors, compiled output — and what each agent's main
 * context comes to against the ceiling (EVAL-FR-006), in the words it prints
 * them in,
 * then every fault under its file, errors before warnings. Nothing is counted
 * or judged here; the engine did both. Where the compiled output is behind, the
 * build is offered from here.
 */
export function DoctorReport({ onBuilt }: { onBuilt: (buildAnswer: BuildAnswer) => void }) {
  const healthQuery = useHealth();
  const buildMutation = useBuild();

  if (healthQuery.data === undefined) return null;
  const { agents, errorCount, warnCount, pendingCount, faultsByFile, driftedVendors, problemCount, mainContexts, mainContextCeiling } = healthQuery.data.data;

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
    ...mainContexts.map(
      ({ agent, totalTokens }) =>
        [
          "Context",
          `${agent} opens a session with about ${totalTokens.toLocaleString("en-US")} tokens, ${totalTokens > mainContextCeiling ? `past the ceiling of ${mainContextCeiling.toLocaleString("en-US")}. Open Context to see what takes the most.` : `within the ceiling of ${mainContextCeiling.toLocaleString("en-US")}.`}`,
        ] as const,
    ),
  ] as const;

  // The strip is tinted by the worst of what the engine found: red for an
  // error, amber for a warning, green for neither.
  const [stripTint, dotTint] = errorCount > 0 ? ["bg-[#fef6f6]", "bg-[#b91c1c]"] : warnCount > 0 ? ["bg-[#fffbeb]", "bg-[#b45309]"] : ["bg-[#f5fbf7]", "bg-[#16a34a]"];

  return (
    <div className="-mt-[18px] space-y-4">
      <div className={`-mx-5 flex items-center gap-2.5 border-b border-[#f0f0f0] px-4 py-3.5 ${stripTint}`}>
        <i className={`size-2 shrink-0 rounded-full ${dotTint}`} />
        <span className="text-[12.5px] font-bold">
          {problemCount === 0 ? "Nothing to fix." : `${problemCount} thing${problemCount === 1 ? "" : "s"} to fix.`}
        </span>
      </div>
      <dl className="overflow-hidden rounded-[11px] border border-[#f0f0f0]" aria-label="Health">
        {healthAnswers.map(([question, answer]) => (
          <div key={`${question} ${answer}`} className="flex items-baseline gap-3 border-b border-zinc-100 px-[13px] py-2.5 last:border-b-0">
            <dt className="w-[118px] shrink-0 text-[10.5px] font-bold tracking-[0.06em] text-zinc-400 uppercase">{question}</dt>
            <dd className="text-xs">{answer}</dd>
          </div>
        ))}
      </dl>
      {Object.keys(faultsByFile.data.files).length > 0 && <FaultsByFileTable faultsByFile={faultsByFile} label="Faults" />}
      {pendingCount !== null && pendingCount > 0 && (
        <div className={DIALOG_FOOTER}>
          <Button disabled={buildMutation.isPending} onClick={() => buildMutation.mutate(undefined, { onSuccess: onBuilt })}>
            Build
          </Button>
        </div>
      )}
    </div>
  );
}
