import { useState } from "react";
import type { FaultDTOs } from "#module/shared/module.js";
import { useAddVendor } from "../portal.queries.js";
import { DIALOG_FOOTER_CLASS_NAME } from "./dialog-footer.constants.js";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert.js";
import { Button } from "./ui/button.js";
import { Input } from "./ui/input.js";
import { Label } from "./ui/label.js";

/**
 * A source to install, by the address git fetches and an optional version
 * (FR-123). A refusal, a name a charter may not take among them, stays here in
 * the engine's words, and nothing closes.
 */
export function AddVendorSource({
  onDone,
  onClose,
}: {
  onDone: (doneText: string, detailText: string) => void;
  onClose: () => void;
}) {
  const [source, setSource] = useState("");
  const [version, setVersion] = useState("");
  const [refusalFault, setRefusalFault] = useState<FaultDTOs.Fault | null>(null);
  const addVendorMutation = useAddVendor();

  const addSource = async () => {
    const trimmedVersion = version.trim();
    const refusedDTO = await addVendorMutation.mutateAsync({
      source: source.trim(),
      ...(trimmedVersion === "" ? {} : { version: trimmedVersion }),
    });
    if (refusedDTO !== null) return setRefusalFault(refusedDTO);
    onDone(
      "Vendor source added",
      `${source.trim()}${trimmedVersion === "" ? "" : ` @ ${trimmedVersion}`} · run Build to compile what it adds`,
    );
  };

  return (
    <div className="space-y-3.5">
      <p className="text-[13px] leading-[1.65] text-zinc-700">
        A vendor source is a repository governed by cw: every charter it authored, under .cw/charter/&lt;charter&gt;/,
        is installed, each with the charters it includes.
      </p>
      <div className="divide-y divide-zinc-100 overflow-hidden rounded-[11px] border border-[#f0f0f0]">
        <div className="flex items-center gap-3 px-[13px] py-2.5">
          <Label
            htmlFor="vendor-source"
            className="w-[118px] shrink-0 text-[10.5px] font-bold tracking-[0.06em] text-zinc-400 uppercase"
          >
            source
          </Label>
          <Input
            id="vendor-source"
            value={source}
            spellCheck={false}
            onChange={(event) => setSource(event.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 px-[13px] py-2.5">
          <Label
            htmlFor="vendor-version"
            className="w-[118px] shrink-0 text-[10.5px] font-bold tracking-[0.06em] text-zinc-400 uppercase"
          >
            version
          </Label>
          <Input
            id="vendor-version"
            value={version}
            spellCheck={false}
            onChange={(event) => setVersion(event.target.value)}
          />
          <span className="max-w-[45%] shrink text-right text-[11.5px] text-zinc-400">
            a tag, branch or commit; left empty, the source's default
          </span>
        </div>
      </div>
      {refusalFault !== null && (
        <Alert variant="destructive" className="rounded-xl border-[#f6d9d9] bg-[#fef6f6]">
          <AlertTitle className="text-[12.5px] font-bold text-foreground">
            Refused, and nothing was installed
          </AlertTitle>
          <AlertDescription>
            <p className="whitespace-pre-line">
              {refusalFault.data.message} <span className="text-muted-foreground">{refusalFault.data.fix}</span>
            </p>
          </AlertDescription>
        </Alert>
      )}
      <div className={DIALOG_FOOTER_CLASS_NAME}>
        <Button disabled={addVendorMutation.isPending || source.trim() === ""} onClick={() => void addSource()}>
          Add source
        </Button>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
