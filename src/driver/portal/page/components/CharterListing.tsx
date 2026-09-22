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
 * One tab's layers of the charter, by kind: a chip per kind carrying how many
 * primitives of it those layers hold, the line saying when that kind comes up,
 * and the primitives themselves (FR-112, FR-113).
 *
 * Both answers are asked for when this is mounted, and this is mounted when the
 * tab is shown, so what is drawn is the charter as it is on disk now (FR-110).
 *
 * Every kind there is has a chip, not only the kinds something was authored of:
 * a charter holding no posture is a charter one can be written in, and the chip
 * is where a reader finds that out. Which kinds those are, and what each line
 * says, is the engine's answer rather than a list kept here (FR-113). Which
 * layer each primitive arrived in is the engine's answer too: `scopes` only
 * says which of them this tab shows.
 */
export function CharterListing({
  scopes,
  kind,
  onKindChange,
}: {
  scopes: readonly DataDTOs.ScopedPrimitive["data"]["scope"][];
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

  const primitives = listing.data.primitives.filter(({ data }) => scopes.includes(data.scope));
  const counts = new Map(Object.keys(kinds).map((one) => [one, primitives.filter(({ data }) => data.kind === one).length]));
  // What is shown until a chip is picked: the first kind anything was authored
  // of, so a reader lands on a table rather than on an empty state, and the
  // first kind there is where these layers hold nothing at all.
  const shown = kind ?? [...counts].find(([, count]) => count > 0)?.[0] ?? Object.keys(kinds)[0]!;
  const listed = primitives.filter(({ data }) => data.kind === shown);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-2">
        <h2 className="font-semibold">Charter primitives</h2>
        <span className="text-sm text-muted-foreground">{primitives.length} in this charter</span>
        {/* A new primitive is written in this repository's own layer, so only
            the tab listing it offers one. */}
        {scopes.includes("repo") && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => open("newPrimitive", { kind: shown })}>
            New {shown}
          </Button>
        )}
      </div>

      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label="Kinds"
        className="flex-wrap"
        value={shown}
        // A chip clicked again stays on: some kind is always shown.
        onValueChange={(value) => value !== "" && onKindChange(value)}
      >
        {[...counts].map(([one, count]) => (
          <ToggleGroupItem key={one} value={one} aria-label={one} className="gap-2 px-3">
            {one}
            <Badge variant="secondary">{count}</Badge>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <p className="text-sm">
        <span className="mr-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Activates when</span>
        <span aria-label="Activates when">{kinds[shown]}</span>
      </p>

      {listed.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No {shown} in this charter yet.</p>
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
    <div className="space-y-4">
      <Alert variant="destructive">
        <AlertTitle>The engine will not read this charter</AlertTitle>
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
    <Alert variant="destructive">
      <AlertTitle>{fault.data.message}</AlertTitle>
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
function Rows({ kind, listed }: { kind: string; listed: DataDTOs.ScopedPrimitives["data"]["primitives"] }) {
  const { open } = useDialog();
  const guide = kind === "guide";
  const mixing = kind !== "mixin";

  return (
    <Table aria-label={`${kind} primitives`}>
      <TableHeader>
        <TableRow>
          <TableHead>Id</TableHead>
          <TableHead>Description</TableHead>
          {guide && (
            <>
              <TableHead className="text-right">Matching globs</TableHead>
              <TableHead className="text-right">Rationale</TableHead>
            </>
          )}
          {mixing && <TableHead className="text-right">Mixins</TableHead>}
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {listed.map(({ data: { identity, description, file, headers } }) => {
          const globs = namedIn(headers.globs);
          return (
            <TableRow key={identity}>
              <TableCell>
                <Button variant="link" className="h-auto p-0 font-mono font-semibold" title={`Open ${file}`} onClick={() => open("primitive", { identity })}>
                  {String(headers.id)}
                </Button>
              </TableCell>
              <TableCell className="whitespace-normal">
                <div className="font-medium">{description}</div>
                <div className="font-mono text-xs text-muted-foreground">{file}</div>
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
              <TableCell className="w-8">
                <Button variant="ghost" size="icon" className="size-7" aria-label={`Explain ${identity}`} onClick={() => open("explanation", { identity })}>
                  <CircleHelp />
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/** One cell of what a primitive named — globs, a rationale, mixins — or the
 *  word for having named none, said plainly where nothing being there is worth
 *  noticing and quietly where it is ordinary. */
function Chips({ named, none, said, label }: { named: readonly string[] | undefined; none: string; said: boolean; label: string }) {
  return (
    <TableCell aria-label={label}>
      <div className="flex flex-wrap justify-end gap-1">
        {named === undefined || named.length === 0 ? (
          <span className={said ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{none}</span>
        ) : (
          named.map((one) => (
            <Badge key={one} variant="secondary" className="font-mono">
              {one}
            </Badge>
          ))
        )}
      </div>
    </TableCell>
  );
}
