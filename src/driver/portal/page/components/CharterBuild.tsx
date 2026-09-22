import type { DataDTOs } from "#hexagon/port/driver/dtos/index.js";
import { useBuild, useBuildPreview } from "../queries.js";
import { FaultsByFileTable } from "./FaultsByFileTable.js";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert.js";
import { Button } from "./ui/button.js";
import { Table, TableBody, TableCell, TableRow } from "./ui/table.js";
import { DIALOG_FOOTER } from "../lib/utils.js";

/** What a build answered: what it wrote and deleted, or the faults that
 *  refused it. */
export type BuildAnswer = DataDTOs.PlanSummary | DataDTOs.FaultsByFile;

/**
 * What a build would do, asked of the engine and written nowhere (FR-120):
 * every target under create, update, delete or unchanged, how many of each —
 * the listing `cw build --preview` prints — and the build itself, from here.
 * A charter with an error previews nothing, and its faults are shown instead.
 */
export function BuildPreview({ onBuilt }: { onBuilt: (buildAnswer: BuildAnswer) => void }) {
  const previewQuery = useBuildPreview();
  const buildMutation = useBuild();

  if (previewQuery.data === undefined) return null;
  const planSummaryDTO = previewQuery.data;
  if (planSummaryDTO.type === "FaultsByFile") return <BuildRefused faultsByFile={planSummaryDTO} />;

  const { added, edited, deleted, unchanged } = planSummaryDTO.data;
  const planTargets = [
    ...added.map((path) => ["create", path] as const),
    ...edited.map((path) => ["update", path] as const),
    ...deleted.map((path) => ["delete", path] as const),
    ...unchanged.map((path) => ["unchanged", path] as const),
  ];

  return (
    <div className="-mt-[18px]">
      <div className="-mx-5 flex items-center gap-2.5 border-b border-[#f0f0f0] bg-[#f5f8ff] px-4 py-3.5">
        <i className="size-2 shrink-0 rounded-full bg-[#1d4ed8]" />
        <span className="text-[12.5px] font-bold">Nothing was written</span>
        <p className="min-w-0 text-[11.5px] leading-normal text-zinc-500" aria-label="Plan counts">
          {planTargets.length} file{planTargets.length === 1 ? "" : "s"}: {added.length} create, {edited.length} update, {deleted.length} delete,{" "}
          {unchanged.length} unchanged.
        </p>
      </div>
      <div className="-mx-5">
        <Table aria-label="Build plan">
          <TableBody>
            {planTargets.map(([change, path]) => (
              <PathRow key={path} pathChange={change} path={path} />
            ))}
          </TableBody>
        </Table>
      </div>
      <div className={DIALOG_FOOTER}>
        <Button disabled={buildMutation.isPending} onClick={() => buildMutation.mutate(undefined, { onSuccess: onBuilt })}>
          Build
        </Button>
      </div>
    </div>
  );
}

/** What a build did: how many files it wrote, and each one it deleted (FR-120);
 *  or, where the charter has an error, that nothing was written and why. */
export function BuildOutcome({ buildAnswer }: { buildAnswer: BuildAnswer }) {
  if (buildAnswer.type === "FaultsByFile") return <BuildRefused faultsByFile={buildAnswer} />;

  const { added, edited, deleted } = buildAnswer.data;
  const writtenPaths = [...added, ...edited];
  return (
    <div className="-mt-[18px] -mb-[18px]">
      <div className="-mx-5 flex items-center gap-2.5 border-b border-[#f0f0f0] bg-[#f5fbf7] px-4 py-3.5">
        <i className="size-2 shrink-0 rounded-full bg-[#16a34a]" />
        <p className="text-[12.5px] font-bold" aria-label="Build counts">
          Built {writtenPaths.length} file{writtenPaths.length === 1 ? "" : "s"}: {added.length} added, {edited.length} changed, {deleted.length} deleted.
        </p>
      </div>
      <div className="-mx-5">
        <Table aria-label="Build written">
          <TableBody>
            {[...writtenPaths.map((path) => ["wrote", path] as const), ...deleted.map((path) => ["deleted", path] as const)].map(([pathChange, path]) => (
              <PathRow key={path} pathChange={pathChange} path={path} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/** The colours a change to a path is tagged in: what is written anew in
 *  green, what is written over in blue, what goes in red, the rest grey. */
const PATH_CHANGE_COLORS: Record<string, string> = {
  create: "bg-[#f0fdf4] text-[#15803d]",
  wrote: "bg-[#f0fdf4] text-[#15803d]",
  update: "bg-[#eff6ff] text-[#1d4ed8]",
  delete: "bg-[#fdeef0] text-[#b91c1c]",
  deleted: "bg-[#fdeef0] text-[#b91c1c]",
  unchanged: "bg-zinc-50 text-zinc-400",
};

/** One path a build writes, deletes or leaves, a row of the list the build
 *  dialog draws from edge to edge. */
function PathRow({ pathChange, path }: { pathChange: string; path: string }) {
  return (
    <TableRow className="border-zinc-100 hover:bg-transparent">
      <TableCell className="w-28 py-[11px] pl-4">
        <span className={`rounded-[5px] px-[7px] py-0.5 text-[9.5px] font-bold tracking-[0.04em] uppercase ${PATH_CHANGE_COLORS[pathChange]}`}>{pathChange}</span>
      </TableCell>
      <TableCell className="py-[11px] pr-4 font-mono text-[11.5px] font-bold">{path}</TableCell>
    </TableRow>
  );
}

/** A charter with an error: nothing was built or previewed, and the faults
 *  under each file are why (FR-120). */
function BuildRefused({ faultsByFile }: { faultsByFile: DataDTOs.FaultsByFile }) {
  return (
    <div className="space-y-3.5">
      <Alert variant="destructive" className="rounded-xl border-[#f6d9d9] bg-[#fef6f6]">
        <AlertTitle className="text-[12.5px] font-bold text-foreground">Nothing was written</AlertTitle>
        <AlertDescription>The charter has errors, so there is no build until they are fixed.</AlertDescription>
      </Alert>
      <FaultsByFileTable faultsByFile={faultsByFile} label="Refused files" />
    </div>
  );
}
