import { useState, type ReactNode } from "react";
import { X } from "lucide-react";
import type { InferRequestType } from "hono/client";
import type { DataDTOs } from "#hexagon/port/driver/dtos/index.js";
import type { client } from "../client.js";
import { PrimitiveBody } from "./PrimitiveBody.js";
import {
  useAddPrimitive,
  useKinds,
  usePrimitiveRequirements,
  usePrimitives,
  usePrimitive,
  useRemovePrimitive,
  useRewritePrimitive,
} from "../queries.js";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert.js";
import { Button } from "./ui/button.js";
import { Input } from "./ui/input.js";
import { Label } from "./ui/label.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select.js";
import { DIALOG_FOOTER } from "../lib/utils.js";

/**
 * One primitive, new or opened, in the shape its kind takes (FR-117, FR-118).
 *
 * An opened one is asked for first, and the form is drawn from what came back:
 * this repository's own in the form, a vendored or builtin one read-only, since
 * this repository did not author it and differing from it is authoring one of
 * its own (FR-077).
 */
export function PrimitiveForm({
  identity,
  newKind,
  onDone,
  onClose,
}: {
  /** The primitive to open, or nothing for a new one. */
  identity?: string;
  /** The kind a new one starts as: the one the listing was showing. */
  newKind?: string;
  onDone: (did: string, detail: string) => void;
  onClose: () => void;
}) {
  const { data: openedAnswer } = usePrimitive(identity);

  if (identity === undefined)
    return <PrimitiveEditor openedPrimitive={null} entityTag="" newKind={newKind ?? ""} onDone={onDone} onClose={onClose} />;
  if (openedAnswer === undefined) return null;

  const { answer, entityTag } = openedAnswer;
  if (answer.type === "Fault") return <Refusals faults={[answer]} />;
  if (answer.data.layerName !== "repo") return <ReadOnlyPrimitive openedPrimitive={answer} />;
  return <PrimitiveEditor openedPrimitive={answer} entityTag={entityTag} newKind="" onDone={onDone} onClose={onClose} />;
}

/**
 * The form itself, starting from the primitive it was opened on, if any.
 *
 * The rows are the kind's requirements as the engine answers them, in its
 * order: a box per entry for a list, a choice for a header with allowed
 * values, one line otherwise, and the rationale offering every corpus the
 * charter holds. A new primitive chooses its kind from `kinds()` and types its
 * id; an opened one shows both and changes neither, since the identity is the
 * file (FR-075).
 *
 * Whether the answers hold is the engine's to say. What it refuses is shown
 * here in its words, and nothing is written (Story 6 scenarios 2, 3, 9).
 */
