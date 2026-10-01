import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CharterListing } from "./components/CharterListing.js";
import { CharterSearch } from "./components/CharterSearch.js";
import { DialogProvider, useDialog } from "./components/Dialogs.js";
import { TestSuites } from "./components/TestSuites.js";
import { VendorSources } from "./components/VendorSources.js";
import { Button } from "./components/ui/button.js";
import { Toaster } from "./components/ui/sonner.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs.js";

/** The tabs of plan §12.5, in the order the mockup draws them. */
const TABS = [
  ["repo", "Repo Charter"],
  ["vendor", "Vendor"],
  ["test", "Test"],
] as const;

/** The white sheet a tab's view is drawn in, over the grey of the page. */
const SHEET = "rounded-2xl border bg-background px-[22px] py-5";

/** The page's shell: the header, the tabs, the sheet each view is rendered
 *  into, and the dialog and the toasts every view speaks through (plan §12.5).
 *
 *  It holds no charter and calls no route: Build opens the preview, and a
 *  build is only ever asked for from there; every dialog is opened through
 *  `useDialog`. Which tab is on, and which kind its
 *  listing shows, are state here rather than the tab's own: a primitive chosen
 *  from the search is shown where it is listed — its layer's tab, its kind — as
 *  well as opened (FR-114). */
function Portal() {
  const [tab, setTab] = useState("repo");
  // The kind the listing shows, or nothing for its own first choice; a tab
  // shown afresh starts from nothing again.
  const [shownKind, setShownKind] = useState<string | null>(null);
  const { open } = useDialog();

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background px-[26px]">
        <span className="flex items-center gap-[9px] text-[13.5px] font-bold tracking-[-0.01em]">
          <img src="./logo.png" alt="" className="size-[22px] object-contain" />
          Cherry Works
        </span>
        {/* The repository this portal was started over. It is named once a
            route answers with it. */}
        <span className="font-mono text-[11.5px] text-zinc-400" />
        <div className="ml-auto flex w-full max-w-[460px]">
          <CharterSearch
            onPick={({ data: { identity, kind, layerName } }) => {
              setTab(layerName === "vendor" ? "vendor" : "repo");
              setShownKind(kind);
              open("primitive", { identity });
            }}
          />
        </div>
        <Button variant="outline" onClick={() => open("buildPreview", {})}>
          Build
        </Button>
        <Button variant="outline" onClick={() => open("doctor", {})}>
          Doctor
        </Button>
      </header>

      <main className="mx-auto max-w-[1120px] px-[26px] pt-[22px] pb-[60px]">
        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value);
            setShownKind(null);
          }}
        >
          <TabsList className="mb-4 h-auto w-full gap-1 rounded-[11px] bg-[#e9e9ec] p-1">
            {TABS.map(([which, name]) => (
              <TabsTrigger
                key={which}
                value={which}
                className="h-auto rounded-lg py-[9px] text-[12.5px] font-semibold text-zinc-500 data-[state=active]:shadow-[0_1px_3px_rgba(0,0,0,0.09)]"
              >
                {name}
              </TabsTrigger>
            ))}
          </TabsList>
          {/* A tab's view is mounted when the tab is shown and gone when
              another is, so each asks for the charter again when it comes back
              (FR-110). The repository's tab holds what the engine brings beside
              what was authored here; the vendor's is read-only (FR-112), beside
              the sources it was installed from (FR-122). */}
          <TabsContent value="repo" className={SHEET}>
            <CharterListing layerNames={["repo", "builtin"]} kind={shownKind} onKindChange={setShownKind} />
          </TabsContent>
          <TabsContent value="vendor" className={`${SHEET} grid items-start gap-4 md:has-[>section]:grid-cols-[210px_minmax(0,1fr)]`}>
            <VendorSources />
            <CharterListing layerNames={["vendor"]} kind={shownKind} onKindChange={setShownKind} />
          </TabsContent>
          <TabsContent value="test" className={SHEET}>
            <TestSuites />
          </TabsContent>
        </Tabs>
      </main>

      <Toaster />
    </>
  );
}

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <DialogProvider>
        <Portal />
      </DialogProvider>
    </QueryClientProvider>
  </StrictMode>,
);
