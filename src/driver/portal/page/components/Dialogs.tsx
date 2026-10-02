import { createContext, useContext, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { BuildOutcome, BuildPreview, type BuildAnswer } from "./CharterBuild.js";
import { DoctorReport } from "./DoctorReport.js";
import { PrimitiveExplanation } from "./PrimitiveExplanation.js";
import { PrimitiveForm } from "./PrimitiveForm.js";
import { AddVendorSource } from "./AddVendorSource.js";
import { TestSuiteEditor } from "./TestSuiteEditor.js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog.js";

/** The version of the cw serving this page, written in by the build. */
declare const CW_VERSION: string;

/** What a dialog is rendered with besides its own params, and what
 *  `useDialog` hands out: the one way to open a dialog — by its name, with the
 *  params that dialog is rendered by — and to close it. */
type DialogHelpers = {
  open: <Name extends keyof typeof DIALOGS>(name: Name, params: Parameters<(typeof DIALOGS)[Name]["render"]>[0]) => void;
  close: () => void;
};

/**
 * Every dialog the page opens, under the name it is opened by (plan §12.5):
 * its title and the line under it, whether it holds a draft, and what it
 * shows, each from the params it was opened with.
 *
 * One holding a draft is closed only by its × or its own buttons, so a stray
 * click or Escape does not throw away what was typed; one that is only read
 * also closes on a click outside it and on Escape.
 */
const DIALOGS = {
  /** What the engine says of one primitive; every identity in it opens its
   *  own, in the same dialog (FR-116). */
  explanation: {
    title: () => "Explain",
    context: ({ identity }: { identity: string }) => identity,
    holdsDraft: false,
    render: ({ identity }: { identity: string }, { open }: DialogHelpers) => (
      <PrimitiveExplanation key={identity} identity={identity} onExplain={(next) => open("explanation", { identity: next })} />
    ),
  },
  /** One primitive opened in the form, or read-only where this repository did
   *  not author it (FR-075, FR-077). */
  primitive: {
    title: ({ identity }: { identity: string }) => identity,
    context: () => "",
    holdsDraft: true,
    render: ({ identity }: { identity: string }, { close }: DialogHelpers) => (
      <PrimitiveForm key={identity} identity={identity} onDone={toastWritten(close)} onClose={close} />
    ),
  },
  /** A new primitive, starting as the kind the listing was showing (FR-117). */
  newPrimitive: {
    title: () => "New primitive",
    context: () => "",
    holdsDraft: true,
    render: ({ kind }: { kind: string }, { close }: DialogHelpers) => (
      <PrimitiveForm key={`new ${kind}`} newKind={kind} onDone={toastWritten(close)} onClose={close} />
    ),
  },
  /** What a build would do, with the build itself from it (FR-120). */
  buildPreview: {
    title: () => "cw build",
    context: () => "nothing written yet",
    holdsDraft: false,
    render: (_params: Record<string, never>, { open }: DialogHelpers) => (
      <BuildPreview onBuilt={(buildAnswer) => open("buildOutcome", { buildAnswer })} />
    ),
  },
  /** What a build wrote and deleted, or why it wrote nothing (FR-120). */
  buildOutcome: {
    title: () => "cw build",
    context: () => "",
    holdsDraft: false,
    render: ({ buildAnswer }: { buildAnswer: BuildAnswer }) => <BuildOutcome buildAnswer={buildAnswer} />,
  },
  /** A vendor source to install, above the directories reserved under its charter folder
   *  (FR-123). */
  addVendor: {
    title: () => "Add vendor source",
    context: () => "",
    holdsDraft: true,
    render: (_params: Record<string, never>, { close }: DialogHelpers) => <AddVendorSource onDone={toastWritten(close)} onClose={close} />,
  },
  /** One test file's text, to save or delete (FR-090, FR-092). */
  testSuite: {
    title: ({ name }: { name: string }) => `.cw/test/${name}`,
    context: () => "",
    holdsDraft: true,
    render: ({ name }: { name: string }, { close }: DialogHelpers) => (
      <TestSuiteEditor key={name} name={name} onDone={toastWritten(close)} onClose={close} />
    ),
  },
  /** The health check `cw doctor` gives, with a build where the output is
   *  behind (FR-121). */
  doctor: {
    title: () => "Doctor",
    // The version the report is from, as `cw doctor` starts with it (FR-132).
    context: () => `cw ${CW_VERSION}`,
    holdsDraft: false,
    render: (_params: Record<string, never>, { open }: DialogHelpers) => (
      <DoctorReport onBuilt={(buildAnswer) => open("buildOutcome", { buildAnswer })} />
    ),
  },
};

/** What was written, said in a toast once the form closes; the listing asks
 *  again by itself. */
function toastWritten(close: () => void) {
  return (did: string, detail: string) => {
    close();
    toast(did, { description: detail });
  };
}

const DialogContext = createContext<DialogHelpers | null>(null);

/** The way into every dialog, from wherever on the page one is opened. */
export function useDialog(): DialogHelpers {
  return useContext(DialogContext)!;
}

/**
 * The page's one dialog, and what opens it: whichever of `DIALOGS` was opened
 * last, rendered from its params.
 *
 * What it shows is kept apart from whether it is open: closing it leaves what
 * it showed in place while Radix takes it down, and the next dialog opened
 * replaces it.
 */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState<{ name: keyof typeof DIALOGS; params: never } | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const helpers: DialogHelpers = {
    open: (name, params) => {
      setShown({ name, params: params as never });
      setIsOpen(true);
    },
    close: () => setIsOpen(false),
  };
  const dialog = shown === null ? null : DIALOGS[shown.name];

  return (
    <DialogContext.Provider value={helpers}>
      {children}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        {shown !== null && dialog !== null && (
          <DialogContent
            className="flex max-h-[88vh] w-[920px] max-w-[calc(100%-48px)] flex-col gap-0 overflow-hidden rounded-[15px] border-0 p-0 shadow-[0_34px_80px_-22px_rgba(0,0,0,0.4)] sm:max-w-[calc(100%-48px)]"
            onInteractOutside={(event) => dialog.holdsDraft && event.preventDefault()}
            onEscapeKeyDown={(event) => dialog.holdsDraft && event.preventDefault()}
          >
            <DialogHeader className="flex-row items-baseline gap-2.5 border-b border-[#f0f0f0] py-[15px] pr-12 pl-[18px]">
              <DialogTitle className="text-[14.5px] font-bold tracking-[-0.01em]">{dialog.title(shown.params)}</DialogTitle>
              <DialogDescription className="font-mono text-[11px] text-zinc-400">{dialog.context(shown.params)}</DialogDescription>
            </DialogHeader>
            {/* What a dialog renders scrolls under its header; a row of buttons
                it ends on is drawn as its footer (`DIALOG_FOOTER`), and a strip or
                a list of rows is drawn from edge to edge by `-mx-5`. */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-[18px]">{dialog.render(shown.params, helpers)}</div>
          </DialogContent>
        )}
      </Dialog>
    </DialogContext.Provider>
  );
}
