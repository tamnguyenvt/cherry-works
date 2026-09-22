import { toast } from "sonner";
import { usePrimitives, useRemoveVendor, useVendorFolders } from "../queries.js";
import { useDialog } from "./Dialogs.js";
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
  const { open } = useDialog();
  const vendorFoldersQuery = useVendorFolders();
  const primitivesQuery = usePrimitives();
  const removeVendor = useRemoveVendor();

  if (vendorFoldersQuery.data === undefined) return null;
  const folders = vendorFoldersQuery.data;
  const vendoredPrimitives =
    primitivesQuery.data?.type === "ScopedPrimitives" ? primitivesQuery.data.data.primitives.filter(({ data }) => data.scope === "vendor") : [];

  const removeInstall = async (folder: string) => {
    const refusedDTO = await removeVendor.mutateAsync(folder.split("/").at(-1) ?? "");
    if (refusedDTO !== null) return void toast.error(refusedDTO.data.message, { description: refusedDTO.data.fix });
    toast("Vendor source removed", { description: `${folder} · run Build to compile the charter without it` });
  };

  if (folders.length === 0)
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed px-4 py-3" aria-label="Vendor sources">
        <span className="text-sm font-semibold">No vendor source installed</span>
        <Button size="sm" className="ml-auto" onClick={() => open("addVendor", {})}>
          Add vendor source
        </Button>
      </div>
    );

  return (
    <section className="divide-y rounded-lg border" aria-label="Vendor sources">
      <h2 className="px-4 py-2.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Vendor sources</h2>
      {folders.map((folder) => {
        const primitivesOfFolder = vendoredPrimitives.filter(({ data }) => data.file.startsWith(`${folder}/`));
        const countsByKind = [...new Set(primitivesOfFolder.map(({ data }) => data.kind))].map(
          (kind) => [kind, primitivesOfFolder.filter(({ data }) => data.kind === kind).length] as const,
        );
        return (
          <div key={folder} className="flex flex-wrap items-start gap-x-6 gap-y-2 px-4 py-3" aria-label={folder}>
            <div className="min-w-0 space-y-1">
              <div className="text-sm font-semibold">{folder.split("/").at(-1)}</div>
              <div className="text-xs text-muted-foreground">
                <span className="font-mono">{folder}/</span> · read-only
              </div>
            </div>
            <dl className="grid grid-cols-[auto_auto] gap-x-3 text-xs text-muted-foreground" aria-label="Primitives by kind">
              {countsByKind.map(([kind, count]) => (
                <div key={kind} className="contents">
                  <dt>{kind}</dt>
                  <dd className="font-mono">{count}</dd>
                </div>
              ))}
            </dl>
            <Button size="sm" variant="outline" className="ml-auto" disabled={removeVendor.isPending} onClick={() => void removeInstall(folder)}>
              Remove
            </Button>
          </div>
        );
      })}
      <div className="px-4 py-2.5">
        <Button size="sm" variant="outline" onClick={() => open("addVendor", {})}>
          Add source
        </Button>
      </div>
    </section>
  );
}
