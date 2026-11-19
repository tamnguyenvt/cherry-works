import { createContext, type ReactNode, useContext, useState } from "react";
import { toast } from "sonner";
import { AddCharterSource } from "./add-charter-source.component.js";
import { type BuildAnswer, BuildOutcome, BuildPreview } from "./charter-build.component.js";
import { DoctorReport } from "./doctor-report.component.js";
import { PrimitiveExplanation } from "./primitive-explanation.component.js";
import { PrimitiveForm } from "./primitive-form.component.js";
import { TestSuiteEditor } from "./test-suite-editor.component.js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog.js";

/** The version of the cw serving this page, written in by the build. */
declare const CW_VERSION: string;

/** What a dialog is rendered with besides its own params, and what
 *  `useDialog` hands out: the one way to open a dialog — by its name, with the
 *  params that dialog is rendered by — and to close it. */
type DialogHelpers = {
  openDialog: <Name extends keyof typeof DIALOGS>(
    name: Name,
    dialogParams: Parameters<(typeof DIALOGS)[Name]["renderContent"]>[0],
  ) => void;
  closeDialog: () => void;
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
  /** What the engine says of one primitive; every id in it opens its
   *  own, in the same dialog (FR-116). */
  explanation: {
    title: () => "Explain",
    context: ({ id }: { id: string }) => id,
    holdsDraft: false,
    renderContent: ({ id }: { id: string }, { openDialog }: DialogHelpers) => (
      <PrimitiveExplanation
        key={id}
        id={id}
        onExplain={(explainedId) => openDialog("explanation", { id: explainedId })}
      />
    ),
  },
  /** One primitive opened in the form, or read-only where this repository did
   *  not author it (FR-075, FR-077). */
  primitive: {
    title: ({ id }: { id: string }) => id,
    context: () => "",
    holdsDraft: true,
    renderContent: ({ id }: { id: string }, { closeDialog }: DialogHelpers) => (
      <PrimitiveForm key={id} id={id} onDone={showWrittenToast(closeDialog)} onClose={closeDialog} />
    ),
  },
  /** A new primitive, starting as the kind the listing was showing (FR-117). */
  newPrimitive: {
    title: () => "New primitive",
    context: () => "",
    holdsDraft: true,
    renderContent: ({ kind }: { kind: string }, { closeDialog }: DialogHelpers) => (
      <PrimitiveForm key={`new ${kind}`} newKind={kind} onDone={showWrittenToast(closeDialog)} onClose={closeDialog} />
    ),
  },
  /** What a build would do, with the build itself from it (FR-120). */
  buildPreview: {
    title: () => "cw build",
    context: () => "nothing written yet",
    holdsDraft: false,
    renderContent: (_params: Record<string, never>, { openDialog }: DialogHelpers) => (
      <BuildPreview onBuilt={(buildAnswer) => openDialog("buildOutcome", { buildAnswer })} />
    ),
  },
  /** What a build wrote and deleted, or why it wrote nothing (FR-120). */
  buildOutcome: {
    title: () => "cw build",
    context: () => "",
    holdsDraft: false,
    renderContent: ({ buildAnswer }: { buildAnswer: BuildAnswer }) => <BuildOutcome buildAnswer={buildAnswer} />,
  },
  /** A charter source to pull, above the directories reserved under its charter folder
   *  (FR-123). */
  addCharterSource: {
    title: () => "Add charter source",
    context: () => "",
    holdsDraft: true,
    renderContent: (_params: Record<string, never>, { closeDialog }: DialogHelpers) => (
      <AddCharterSource onDone={showWrittenToast(closeDialog)} onClose={closeDialog} />
    ),
  },
  /** One test file's text, to save or delete (FR-090, FR-092). */
  testSuite: {
    title: ({ charterName, name: testSuiteName }: { charterName: string; name: string }) =>
      `.cw/charter/${charterName}/test/${testSuiteName}`,
    context: () => "",
    holdsDraft: true,
    renderContent: (
      { charterName, name: testSuiteName }: { charterName: string; name: string },
      { closeDialog }: DialogHelpers,
    ) => (
      <TestSuiteEditor
        key={`${charterName}/${testSuiteName}`}
        charterName={charterName}
        testSuiteName={testSuiteName}
        onDone={showWrittenToast(closeDialog)}
        onClose={closeDialog}
      />
    ),
  },
  /** The health check `cw doctor` gives, with a build where the output is
   *  behind (FR-121). */
  doctor: {
    title: () => "Doctor",
    // The version the report is from, as `cw doctor` starts with it (FR-132).
    context: () => `cw ${CW_VERSION}`,
    holdsDraft: false,
    renderContent: (_params: Record<string, never>, { openDialog }: DialogHelpers) => (
      <DoctorReport onBuilt={(buildAnswer) => openDialog("buildOutcome", { buildAnswer })} />
    ),
  },
};

/** What was written, said in a toast once the form closes; the listing asks
 *  again by itself. */
function showWrittenToast(closeDialog: () => void) {
  return (doneText: string, detailText: string) => {
    closeDialog();
    toast(doneText, { description: detailText });
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
  const [shownDialog, setShownDialog] = useState<{ name: keyof typeof DIALOGS; dialogParams: never } | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const dialogHelpers: DialogHelpers = {
    openDialog: (name, dialogParams) => {
      setShownDialog({ name, dialogParams: dialogParams as never });
      setIsOpen(true);
    },
    closeDialog: () => setIsOpen(false),
  };
  const shownDialogSpec = shownDialog === null ? null : DIALOGS[shownDialog.name];

  return (
    <DialogContext.Provider value={dialogHelpers}>
      {children}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        {shownDialog !== null && shownDialogSpec !== null && (
          <DialogContent
            className="flex max-h-[88vh] w-[920px] max-w-[calc(100%-48px)] flex-col gap-0 overflow-hidden rounded-[15px] border-0 p-0 shadow-[0_34px_80px_-22px_rgba(0,0,0,0.4)] sm:max-w-[calc(100%-48px)]"
            onInteractOutside={(event) => shownDialogSpec.holdsDraft && event.preventDefault()}
            onEscapeKeyDown={(event) => shownDialogSpec.holdsDraft && event.preventDefault()}
          >
            <DialogHeader className="flex-row items-baseline gap-2.5 border-b border-[#f0f0f0] py-[15px] pr-12 pl-[18px]">
              <DialogTitle className="text-[14.5px] font-bold tracking-[-0.01em]">
                {shownDialogSpec.title(shownDialog.dialogParams)}
              </DialogTitle>
              <DialogDescription className="font-mono text-[11px] text-zinc-400">
                {shownDialogSpec.context(shownDialog.dialogParams)}
              </DialogDescription>
            </DialogHeader>
            {/* What a dialog renders scrolls under its header; a row of buttons
                it ends on is drawn as its footer (`DIALOG_FOOTER_CLASS_NAME`), and a strip or
                a list of rows is drawn from edge to edge by `-mx-5`. */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-[18px]">
              {shownDialogSpec.renderContent(shownDialog.dialogParams, dialogHelpers)}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </DialogContext.Provider>
  );
}
