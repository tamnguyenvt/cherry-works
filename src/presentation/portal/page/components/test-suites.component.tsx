import { useState } from "react";
import { toast } from "sonner";
import type { CharterDTOs } from "#module/charter/module.js";
import { useAddTestSuite, useCharters, usePrimitives, useTestOutcome, useTestSuites } from "../portal.queries.js";
import { useDialog } from "./dialogs.component.js";
import { FaultAlert } from "./fault-alert.component.js";
import { FaultsByFileTable } from "./faults-by-file-table.component.js";
import { Badge } from "./ui/badge.js";
import { Button } from "./ui/button.js";
import { Input } from "./ui/input.js";

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
  const { openDialog } = useDialog();
  const testSuitesQuery = useTestSuites();
  const testOutcomeQuery = useTestOutcome();
  const primitivesQuery = usePrimitives();
  const addTestSuiteMutation = useAddTestSuite();
  const chartersQuery = useCharters();
  const [openedTestSuiteName, setOpenedTestSuiteName] = useState<string | null>(null);
  const [charterName, setCharterName] = useState<string | undefined>(undefined);

  if (testSuitesQuery.data === undefined) return null;
  if (testSuitesQuery.data.type === "Fault") return <FaultAlert fault={testSuitesQuery.data} />;
  const { testSuites } = testSuitesQuery.data.data;
  const heldIds = new Set(
    primitivesQuery.data?.type === "Primitives"
      ? primitivesQuery.data.data.primitives.map(({ data: primitive }) => primitive.id)
      : [],
  );
  const testRunReport = testOutcomeQuery.data?.type === "TestRunReport" ? testOutcomeQuery.data : undefined;
  const caseCount = testSuites.reduce((count, { data: listedSuite }) => count + listedSuite.cases.length, 0);
  // A new file is written into a charter the repository authored, the first
  // offered until another is typed (VENDOR-FR-009, VENDOR-FR-016).
  const authoredCharterNames =
    chartersQuery.data?.type === "CharterMetadataList"
      ? chartersQuery.data.data.charters
          .filter(({ data: charter }) => !charter.isInstalled)
          .map(({ data: charter }) => charter.name)
      : [];
  const shownCharterName = charterName ?? authoredCharterNames[0] ?? "";
  const failedCount =
    testRunReport?.data.testCaseReports.filter(({ data: testCaseReport }) => !testCaseReport.passed).length ?? 0;

  const runAllTests = async () => {
    const { data: outcomeDTO } = await testOutcomeQuery.refetch();
    if (outcomeDTO?.type !== "TestRunReport") return;
    const firstFailedTestCaseReport = outcomeDTO.data.testCaseReports.find(
      ({ data: testCaseReport }) => !testCaseReport.passed,
    );
    if (firstFailedTestCaseReport !== undefined) setOpenedTestSuiteName(firstFailedTestCaseReport.data.suiteName);
  };

  const addSuite = async () => {
    const testSuiteNameDTO = await addTestSuiteMutation.mutateAsync(shownCharterName.trim());
    if (testSuiteNameDTO.type === "Fault")
      return void toast.error(testSuiteNameDTO.data.message, { description: testSuiteNameDTO.data.fix });
    const { charterName, name: testSuiteName } = testSuiteNameDTO.data;
    setOpenedTestSuiteName(`${charterName}/${testSuiteName}`);
    openDialog("testSuite", { charterName, name: testSuiteName });
    toast("Test file created", {
      description: `.cw/charter/${charterName}/test/${testSuiteName} · edit the cases, then run them`,
    });
  };

  return (
    <div className="space-y-2.5">
      <div
        className={`mb-[18px] flex flex-wrap items-center gap-[11px] rounded-xl border px-[15px] py-[13px] ${
          testRunReport === undefined
            ? ""
            : failedCount > 0
              ? "border-[#f6d9d9] bg-[#fef6f6]"
              : "border-[#dcf0e2] bg-[#f5fbf7]"
        }`}
        aria-label="Test summary"
      >
        <span className="text-[12.5px] font-bold">
          {testRunReport === undefined
            ? `${caseCount} case${caseCount === 1 ? "" : "s"} in ${testSuites.length} file${testSuites.length === 1 ? "" : "s"}`
            : `${testRunReport.data.testCaseReports.length - failedCount} of ${testRunReport.data.testCaseReports.length} cases pass`}
        </span>
        <span className="min-w-0 flex-1 text-[11.5px] leading-[1.6] text-zinc-500">
          A case names the file a change touches or the event it raises, then says what must come up. It runs nothing
          and asks no agent.
        </span>
        <Input
          aria-label="Charter of a new test file"
          className="w-[160px]"
          value={shownCharterName}
          placeholder="team"
          spellCheck={false}
          autoComplete="off"
          list="test-suite-charter-names"
          onChange={(event) => setCharterName(event.currentTarget.value)}
        />
        <datalist id="test-suite-charter-names">
          {authoredCharterNames.map((authoredCharterName) => (
            <option key={authoredCharterName} value={authoredCharterName} />
          ))}
        </datalist>
        <Button variant="outline" disabled={addTestSuiteMutation.isPending} onClick={() => void addSuite()}>
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
        <div className="rounded-xl border border-dashed px-[15px] py-3.5 text-[11.5px] leading-[1.6] text-zinc-500">
          No test file yet. Test files live in .cw/charter/&lt;charter&gt;/test/.
        </div>
      )}

      {testSuites.map(({ data: testSuite }) => {
        // A file is known by its charter and its name in it, as the run reports
        // it (VENDOR-FR-009).
        const testSuitePath = `${testSuite.charterName}/${testSuite.name}`;
        const testCaseReports =
          testRunReport?.data.testCaseReports.filter(
            ({ data: testCaseReport }) => testCaseReport.suiteName === testSuitePath,
          ) ?? [];
        const suiteFailedCount = testCaseReports.filter(({ data: testCaseReport }) => !testCaseReport.passed).length;
        return (
          <section
            key={testSuitePath}
            className="overflow-hidden rounded-[14px] border bg-background"
            aria-label={testSuitePath}
          >
            <div className="flex items-baseline gap-2.5 px-[15px] py-3">
              <button
                type="button"
                className="flex min-w-0 flex-1 cursor-pointer items-baseline gap-2.5 text-left"
                aria-expanded={openedTestSuiteName === testSuitePath}
                onClick={() => setOpenedTestSuiteName(openedTestSuiteName === testSuitePath ? null : testSuitePath)}
              >
                <span className="font-mono text-[11.5px] font-bold">{testSuitePath}</span>
                <span className="min-w-0 flex-1 text-[11.5px] text-zinc-500">{testSuite.description}</span>
                <span
                  className={`font-mono text-[10.5px] ${suiteFailedCount > 0 ? "text-destructive" : "text-zinc-400"}`}
                >
                  {testSuite.cases.length} case{testSuite.cases.length === 1 ? "" : "s"}
                  {suiteFailedCount > 0 && ` · ${suiteFailedCount} failing`}
                </span>
              </button>
              <Button
                variant="ghost"
                className="h-auto p-0 text-[11.5px] text-zinc-400 hover:bg-transparent hover:text-foreground"
                onClick={() => openDialog("testSuite", { charterName: testSuite.charterName, name: testSuite.name })}
              >
                Edit
              </Button>
            </div>
            {testSuite.fault !== undefined && (
              <p className="border-t border-[#f7f7f8] px-[15px] py-2.5 text-[11.5px] text-destructive">
                {testSuite.fault.data.message} <span className="text-zinc-400">{testSuite.fault.data.fix}</span>
              </p>
            )}
            {openedTestSuiteName === testSuitePath &&
              testSuite.cases.map(({ data: testCase }, caseIndex) => (
                <TestCaseRow
                  // biome-ignore lint/suspicious/noArrayIndexKey: a case has no identity but its place in the file.
                  key={caseIndex}
                  testCase={testCase}
                  testCaseReport={testCaseReports[caseIndex]}
                  isHeld={testCase.id === undefined || heldIds.has(testCase.id)}
                  onOpen={(id) => openDialog("primitive", { id })}
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
  testCase: CharterDTOs.TestCase["data"];
  testCaseReport: CharterDTOs.TestCaseReport | undefined;
  isHeld: boolean;
  onOpen: (id: string) => void;
}) {
  const unmetExpectation = testCaseReport?.data.unmet;
  const { id, expectation } = testCase;
  return (
    <div
      className={`grid grid-cols-[minmax(150px,1fr)_minmax(0,1.4fr)_auto] items-baseline gap-3 border-t border-[#f7f7f8] px-[15px] py-2.5 ${unmetExpectation ? "bg-[#fef6f6]" : ""}`}
    >
      <span className="font-mono text-[10.5px]">{testCase.situation}</span>
      {unmetExpectation !== undefined ? (
        <span className="font-mono text-[10.5px] text-destructive">
          {unmetExpectation.data.message} <span className="text-zinc-400">{unmetExpectation.data.fix}</span>
        </span>
      ) : (
        <span className="font-mono text-[10.5px] text-zinc-400">
          {id === undefined || !expectation.endsWith(id) ? (
            expectation
          ) : (
            <>
              {expectation.slice(0, -id.length)}
              {isHeld ? (
                <button
                  type="button"
                  className="cursor-pointer text-[#1d4ed8] underline underline-offset-2"
                  onClick={() => onOpen(id)}
                >
                  {id}
                </button>
              ) : (
                <>
                  <span className="underline decoration-dotted underline-offset-2">{id}</span>{" "}
                  <Badge className="rounded-[5px] bg-zinc-100 px-1.5 py-0 font-sans text-[10px] font-normal text-zinc-500">
                    not in the charter
                  </Badge>
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
          testCaseReport === undefined
            ? "bg-zinc-50 text-[#c4c4c8]"
            : testCaseReport.data.passed
              ? "bg-[#f0fdf4] text-[#15803d]"
              : "bg-[#fdeef0] text-[#b91c1c]"
        }`}
      >
        {testCaseReport === undefined ? "not run" : testCaseReport.data.passed ? "pass" : "fail"}
      </Badge>
    </div>
  );
}