function PrimitiveEditor({
  openedPrimitive,
  entityTag,
  newKind,
  onDone,
  onClose,
}: {
  /** What the form was opened on, or nothing for a new primitive. */
  openedPrimitive: DataDTOs.Primitive | null;
  /** The entity tag a save is sent back with (FR-078). */
  entityTag: string;
  newKind: string;
  onDone: (did: string, detail: string) => void;
  onClose: () => void;
}) {
  const primitive = openedPrimitive?.data;
  const [kind, setKind] = useState(primitive?.kind ?? newKind);
  const [id, setId] = useState(primitive === undefined ? "" : String(primitive.headers.id));
  const [answers, setAnswers] = useState<InferRequestType<typeof client.charter.root.primitives.$post>["json"]["headers"]>(() =>
    Object.fromEntries(
      Object.entries(primitive?.headers ?? {})
        .filter(([field]) => field !== "id")
        .map(([field, value]) => [field, typeof value === "string" ? value : [...value]]),
    ),
  );
  const [body, setBody] = useState(openedPrimitive?.data.body ?? "");
  const [faults, setFaults] = useState<readonly DataDTOs.Fault[]>([]);

  const { data: kindsAnswer } = useKinds();
  const { data: requirementsAnswer } = usePrimitiveRequirements(kind);
  const { data: listing } = usePrimitives();
  const addPrimitive = useAddPrimitive();
  const rewritePrimitive = useRewritePrimitive();
  const removePrimitive = useRemovePrimitive();

  const kinds = kindsAnswer === undefined ? [] : Object.keys(kindsAnswer.data);
  const headers = requirementsAnswer?.type === "PrimitiveRequirements" ? requirementsAnswer.data.headers : [];
  // The corpus a rationale may cite is whatever the charter holds of it now; a
  // charter the engine will not read offers none.
  const corpusIdentities =
    listing?.type === "Primitives" ? listing.data.primitives.filter(({ data }) => data.kind === "corpus").map(({ data }) => data.identity) : [];

  // Only what the kind takes is sent, and nothing left blank: a header answered
  // with nothing is a header not answered.
  const answeredHeaders = Object.fromEntries(
    headers.flatMap(({ data: { field } }) => {
      const answer = answers[field];
      const trimmedAnswer =
        typeof answer === "string" ? answer.trim() : (answer ?? []).map((entry) => entry.trim()).filter((entry) => entry !== "");
      return trimmedAnswer.length === 0 ? [] : [[field, trimmedAnswer]];
    }),
  );

  const faultsOf = (refusedDTO: DataDTOs.Faults | DataDTOs.Fault) =>
    setFaults(refusedDTO.type === "Faults" ? refusedDTO.data.faults : [refusedDTO]);

  const savePrimitive = async () => {
    const primitiveDTO =
      openedPrimitive === null
        ? await addPrimitive.mutateAsync({ kind, id, headers: answeredHeaders, body })
        : await rewritePrimitive.mutateAsync({
            param: { identity: openedPrimitive.data.identity },
            header: { "if-match": entityTag },
            json: { headers: answeredHeaders, body },
          });
    if (primitiveDTO.type !== "Primitive") return faultsOf(primitiveDTO);
    const { file, headers: writtenHeaders } = primitiveDTO.data;
    onDone(
      openedPrimitive === null ? "Primitive created" : "Primitive saved",
      // A script just created has its file to run written beside it, empty.
      `${file} · ${openedPrimitive === null && typeof writtenHeaders.executionPath === "string" ? `${writtenHeaders.executionPath} beside it is the file it runs, write the script there · ` : ""}nothing compiled until the next build`,
    );
  };

  const deletePrimitive = async () => {
    if (openedPrimitive === null) return;
    const refusedDTO = await removePrimitive.mutateAsync(openedPrimitive.data.identity);
    if (refusedDTO !== null) return faultsOf(refusedDTO);
    onDone("Primitive deleted", `${openedPrimitive.data.file} · what still names it is reported by Doctor`);
  };

  return (
    <div className="space-y-3.5">
      <div className={FORM_ROWS}>
        {openedPrimitive === null ? (
          <>
            <FormRow label="kind" htmlFor="primitive-kind">
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger id="primitive-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {kinds.map((one) => (
                    <SelectItem key={one} value={one}>
                      {one}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormRow>
            <FormRow label="id" htmlFor="primitive-id">
              <Input id="primitive-id" value={id} placeholder="no-any" spellCheck={false} onChange={(event) => setId(event.currentTarget.value)} />
            </FormRow>
          </>
        ) : (
          <>
            <FormRow label="kind" hint="the identity is the file — rename by creating a new primitive and deleting this one">
              <span className="font-mono text-[11.5px]">{kind}</span>
            </FormRow>
            <FormRow label="id">
              <span className="font-mono text-[11.5px]">{id}</span>
            </FormRow>
          </>
        )}
        {headers.map(({ data: { field, shape, required, allowedValues } }) => (
          <FormRow key={field} label={field} htmlFor={`header-${field}`} hint={required ? "required" : undefined}>
            {shape === "list" ? (
              <ListAnswer
                field={field}
                entries={Array.isArray(answers[field]) ? answers[field] : []}
                onChange={(entries) => setAnswers({ ...answers, [field]: entries })}
              />
            ) : allowedValues !== undefined ? (
              <Select
                value={typeof answers[field] === "string" ? answers[field] : ""}
                onValueChange={(value) => setAnswers({ ...answers, [field]: value })}
              >
                <SelectTrigger id={`header-${field}`} className="w-full">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {allowedValues.map((one) => (
                    <SelectItem key={one} value={one}>
                      {one}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={`header-${field}`}
                spellCheck={false}
                autoComplete="off"
                value={typeof answers[field] === "string" ? answers[field] : ""}
                list={field === "rationale" ? "corpus-identities" : undefined}
                onChange={(event) => setAnswers({ ...answers, [field]: event.currentTarget.value })}
              />
            )}
          </FormRow>
        ))}
      </div>
      <datalist id="corpus-identities">
        {corpusIdentities.map((one) => (
          <option key={one} value={one} />
        ))}
      </datalist>

      <PrimitiveBody body={body} onChange={setBody} />

      {faults.length > 0 && <Refusals faults={faults} />}

      <div className={DIALOG_FOOTER}>
        <Button onClick={() => void savePrimitive()}>{openedPrimitive === null ? "Create primitive" : "Save"}</Button>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        {openedPrimitive !== null && (
          <Button variant="destructive" className="ml-auto" onClick={() => void deletePrimitive()}>
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}

/** A vendored or builtin primitive, shown and not offered for change: what it
 *  declares, where it came from, its body, and how to differ from it (Story 6
 *  scenario 7). */
function ReadOnlyPrimitive({ openedPrimitive }: { openedPrimitive: DataDTOs.Primitive }) {
  const { kind, description, file, layerName, headers } = openedPrimitive.data;
  return (
    <div className="space-y-3.5">
      <Alert className="rounded-xl border-[#7c3aed33] bg-[#f6f2ff]">
        <AlertTitle className="text-[12.5px] font-bold">{layerName === "vendor" ? "Installed from a vendor, and read-only here." : "Built into cw, and read-only here."}</AlertTitle>
        <AlertDescription className="text-[11.5px] text-zinc-600">To differ from it, author a primitive of your own under an identity of its own.</AlertDescription>
      </Alert>
      <div className={FORM_ROWS}>
        <FormRow label="kind">
          <span className="font-mono text-[11.5px]">{kind}</span>
        </FormRow>
        <FormRow label="file">
          <span className="font-mono text-[11.5px]">{file}</span>
        </FormRow>
        <FormRow label="description">
          <span className="text-xs">{description}</span>
        </FormRow>
        {Object.entries(headers)
          .filter(([field]) => field !== "id" && field !== "description")
          .map(([field, value]) => (
            <FormRow key={field} label={field}>
              <span className="font-mono text-[11.5px]">{typeof value === "string" ? value : value.join(", ")}</span>
            </FormRow>
          ))}
      </div>
      <PrimitiveBody body={openedPrimitive.data.body} />
    </div>
  );
}

/** The box the form's rows are drawn in, a rule between each. */
const FORM_ROWS = "overflow-hidden rounded-[11px] border border-[#f0f0f0] bg-background divide-y divide-zinc-100";

/** One row of the form: the header's name, what answers it, and a hint. */
function FormRow({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string | undefined; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-[13px] py-2.5">
      <Label htmlFor={htmlFor} className="w-[118px] shrink-0 text-[10.5px] font-bold tracking-[0.06em] text-zinc-400 uppercase">
        {label}
      </Label>
      <div className="min-w-0 flex-1">{children}</div>
      {hint !== undefined && <span className="max-w-[45%] shrink text-right text-[11.5px] text-zinc-400">{hint}</span>}
    </div>
  );
}

/** A list answered a box per entry, so one glob is changed on its own; one
 *  empty box where there are none yet. */
function ListAnswer({ field, entries, onChange }: { field: string; entries: readonly string[]; onChange: (entries: string[]) => void }) {
  const shownEntries = entries.length === 0 ? [""] : entries;
  return (
    <div className="flex flex-col gap-1.5">
      {shownEntries.map((entry, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <Input
            id={index === 0 ? `header-${field}` : undefined}
            aria-label={`${field} ${index + 1}`}
            spellCheck={false}
            value={entry}
            onChange={(event) => onChange(shownEntries.map((one, at) => (at === index ? event.currentTarget.value : one)))}
          />
          {shownEntries.length > 1 && (
            <Button
              variant="outline"
              size="icon"
              className="size-[26px] shrink-0 rounded-[7px] text-zinc-400 [&_svg:not([class*='size-'])]:size-[11px]"
              aria-label={`Remove this ${field} entry`}
              onClick={() => onChange(shownEntries.filter((_, at) => at !== index))}
            >
              <X />
            </Button>
          )}
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="h-auto self-start rounded-[7px] border-dashed border-zinc-300 px-2.5 py-[5px] text-[11px] font-normal text-zinc-500"
        onClick={() => onChange([...shownEntries, ""])}
      >
        Add {field}
      </Button>
    </div>
  );
}

/** What the engine refused, in its words (Story 6 scenario 2). */
function Refusals({ faults }: { faults: readonly DataDTOs.Fault[] }) {
  return (
    <Alert variant="destructive" className="rounded-xl border-[#f6d9d9] bg-[#fef6f6]">
      <AlertTitle className="text-[12.5px] font-bold text-foreground">Refused, and nothing was written</AlertTitle>
      <AlertDescription>
        {faults.map(({ data: { message, fix } }) => (
          <p key={message} className="whitespace-pre-line">
            {message} <span className="text-muted-foreground">{fix}</span>
          </p>
        ))}
      </AlertDescription>
    </Alert>
  );
}
