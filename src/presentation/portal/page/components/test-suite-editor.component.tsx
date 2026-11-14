import { useState } from "react";
import type { FaultDTOs } from "#module/shared/module.js";
import { useRemoveTestSuite, useTestSuites, useWriteTestSuite } from "../portal.queries.js";
import { DIALOG_FOOTER_CLASS_NAME } from "./dialog-footer.constants.js";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert.js";
import { Button } from "./ui/button.js";

/**
 * One test file's text, to correct and save, or to delete (FR-090, FR-092).
 * Text that is not a suite stays here with the engine's refusal and its sample
 * of one that reads, and nothing is written (Story 9 scenarios 3, 4, 7).
 */
export function TestSuiteEditor({
  testSuiteName,
  onDone,
  onClose,
}: {
  testSuiteName: string;
  onDone: (doneText: string, detailText: string) => void;
  onClose: () => void;
}) {
  const testSuitesQuery = useTestSuites();
  const testSuite =
    testSuitesQuery.data?.type === "TestSuites"
      ? testSuitesQuery.data.data.testSuites.find(({ data: listedSuite }) => listedSuite.name === testSuiteName)
      : undefined;
  // The text is read once, when the file is first in the listing: a listing
  // asked again while it is being edited does not write over what was typed. A
  // file that does not read has none to show, and opens empty.
  if (testSuite === undefined) return null;
  return (
    <TestSuiteText
      key={testSuiteName}
      testSuiteName={testSuiteName}
      initialText={testSuite.data.text ?? ""}
      onDone={onDone}
      onClose={onClose}
    />
  );
}

function TestSuiteText({
  testSuiteName,
  initialText,
  onDone,
  onClose,
}: {
  testSuiteName: string;
  initialText: string;
  onDone: (doneText: string, detailText: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [refusalFault, setRefusalFault] = useState<FaultDTOs.Fault | null>(null);
  const writeTestSuiteMutation = useWriteTestSuite();
  const removeTestSuiteMutation = useRemoveTestSuite();

  const saveText = async () => {
    const testSuiteNameDTO = await writeTestSuiteMutation.mutateAsync({ name: testSuiteName, text });
    if (testSuiteNameDTO.type === "Fault") return setRefusalFault(testSuiteNameDTO);
    onDone("Saved", `.cw/charter/test/${testSuiteName} rewritten · run the cases again`);
  };

  const deleteFile = async () => {
    const refusedDTO = await removeTestSuiteMutation.mutateAsync(testSuiteName);
    if (refusedDTO !== null) return setRefusalFault(refusedDTO);
    onDone("Test file deleted", `.cw/charter/test/${testSuiteName} removed`);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs leading-[1.65] text-zinc-600 [&_code]:font-mono">
        A case is one situation — a touched file (<code>do.touchFile</code>) or a raised event (<code>when</code>) — and
        expects one thing: <code>activate</code>, <code>run</code> or <code>allow</code>.
      </p>
      <textarea
        aria-label="Test file text"
        className="h-[340px] w-full resize-y rounded-[11px] border bg-zinc-50 px-3.5 py-3 font-mono text-[11.5px] leading-[1.65] outline-none"
        spellCheck={false}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      {refusalFault !== null && (
        <Alert variant="destructive" className="rounded-xl border-[#f6d9d9] bg-[#fef6f6]">
          <AlertTitle className="text-[12.5px] font-bold text-foreground">Refused, and nothing was written</AlertTitle>
          <AlertDescription>
            <p className="break-words whitespace-pre-line">
              {refusalFault.data.message} <span className="text-muted-foreground">{refusalFault.data.fix}</span>
            </p>
          </AlertDescription>
        </Alert>
      )}
      <p className="text-[11.5px] leading-[1.6] text-zinc-400">
        Read only when tests run — never compiled, never read by an agent.
      </p>
      <div className={DIALOG_FOOTER_CLASS_NAME}>
        <Button disabled={writeTestSuiteMutation.isPending} onClick={() => void saveText()}>
          Save
        </Button>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          className="ml-auto"
          disabled={removeTestSuiteMutation.isPending}
          onClick={() => void deleteFile()}
        >
          Delete file
        </Button>
      </div>
    </div>
  );
}
