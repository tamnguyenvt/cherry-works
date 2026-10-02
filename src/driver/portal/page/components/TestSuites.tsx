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
 * The id an expectation names opens that primitive; one the listing does
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
  const heldIds = new Set(
    primitivesQuery.data?.type === "Primitives" ? primitivesQuery.data.data.primitives.map(({ data }) => data.id) : [],
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
    <div className="space-y-2.5">
      <div
        className={`mb-[18px] flex flex-wrap items-center gap-[11px] rounded-xl border px-[15px] py-[13px] ${
          testRunReport === undefined ? "" : failedCount > 0 ? "border-[#f6d9d9] bg-[#fef6f6]" : "border-[#dcf0e2] bg-[#f5fbf7]"
        }`}
        aria-label="Test summary"
      >
        <span className="text-[12.5px] font-bold">
          {testRunReport === undefined
            ? `${caseCount} case${caseCount === 1 ? "" : "s"} in ${testSuites.length} file${testSuites.length === 1 ? "" : "s"}`
            : `${testRunReport.data.testCaseReports.length - failedCount} of ${testRunReport.data.testCaseReports.length} cases pass`}
        </span>
        <span className="min-w-0 flex-1 text-[11.5px] leading-[1.6] text-zinc-500">
          A case names the file a change touches or the event it raises, then says what must come up. It runs nothing and asks no agent.
        </span>
        <Button variant="outline" disabled={addTestSuite.isPending} onClick={() => void addSuite()}>
          New test file
        </Button>
        <Button disabled={testOutcomeQuery.isFetching} onClick={() => void runAllTests()}>
          Run all tests
        </Button>
      </div>

      {testOutcomeQuery.data?.type === "FaultsByFile" && (
        <FaultsByFileTable faultsByFile={testOutcomeQuery.data} label="Nothing was resolved" />
      )}

      {testSuites.length === 0 && (
        <div className="rounded-xl border border-dashed px-[15px] py-3.5 text-[11.5px] leading-[1.6] text-zinc-500">No test file yet. Test files live in .cw/test/.</div>
      )}

      {testSuites.map(({ data: testSuite }) => {
        const testCaseReports = reportsOf(testSuite.name);
        const failedInSuite = testCaseReports.filter(({ data }) => !data.passed).length;
        return (
          <section key={testSuite.name} className="overflow-hidden rounded-[14px] border bg-background" aria-label={testSuite.name}>
            <div className="flex items-baseline gap-2.5 px-[15px] py-3">
              <button
                className="flex min-w-0 flex-1 cursor-pointer items-baseline gap-2.5 text-left"
                aria-expanded={openedName === testSuite.name}
                onClick={() => setOpenedName(openedName === testSuite.name ? null : testSuite.name)}
              >
                <span className="font-mono text-[11.5px] font-bold">{testSuite.name}</span>
                <span className="min-w-0 flex-1 text-[11.5px] text-zinc-500">{testSuite.description}</span>
                <span className={`font-mono text-[10.5px] ${failedInSuite > 0 ? "text-destructive" : "text-zinc-400"}`}>
                  {testSuite.cases.length} case{testSuite.cases.length === 1 ? "" : "s"}
                  {failedInSuite > 0 && ` · ${failedInSuite} failing`}
                </span>
              </button>
              <Button
                variant="ghost"
                className="h-auto p-0 text-[11.5px] text-zinc-400 hover:bg-transparent hover:text-foreground"
                onClick={() => open("testSuite", { name: testSuite.name })}
              >
                Edit
              </Button>
            </div>
            {testSuite.fault !== undefined && (
              <p className="border-t border-[#f7f7f8] px-[15px] py-2.5 text-[11.5px] text-destructive">
                {testSuite.fault.data.message} <span className="text-zinc-400">{testSuite.fault.data.fix}</span>
              </p>
            )}
            {openedName === testSuite.name &&
              testSuite.cases.map(({ data: testCase }, index) => (
                <TestCaseRow
                  key={index}
                  testCase={testCase}
                  testCaseReport={testCaseReports[index]}
                  isHeld={testCase.id === undefined || heldIds.has(testCase.id)}
                  onOpen={(id) => open("primitive", { id })}
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
  onOpen: (id: string) => void;
}) {
  const unmet = testCaseReport?.data.unmet;
  const { id, expectation } = testCase;
  return (
    <div className={`grid grid-cols-[minmax(150px,1fr)_minmax(0,1.4fr)_auto] items-baseline gap-3 border-t border-[#f7f7f8] px-[15px] py-2.5 ${unmet ? "bg-[#fef6f6]" : ""}`}>
      <span className="font-mono text-[10.5px]">{testCase.situation}</span>
      {unmet !== undefined ? (
        <span className="font-mono text-[10.5px] text-destructive">
          {unmet.data.message} <span className="text-zinc-400">{unmet.data.fix}</span>
        </span>
      ) : (
        <span className="font-mono text-[10.5px] text-zinc-400">
          {id === undefined || !expectation.endsWith(id) ? (
            expectation
          ) : (
            <>
              {expectation.slice(0, -id.length)}
              {isHeld ? (
                <button className="cursor-pointer text-[#1d4ed8] underline underline-offset-2" onClick={() => onOpen(id)}>
                  {id}
                </button>
              ) : (
                <>
                  <span className="underline decoration-dotted underline-offset-2">{id}</span>{" "}
                  <Badge className="rounded-[5px] bg-zinc-100 px-1.5 py-0 font-sans text-[10px] font-normal text-zinc-500">not in the charter</Badge>
                </>
              )}
            </>
          )}
        </span>
      )}
      {/* In capitals by the font, so the word read off the page is the one
          written here. */}
      <Badge
        className={`rounded-[5px] px-[7px] py-0 text-[11.5px] font-bold tracking-[0.04em] [font-variant-caps:all-small-caps] ${
          testCaseReport === undefined ? "bg-zinc-50 text-[#c4c4c8]" : testCaseReport.data.passed ? "bg-[#f0fdf4] text-[#15803d]" : "bg-[#fdeef0] text-[#b91c1c]"
        }`}
      >
        {testCaseReport === undefined ? "not run" : testCaseReport.data.passed ? "pass" : "fail"}
      </Badge>
    </div>
  );
}
