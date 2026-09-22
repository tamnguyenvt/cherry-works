import { useState } from "react";
import type { DataDTOs } from "#hexagon/port/driver/dtos/index.js";
import { useAddVendor, useKinds } from "../queries.js";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert.js";
import { Button } from "./ui/button.js";
import { Input } from "./ui/input.js";
import { Label } from "./ui/label.js";
import { DIALOG_FOOTER } from "../lib/utils.js";

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
    <div className="space-y-3.5">
      <p className="text-[13px] leading-[1.65] text-zinc-700">A vendor source is a repository of primitives laid out by kind.</p>
      <div className="divide-y divide-zinc-100 overflow-hidden rounded-[11px] border border-[#f0f0f0]">
        <div className="flex items-center gap-3 px-[13px] py-2.5">
          <Label htmlFor="vendor-source" className="w-[118px] shrink-0 text-[10.5px] font-bold tracking-[0.06em] text-zinc-400 uppercase">
            source
          </Label>
          <Input id="vendor-source" value={source} spellCheck={false} onChange={(event) => setSource(event.target.value)} />
        </div>
        <div className="flex items-center gap-3 px-[13px] py-2.5">
          <Label htmlFor="vendor-version" className="w-[118px] shrink-0 text-[10.5px] font-bold tracking-[0.06em] text-zinc-400 uppercase">
            version
          </Label>
          <Input id="vendor-version" value={version} spellCheck={false} onChange={(event) => setVersion(event.target.value)} />
          <span className="max-w-[45%] shrink text-right text-[11.5px] text-zinc-400">a tag, branch or commit; left empty, the source's default</span>
        </div>
      </div>
      <div className="rounded-[11px] border bg-zinc-50 px-3.5 py-3" aria-label="Reserved directories">
        <div className="mb-1 text-[11px] font-bold tracking-[0.07em] text-zinc-400 uppercase">Reserved directories at its root</div>
        {Object.entries(kindsQuery.data?.data ?? {}).map(([kind, activatesWhen]) => (
          <div key={kind} className="flex items-baseline gap-[9px] border-t border-zinc-100 py-[7px]">
            <span className="min-w-[150px] font-mono text-[11.5px]">{kind}/</span>
            <span className="text-[11.5px] text-zinc-500">{activatesWhen}</span>
          </div>
        ))}
      </div>
      {refusal !== null && (
        <Alert variant="destructive" className="rounded-xl border-[#f6d9d9] bg-[#fef6f6]">
          <AlertTitle className="text-[12.5px] font-bold text-foreground">Refused, and nothing was installed</AlertTitle>
          <AlertDescription>
            <p className="whitespace-pre-line">
              {refusal.data.message} <span className="text-muted-foreground">{refusal.data.fix}</span>
            </p>
          </AlertDescription>
        </Alert>
      )}
      <div className={DIALOG_FOOTER}>
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
