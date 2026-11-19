import { toast } from "sonner";
import { useInstalledCharters, usePrimitives, useRemoveVendor } from "../portal.queries.js";
import { useDialog } from "./dialogs.component.js";
import { FaultAlert } from "./fault-alert.component.js";
import { Button } from "./ui/button.js";

/**
 * The charters this repository installed (FR-122, VENDOR-FR-021): each by its
 * name, with the source and the version it came from, and its primitives
 * counted by kind, off the vendor layer of the listing under its folder
 * (data-model §10.2). Where none is installed, it says so and offers to add
 * one.
 *
 * Remove is the engine's vendoring too, and a refusal is said in its words.
 */
export function VendorSources() {
  const { openDialog } = useDialog();
  const installedChartersQuery = useInstalledCharters();
  const primitivesQuery = usePrimitives();
  const removeVendorMutation = useRemoveVendor();

  if (installedChartersQuery.data === undefined) return null;
  if (installedChartersQuery.data.type === "Fault") return <FaultAlert fault={installedChartersQuery.data} />;
  const installedCharters = installedChartersQuery.data.data.charters.map(
    ({ data: installedCharter }) => installedCharter,
  );
  const vendoredPrimitives =
    primitivesQuery.data?.type === "Primitives"
      ? primitivesQuery.data.data.primitives.filter(({ data: primitive }) => primitive.layerName === "vendor")
      : [];

  const removeInstall = async (charterName: string, charterFolderPath: string) => {
    const refusedDTO = await removeVendorMutation.mutateAsync(charterName);
    if (refusedDTO !== null) return void toast.error(refusedDTO.data.message, { description: refusedDTO.data.fix });
    toast("Charter removed", {
      description: `${charterFolderPath} · run Build to compile the charter without it`,
    });
  };

  if (installedCharters.length === 0)
    return (
      <div
        className="flex items-center gap-[9px] rounded-xl border border-dashed px-[15px] py-3.5"
        aria-label="Vendor sources"
      >
        <span className="text-xs font-semibold">No vendor source installed</span>
        <Button size="sm" className="ml-auto" onClick={() => openDialog("addVendor", {})}>
          Add vendor source
        </Button>
      </div>
    );

  return (
    <section
      className="divide-y divide-[#f0f0f0] overflow-hidden rounded-[13px] border bg-background"
      aria-label="Vendor sources"
    >
      <h2 className="px-3.5 py-[11px] text-[10.5px] font-bold tracking-[0.06em] text-zinc-400 uppercase">
        Vendor sources
      </h2>
      {installedCharters.map(({ name: charterName, folder: charterFolderPath, source, version }) => {
        const primitivesOfFolder = vendoredPrimitives.filter(({ data: primitive }) =>
          primitive.file.startsWith(`${charterFolderPath}/`),
        );
        const kindCountEntries = [...new Set(primitivesOfFolder.map(({ data: primitive }) => primitive.kind))]
          .sort()
          .map(
            (kind) =>
              [kind, primitivesOfFolder.filter(({ data: primitive }) => primitive.kind === kind).length] as const,
          );
        return (
          <div
            key={charterName}
            className="flex flex-col gap-2.5 bg-[#f6f2ff] px-3.5 py-3"
            aria-label={charterFolderPath}
          >
            <div className="min-w-0 space-y-0.5">
              <div className="text-[12.5px] font-semibold">{charterName}</div>
              <div className="text-[11px] text-zinc-500">
                <span className="font-mono">{charterFolderPath}/</span> · {source} {version} · read-only
              </div>
            </div>
            <dl
              className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1.5 text-[11.5px] text-zinc-500"
              aria-label="Primitives by kind"
            >
              {kindCountEntries.map(([kind, count]) => (
                <div key={kind} className="contents">
                  <dt>{kind}</dt>
                  <dd className="font-mono text-[10.5px] text-zinc-400">{count}</dd>
                </div>
              ))}
            </dl>
            <Button
              size="sm"
              variant="outline"
              className="self-start"
              disabled={removeVendorMutation.isPending}
              onClick={() => void removeInstall(charterName, charterFolderPath)}
            >
              Remove
            </Button>
          </div>
        );
      })}
      <div className="px-3.5 py-[11px]">
        <Button size="sm" variant="outline" onClick={() => openDialog("addVendor", {})}>
          Add source
        </Button>
      </div>
    </section>
  );
}
