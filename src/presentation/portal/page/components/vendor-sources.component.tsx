import { toast } from "sonner";
import { usePrimitives, useRemoveVendor, useVendorFolders } from "../portal.queries.js";
import { useDialog } from "./dialogs.component.js";
import { FaultAlert } from "./fault-alert.component.js";
import { Button } from "./ui/button.js";

/**
 * The vendor sources this repository installed (FR-122): each folder one was
 * installed as, and its primitives counted by kind, off the vendor layer of
 * the listing under that folder (data-model §10.2). Where none is installed,
 * it says so and offers to add one.
 *
 * Remove is the engine's vendoring too, and a refusal is said in its words.
 */
export function VendorSources() {
  const { openDialog } = useDialog();
  const vendorFoldersQuery = useVendorFolders();
  const primitivesQuery = usePrimitives();
  const removeVendorMutation = useRemoveVendor();

  if (vendorFoldersQuery.data === undefined) return null;
  if (vendorFoldersQuery.data.type === "Fault") return <FaultAlert fault={vendorFoldersQuery.data} />;
  const { folders: vendorFolderPaths } = vendorFoldersQuery.data.data;
  const vendoredPrimitives =
    primitivesQuery.data?.type === "Primitives"
      ? primitivesQuery.data.data.primitives.filter(({ data: primitive }) => primitive.layerName === "vendor")
      : [];

  const removeInstall = async (vendorFolderPath: string) => {
    const refusedDTO = await removeVendorMutation.mutateAsync(vendorFolderPath.slice(".cw/charter/vendor/".length));
    if (refusedDTO !== null) return void toast.error(refusedDTO.data.message, { description: refusedDTO.data.fix });
    toast("Vendor source removed", {
      description: `${vendorFolderPath} · run Build to compile the charter without it`,
    });
  };

  if (vendorFolderPaths.length === 0)
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
      {vendorFolderPaths.map((vendorFolderPath) => {
        const primitivesOfFolder = vendoredPrimitives.filter(({ data: primitive }) =>
          primitive.file.startsWith(`${vendorFolderPath}/`),
        );
        const kindCountEntries = [...new Set(primitivesOfFolder.map(({ data: primitive }) => primitive.kind))]
          .sort()
          .map(
            (kind) =>
              [kind, primitivesOfFolder.filter(({ data: primitive }) => primitive.kind === kind).length] as const,
          );
        return (
          <div
            key={vendorFolderPath}
            className="flex flex-col gap-2.5 bg-[#f6f2ff] px-3.5 py-3"
            aria-label={vendorFolderPath}
          >
            <div className="min-w-0 space-y-0.5">
              <div className="text-[12.5px] font-semibold">{vendorFolderPath.slice(".cw/charter/vendor/".length)}</div>
              <div className="text-[11px] text-zinc-500">
                <span className="font-mono">{vendorFolderPath}/</span> · read-only
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
              onClick={() => void removeInstall(vendorFolderPath)}
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
