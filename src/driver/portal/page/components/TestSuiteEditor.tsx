import { useState } from "react";
import type { DataDTOs } from "#hexagon/port/driver/dtos/index.js";
import { useRemoveTestSuite, useTestSuites, useWriteTestSuite } from "../queries.js";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert.js";
import { Button } from "./ui/button.js";

/**
 * One test file's text, to correct and save, or to delete (FR-090, FR-092).
 * Text that is not a suite stays here with the engine's refusal and its sample
 * of one that reads, and nothing is written (Story 9 scenarios 3, 4, 7).
 */
export function TestSuiteEditor({
  name,
  onDone,
  onClose,
}: {
  name: string;
  onDone: (did: string, detail: string) => void;
  onClose: () => void;
}) {
  const testSuitesQuery = useTestSuites();
  const testSuite = testSuitesQuery.data?.data.testSuites.find(({ data }) => data.name === name);
  // The text is read once, when the file is first in the listing: a listing
  // asked again while it is being edited does not write over what was typed. A
  // file that does not read has none to show, and opens empty.
  if (testSuite === undefined) return null;
  return <TestSuiteText key={name} name={name} initialText={testSuite.data.text ?? ""} onDone={onDone} onClose={onClose} />;
}

function TestSuiteText({
  name,
  initialText,
  onDone,
  onClose,
}: {
  name: string;
  initialText: string;
  onDone: (did: string, detail: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [refusal, setRefusal] = useState<DataDTOs.Fault | null>(null);
  const writeTestSuite = useWriteTestSuite();
  const removeTestSuite = useRemoveTestSuite();

  const saveText = async () => {
    const nameOrFaultDTO = await writeTestSuite.mutateAsync({ name, text });
    if (typeof nameOrFaultDTO !== "string") return setRefusal(nameOrFaultDTO);
    onDone("Saved", `.cw/test/${name} rewritten · run the cases again`);
  };

  const deleteFile = async () => {
    const refusedDTO = await removeTestSuite.mutateAsync(name);
    if (refusedDTO !== null) return setRefusal(refusedDTO);
    onDone("Test file deleted", `.cw/test/${name} removed`);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        A case is one situation — a touched file (<code>do.touchFile</code>) or a raised event (<code>when</code>) — and expects one thing:{" "}
        <code>activate</code>, <code>run</code> or <code>allow</code>.
      </p>
      <textarea
        aria-label="Test file text"
        className="h-80 w-full resize-y rounded-lg border bg-muted/40 px-3 py-2.5 font-mono text-xs outline-none"
        spellCheck={false}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      {refusal !== null && (
        <Alert variant="destructive">
          <AlertTitle>Refused, and nothing was written</AlertTitle>
          <AlertDescription>
            <p className="break-words whitespace-pre-line">
              {refusal.data.message} <span className="text-muted-foreground">{refusal.data.fix}</span>
            </p>
          </AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2">
        <Button disabled={writeTestSuite.isPending} onClick={() => void saveText()}>
          Save
        </Button>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="outline" className="ml-auto text-destructive" disabled={removeTestSuite.isPending} onClick={() => void deleteFile()}>
          Delete file
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Read only when tests run — never compiled, never read by an agent.</p>
    </div>
  );
}
