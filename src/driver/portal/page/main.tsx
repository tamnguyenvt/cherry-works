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
      <header className="flex items-center gap-3 border-b bg-background px-6 py-3">
        <span className="font-semibold">Cherry Works</span>
        {/* The repository this portal was started over. It is named once a
            route answers with it. */}
        <span className="text-sm text-muted-foreground" />
        <div className="ml-auto">
          <CharterSearch
            onPick={({ data: { identity, kind, scope } }) => {
              setTab(scope === "vendor" ? "vendor" : "repo");
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

      <main className="mx-auto max-w-6xl p-6">
        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value);
            setShownKind(null);
          }}
        >
          <TabsList className="w-full">
            {TABS.map(([which, name]) => (
              <TabsTrigger key={which} value={which}>
                {name}
              </TabsTrigger>
            ))}
          </TabsList>
          {/* A tab's view is mounted when the tab is shown and gone when
              another is, so each asks for the charter again when it comes back
              (FR-110). The repository's tab holds what the engine brings beside
              what was authored here; the vendor's is read-only (FR-112), under
              the sources it was installed from (FR-122). */}
          <TabsContent value="repo" className="mt-4">
            <CharterListing scopes={["repo", "builtin"]} kind={shownKind} onKindChange={setShownKind} />
          </TabsContent>
          <TabsContent value="vendor" className="mt-4 space-y-6">
            <VendorSources />
            <CharterListing scopes={["vendor"]} kind={shownKind} onKindChange={setShownKind} />
          </TabsContent>
          <TabsContent value="test" className="mt-4">
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
