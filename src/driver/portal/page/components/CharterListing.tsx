import { CircleHelp } from "lucide-react";
import type { DataDTOs } from "#hexagon/port/driver/dtos/index.js";
import { useKinds, usePrimitives } from "../queries.js";
import { useDialog } from "./Dialogs.js";
import { FaultsByFileTable } from "./FaultsByFileTable.js";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert.js";
import { Badge } from "./ui/badge.js";
import { Button } from "./ui/button.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table.js";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group.js";

/**
 * One tab's layerNames of the charter, by kind: a chip per kind carrying how many
 * primitives of it those layerNames hold, the line saying when that kind comes up,
 * and the primitives themselves (FR-112, FR-113).
 *
 * Both answers are asked for when this is mounted, and this is mounted when the
 * tab is shown, so what is drawn is the charter as it is on disk now (FR-110).
 *
 * Every kind there is has a chip, not only the kinds something was authored of:
 * a charter holding no posture is a charter one can be written in, and the chip
 * is where a reader finds that out. Which kinds those are, and what each line
 * says, is the engine's answer rather than a list kept here (FR-113). Which
 * layer each primitive arrived in is the engine's answer too: `layerNames` only
 * says which of them this tab shows.
 */
export function CharterListing({
  layerNames,
  kind,
  onKindChange,
}: {
  layerNames: readonly DataDTOs.Primitive["data"]["layerName"][];
  /** The kind whose chip is on, or nothing for the listing's own first choice. */
  kind: string | null;
  onKindChange: (kind: string) => void;
}) {
  const { open } = useDialog();
  const kindsQuery = useKinds();
  const primitivesQuery = usePrimitives();

  if (kindsQuery.data === undefined || primitivesQuery.data === undefined) return null;
  const kinds = kindsQuery.data.data;
  const listing = primitivesQuery.data;
  // A charter the engine will not read is not a charter holding nothing: what
  // is wrong with it is what there is to show, under each file (FR-115).
  if (listing.type === "FaultsByFile") return <CharterFaults faultsByFile={listing} />;
  // Raised rather than given back, such as settings that do not read: said as
  // the engine said it.
  if (listing.type === "Fault") return <RaisedFault fault={listing} />;

  const primitives = listing.data.primitives.filter(({ data }) => layerNames.includes(data.layerName));
  const counts = new Map(Object.keys(kinds).map((one) => [one, primitives.filter(({ data }) => data.kind === one).length]));
  // What is shown until a chip is picked: the first kind anything was authored
  // of, so a reader lands on a table rather than on an empty state, and the
  // first kind there is where these layerNames hold nothing at all.
  const shown = kind ?? [...counts].find(([, count]) => count > 0)?.[0] ?? Object.keys(kinds)[0]!;
  const listed = primitives.filter(({ data }) => data.kind === shown);

  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-baseline gap-[9px]">
        <h2 className="text-[12.5px] font-bold">Charter primitives</h2>
        <span className="text-[11.5px] text-zinc-400">{primitives.length} in this charter</span>
        {/* A new primitive is written in this repository's own layer, so only
            the tab listing it offers one. */}
        {layerNames.includes("repo") && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => open("newPrimitive", { kind: shown })}>
            New {shown}
          </Button>
        )}
      </div>

      <ToggleGroup
        type="single"
        spacing={1.5}
        aria-label="Kinds"
        className="mb-3 flex-wrap"
        value={shown}
        // A chip clicked again stays on: some kind is always shown.
        onValueChange={(value) => value !== "" && onKindChange(value)}
      >
        {[...counts].map(([one, count]) => (
          <ToggleGroupItem
            key={one}
            value={one}
            aria-label={one}
            className={`group/chip h-auto cursor-pointer gap-1.5 rounded-[9px] border bg-background px-2.5 py-1.5 text-[11.5px] font-medium text-zinc-700 capitalize hover:bg-background hover:text-zinc-700 data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:font-semibold data-[state=on]:text-white ${count === 0 && one !== shown ? "opacity-50" : ""}`}
          >
            {one}
            <Badge className="rounded-none bg-transparent p-0 font-mono text-[10px] font-normal text-zinc-400 group-data-[state=on]/chip:text-white/70">{count}</Badge>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <p className="mb-2.5 flex items-baseline gap-2 px-0.5">
        <span className="shrink-0 text-[10.5px] font-bold tracking-[0.06em] text-zinc-400 uppercase">Activates when</span>
        <span className="text-xs leading-normal text-zinc-700" aria-label="Activates when">
          {kinds[shown]}
        </span>
      </p>

      {listed.length === 0 ? (
        <p className="rounded-[14px] border p-[22px] text-center text-[12.5px] text-zinc-400">No {shown} in this charter yet.</p>
      ) : (
        <Rows kind={shown} listed={listed} />
      )}
    </div>
  );
}

/** Every file the engine refused, with what is wrong with it and how to put it
 *  right, in the words the engine gave — the faults `cw doctor` prints (FR-115). */
function CharterFaults({ faultsByFile }: { faultsByFile: DataDTOs.FaultsByFile }) {
  const files = Object.entries(faultsByFile.data.files);
  return (
    <div className="space-y-3.5">
      <Alert variant="destructive" className="rounded-xl border-[#f6d9d9] bg-[#fef6f6]">
        <AlertTitle className="text-[12.5px] font-bold text-foreground">The engine will not read this charter</AlertTitle>
        <AlertDescription>
          {files.length} file{files.length === 1 ? " is" : "s are"} refused, so there is no listing to show. Fix
          {files.length === 1 ? " it" : " them"} and the charter comes back.
        </AlertDescription>
      </Alert>
      <FaultsByFileTable faultsByFile={faultsByFile} label="Refused files" />
    </div>
  );
}

/** A fault raised rather than given back — no file is wrong, and nothing is
 *  listed — said as the engine said it. */
function RaisedFault({ fault }: { fault: DataDTOs.Fault }) {
  return (
    <Alert variant="destructive" className="rounded-xl border-[#f6d9d9] bg-[#fef6f6]">
      <AlertTitle className="text-[12.5px] font-bold text-foreground">{fault.data.message}</AlertTitle>
      <AlertDescription>{fault.data.fix}</AlertDescription>
    </Alert>
  );
}

/** A header's value as the list a column shows: a list as it is, one line as a
 *  list of one, and nothing where the author wrote nothing. */
function namedIn(value: string | readonly string[] | undefined): readonly string[] | undefined {
  return value === undefined ? undefined : typeof value === "string" ? [value] : value;
}

/**
 * The primitives of one kind, a row each: what it is called, what it is for,
 * the file it is in, and what its kind is pinned down by (FR-113), with the way
 * into the primitive itself by its id (FR-075) and into its explanation
 * (FR-116).
 *
 * The columns follow the kind, because what a primitive is brought up by is its
 * kind's own contract: a guide is brought up by the globs it matches, and cites
 * a corpus for why; every kind but a mixin may pull mixins in, and a mixin may
 * not, so it has no column for them.
 */
function Rows({ kind, listed }: { kind: string; listed: DataDTOs.Primitives["data"]["primitives"] }) {
  const { open } = useDialog();
  const guide = kind === "guide";
  const mixing = kind !== "mixin";

  return (
    <div className="overflow-hidden rounded-[14px] border bg-background">
      <Table aria-label={`${kind} primitives`} className="table-fixed">
        <TableHeader>
          <TableRow className="border-[#ececef] bg-zinc-50 hover:bg-zinc-50 [&>th]:h-auto [&>th]:px-[15px] [&>th]:py-[9px] [&>th]:text-[9.5px] [&>th]:font-bold [&>th]:tracking-[0.07em] [&>th]:text-zinc-400 [&>th]:uppercase">
            <TableHead className="w-[170px]">Id</TableHead>
            <TableHead>Description</TableHead>
            {guide && (
              <>
                <TableHead className="w-[170px] text-right">Matching globs</TableHead>
                <TableHead className="w-[120px] text-right">Rationale</TableHead>
              </>
            )}
            {mixing && <TableHead className="w-[120px] text-right">Mixins</TableHead>}
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {listed.map(({ data: { identity, description, file, headers } }) => {
            const globs = namedIn(headers.globs);
            return (
              <TableRow key={identity} className="group/row border-[#f7f7f8] align-top hover:bg-zinc-50 [&>td]:px-[15px] [&>td]:py-3">
                <TableCell className="truncate">
                  <Button
                    variant="link"
                    className="block h-auto max-w-full truncate rounded-none p-0 text-left font-mono text-[11.5px] font-bold text-foreground"
                    title={`Open ${file}`}
                    onClick={() => open("primitive", { identity })}
                  >
                    {String(headers.id)}
                  </Button>
                </TableCell>
                <TableCell className="whitespace-normal">
                  <div className="text-[12.5px] font-semibold">{description}</div>
                  <div className="mt-[3px] truncate font-mono text-[10.5px] text-zinc-400">{file}</div>
                </TableCell>
                {guide && (
                  <>
                    {/* A guide declaring no globs is carried on every turn, as if
                        it matched every file, which is worth reading as something
                        rather than as a blank. */}
                    <Chips named={globs} none="all patterns" said={globs === undefined} label="Matching globs" />
                    <Chips named={namedIn(headers.rationale)} none="none" said={false} label="Rationale" />
                  </>
                )}
                {mixing && <Chips named={namedIn(headers.mixins)} none="none" said={false} label="Mixins" />}
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto size-6 rounded-[7px] border border-transparent text-zinc-300 group-hover/row:border-zinc-200 group-hover/row:bg-background group-hover/row:text-zinc-400 hover:!border-foreground hover:bg-background hover:!text-foreground [&_svg:not([class*='size-'])]:size-[13px]"
                    aria-label={`Explain ${identity}`}
                    onClick={() => open("explanation", { identity })}
                  >
                    <CircleHelp />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/** One cell of what a primitive named — globs, a rationale, mixins — or the
 *  word for having named none, said plainly where nothing being there is worth
 *  noticing and quietly where it is ordinary. */
function Chips({ named, none, said, label }: { named: readonly string[] | undefined; none: string; said: boolean; label: string }) {
  return (
    <TableCell aria-label={label}>
      <div className="flex min-w-0 flex-wrap content-start justify-end gap-1">
        {named === undefined || named.length === 0 ? (
          <span className={`text-[10.5px] ${said ? "text-destructive" : "text-zinc-300"}`}>{none}</span>
        ) : (
          named.map((one) => (
            <Badge key={one} title={one} className="block max-w-full truncate rounded-[5px] bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] font-normal text-zinc-700">
              {one}
            </Badge>
          ))
        )}
      </div>
    </TableCell>
  );
}
