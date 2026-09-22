import { useState } from "react";
import type { DataDTOs } from "#hexagon/port/driver/dtos/index.js";
import { useAddVendor, useKinds } from "../queries.js";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert.js";
import { Button } from "./ui/button.js";
import { Input } from "./ui/input.js";
import { Label } from "./ui/label.js";

/**
 * A source to install, by the address git fetches and an optional version
 * (FR-123), above the directory names reserved at a source's root: the kind
 * folders, as the engine names every kind. A refusal stays here in the
 * engine's words, and nothing closes.
 */
export function AddVendorSource({ onDone, onClose }: { onDone: (did: string, detail: string) => void; onClose: () => void }) {
  const [source, setSource] = useState("");
  const [version, setVersion] = useState("");
  const [refusal, setRefusal] = useState<DataDTOs.Fault | null>(null);
  const kindsQuery = useKinds();
  const addVendor = useAddVendor();

  const addSource = async () => {
    const trimmedVersion = version.trim();
    const refusedDTO = await addVendor.mutateAsync({ source: source.trim(), ...(trimmedVersion === "" ? {} : { version: trimmedVersion }) });
    if (refusedDTO !== null) return setRefusal(refusedDTO);
    onDone("Vendor source added", `${source.trim()}${trimmedVersion === "" ? "" : ` @ ${trimmedVersion}`} · run Build to compile what it adds`);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">A vendor source is a repository of primitives laid out by kind.</p>
      <div className="divide-y rounded-lg border">
        <div className="grid grid-cols-[7rem_1fr] items-center gap-x-3 px-3 py-2.5">
          <Label htmlFor="vendor-source" className="text-xs tracking-wider text-muted-foreground uppercase">
            source
          </Label>
          <Input id="vendor-source" value={source} spellCheck={false} onChange={(event) => setSource(event.target.value)} />
        </div>
        <div className="grid grid-cols-[7rem_1fr] items-center gap-x-3 gap-y-1 px-3 py-2.5">
          <Label htmlFor="vendor-version" className="text-xs tracking-wider text-muted-foreground uppercase">
            version
          </Label>
          <Input id="vendor-version" value={version} spellCheck={false} onChange={(event) => setVersion(event.target.value)} />
          <span className="col-start-2 text-xs text-muted-foreground">a tag, branch or commit; left empty, the source's default</span>
        </div>
      </div>
      <div className="rounded-lg border bg-muted/40 px-3 py-2.5" aria-label="Reserved directories">
        <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Reserved directories at its root</div>
        {Object.entries(kindsQuery.data?.data ?? {}).map(([kind, activatesWhen]) => (
          <div key={kind} className="flex items-baseline gap-3 border-t py-1.5">
            <span className="min-w-28 font-mono text-xs">{kind}/</span>
            <span className="text-xs text-muted-foreground">{activatesWhen}</span>
          </div>
        ))}
      </div>
      {refusal !== null && (
        <Alert variant="destructive">
          <AlertTitle>Refused, and nothing was installed</AlertTitle>
          <AlertDescription>
            <p className="whitespace-pre-line">
              {refusal.data.message} <span className="text-muted-foreground">{refusal.data.fix}</span>
            </p>
          </AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2">
        <Button disabled={addVendor.isPending || source.trim() === ""} onClick={() => void addSource()}>
          Add source
        </Button>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
