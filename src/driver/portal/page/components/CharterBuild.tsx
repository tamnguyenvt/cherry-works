import type { DataDTOs } from "#hexagon/port/driver/dtos/index.js";
import { useBuild, useBuildPreview } from "../queries.js";
import { FaultsByFileTable } from "./FaultsByFileTable.js";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert.js";
import { Button } from "./ui/button.js";
import { Table, TableBody, TableCell, TableRow } from "./ui/table.js";

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
    <div className="space-y-4">
      <p className="text-sm" aria-label="Plan counts">
        {planTargets.length} file{planTargets.length === 1 ? "" : "s"}: {added.length} create, {edited.length} update, {deleted.length} delete,{" "}
        {unchanged.length} unchanged.
      </p>
      <Table aria-label="Build plan">
        <TableBody>
          {planTargets.map(([change, path]) => (
            <TableRow key={path}>
              <TableCell className="w-24 text-xs font-semibold uppercase text-muted-foreground">{change}</TableCell>
              <TableCell className="font-mono text-xs">{path}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex justify-end">
        <Button disabled={buildMutation.isPending} onClick={() => buildMutation.mutate(undefined, { onSuccess: onBuilt })}>
          Build for real
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
    <div className="space-y-4">
      <p className="text-sm" aria-label="Build counts">
        Built {writtenPaths.length} file{writtenPaths.length === 1 ? "" : "s"}: {added.length} added, {edited.length} changed, {deleted.length} deleted.
      </p>
      <Table aria-label="Build written">
        <TableBody>
          {[...writtenPaths.map((path) => ["wrote", path] as const), ...deleted.map((path) => ["deleted", path] as const)].map(([pathChange, path]) => (
            <TableRow key={path}>
              <TableCell className="w-24 text-xs font-semibold uppercase text-muted-foreground">{pathChange}</TableCell>
              <TableCell className="font-mono text-xs">{path}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** A charter with an error: nothing was built or previewed, and the faults
 *  under each file are why (FR-120). */
function BuildRefused({ faultsByFile }: { faultsByFile: DataDTOs.FaultsByFile }) {
  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <AlertTitle>Nothing was written</AlertTitle>
        <AlertDescription>The charter has errors, so there is no build until they are fixed.</AlertDescription>
      </Alert>
      <FaultsByFileTable faultsByFile={faultsByFile} label="Refused files" />
    </div>
  );
}
