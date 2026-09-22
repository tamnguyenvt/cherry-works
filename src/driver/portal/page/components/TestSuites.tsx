import { useState } from "react";
import { toast } from "sonner";
import type { DataDTOs } from "#hexagon/port/driver/dtos/index.js";
import { useAddTestSuite, usePrimitives, useTestOutcome, useTestSuites } from "../queries.js";
import { useDialog } from "./Dialogs.js";
import { FaultsByFileTable } from "./FaultsByFileTable.js";
import { Badge } from "./ui/badge.js";
import { Button } from "./ui/button.js";

/**
 * The test view (FR-124, FR-125): every test file with its description and
 * case count, and, opened, each case's situation and expectation. Run all
 * tests asks the engine how every case came out: a summary of how many of how
 * many pass, each case marked, a failing one saying what came up instead, and
 * the first file holding a failure opened (Story 9 scenarios 1, 2, 8).
 *
 * The identity an expectation names opens that primitive; one the listing does
 * not hold is marked so (scenario 5). Nothing is resolved here: a case's
 * outcome is the engine's, matched to the case by its file and its place in it.
 */
export function TestSuites() {
  const { open } = useDialog();
  const testSuitesQuery = useTestSuites();
  const testOutcomeQuery = useTestOutcome();
  const primitivesQuery = usePrimitives();
  const addTestSuite = useAddTestSuite();
  const [openedName, setOpenedName] = useState<string | null>(null);

  if (testSuitesQuery.data === undefined) return null;
  const { testSuites } = testSuitesQuery.data.data;
  const heldIdentities = new Set(
    primitivesQuery.data?.type === "ScopedPrimitives" ? primitivesQuery.data.data.primitives.map(({ data }) => data.identity) : [],
  );
  const testRunReport = testOutcomeQuery.data?.type === "TestRunReport" ? testOutcomeQuery.data : undefined;
  const reportsOf = (name: string) => testRunReport?.data.testCaseReports.filter(({ data }) => data.suiteName === name) ?? [];
  const caseCount = testSuites.reduce((count, { data }) => count + data.cases.length, 0);
  const failedCount = testRunReport?.data.testCaseReports.filter(({ data }) => !data.passed).length ?? 0;

  const runAllTests = async () => {
    const { data: outcomeDTO } = await testOutcomeQuery.refetch();
    if (outcomeDTO?.type !== "TestRunReport") return;
    const firstFailed = outcomeDTO.data.testCaseReports.find(({ data }) => !data.passed);
    if (firstFailed !== undefined) setOpenedName(firstFailed.data.suiteName);
  };

  const addSuite = async () => {
    const name = await addTestSuite.mutateAsync();
    setOpenedName(name);
    open("testSuite", { name });
    toast("Test file created", { description: `.cw/test/${name} · edit the cases, then run them` });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3" aria-label="Test summary">
        <span className="text-sm font-semibold">
          {testRunReport === undefined
            ? `${caseCount} case${caseCount === 1 ? "" : "s"} in ${testSuites.length} file${testSuites.length === 1 ? "" : "s"}`
            : `${testRunReport.data.testCaseReports.length - failedCount} of ${testRunReport.data.testCaseReports.length} cases pass`}
        </span>
        <span className="min-w-0 flex-1 text-xs text-muted-foreground">
          A case names the file a change touches or the event it raises, then says what must come up. It runs nothing and asks no agent.
        </span>
        <Button size="sm" variant="outline" disabled={addTestSuite.isPending} onClick={() => void addSuite()}>
          New test file
        </Button>
        <Button size="sm" disabled={testOutcomeQuery.isFetching} onClick={() => void runAllTests()}>
          Run all tests
        </Button>
      </div>

      {testOutcomeQuery.data?.type === "FaultsByFile" && (
        <FaultsByFileTable faultsByFile={testOutcomeQuery.data} label="Nothing was resolved" />
      )}

      {testSuites.length === 0 && (
        <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">No test file yet. Test files live in .cw/test/.</div>
      )}

      {testSuites.map(({ data: testSuite }) => {
        const testCaseReports = reportsOf(testSuite.name);
        const failedInSuite = testCaseReports.filter(({ data }) => !data.passed).length;
        return (
          <section key={testSuite.name} className="rounded-lg border" aria-label={testSuite.name}>
            <div className="flex items-baseline gap-3 px-4 py-3">
              <button
                className="flex min-w-0 flex-1 items-baseline gap-3 text-left"
                aria-expanded={openedName === testSuite.name}
                onClick={() => setOpenedName(openedName === testSuite.name ? null : testSuite.name)}
              >
                <span className="font-mono text-xs font-semibold">{testSuite.name}</span>
                <span className="min-w-0 flex-1 text-xs text-muted-foreground">{testSuite.description}</span>
                <span className={`font-mono text-xs ${failedInSuite > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                  {testSuite.cases.length} case{testSuite.cases.length === 1 ? "" : "s"}
                  {failedInSuite > 0 && ` · ${failedInSuite} failing`}
                </span>
              </button>
              <Button size="sm" variant="ghost" onClick={() => open("testSuite", { name: testSuite.name })}>
                Edit
              </Button>
            </div>
            {testSuite.fault !== undefined && (
              <p className="border-t px-4 py-2.5 text-xs text-destructive">
                {testSuite.fault.data.message} <span className="text-muted-foreground">{testSuite.fault.data.fix}</span>
              </p>
            )}
            {openedName === testSuite.name &&
              testSuite.cases.map(({ data: testCase }, index) => (
                <TestCaseRow
                  key={index}
                  testCase={testCase}
                  testCaseReport={testCaseReports[index]}
                  isHeld={testCase.identity === undefined || heldIdentities.has(testCase.identity)}
                  onOpen={(identity) => open("primitive", { identity })}
                />
              ))}
          </section>
        );
      })}
    </div>
  );
}

/** One case: its situation, its expectation — or, where it failed, what came
 *  up instead — and pass, fail or not run. */
function TestCaseRow({
  testCase,
  testCaseReport,
  isHeld,
  onOpen,
}: {
  testCase: DataDTOs.TestCase["data"];
  testCaseReport: DataDTOs.TestCaseReport | undefined;
  isHeld: boolean;
  onOpen: (identity: string) => void;
}) {
  const unmet = testCaseReport?.data.unmet;
  const { identity, expectation } = testCase;
  return (
    <div className={`grid grid-cols-[minmax(10rem,1fr)_minmax(0,1.4fr)_auto] items-baseline gap-3 border-t px-4 py-2.5 ${unmet ? "bg-destructive/5" : ""}`}>
      <span className="font-mono text-xs">{testCase.situation}</span>
      {unmet !== undefined ? (
        <span className="text-xs text-destructive">
          {unmet.data.message} <span className="text-muted-foreground">{unmet.data.fix}</span>
        </span>
      ) : (
        <span className="font-mono text-xs text-muted-foreground">
          {identity === undefined || !expectation.endsWith(identity) ? (
            expectation
          ) : (
            <>
              {expectation.slice(0, -identity.length)}
              {isHeld ? (
                <button className="underline underline-offset-2" onClick={() => onOpen(identity)}>
                  {identity}
                </button>
              ) : (
                <>
                  {identity} <Badge variant="secondary">not in the charter</Badge>
                </>
              )}
            </>
          )}
        </span>
      )}
      <Badge variant={testCaseReport === undefined ? "outline" : testCaseReport.data.passed ? "secondary" : "destructive"}>
        {testCaseReport === undefined ? "not run" : testCaseReport.data.passed ? "pass" : "fail"}
      </Badge>
    </div>
  );
}
