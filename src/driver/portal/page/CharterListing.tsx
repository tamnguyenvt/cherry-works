import { useEffect, useState } from "preact/hooks";
import type { DataDTOs } from "#hexagon/port/driver/dtos/index.js";
import { client } from "./client.js";

type Scope = DataDTOs.ScopedPrimitive["data"]["scope"];

/** What one showing of this view was answered with: every kind there is, and
 *  what the charter holds — or, where the charter does not hold, the faults it
 *  was refused for in place of a listing. */
type Held = {
  kinds: DataDTOs.PrimitiveKinds["data"];
  listing: DataDTOs.ScopedPrimitives | DataDTOs.FaultsByFile;
};

/**
 * One tab's layers of the charter, by kind: a chip per kind carrying how many
 * primitives of it those layers hold, the line saying when that kind comes up,
 * and the primitives themselves (FR-112, FR-113).
 *
 * Both answers are asked for when this is mounted, and this is mounted when the
 * tab is shown, so what is drawn is the charter as it is on disk now and no
 * copy of it outlives the view (FR-110).
 *
 * Every kind there is has a chip, not only the kinds something was authored of:
 * a charter holding no posture is a charter one can be written in, and the chip
 * is where a reader finds that out. Which kinds those are, and what each line
 * says, is the engine's answer rather than a list kept here (FR-113). Which
 * layer each primitive arrived in is the engine's answer too: `scopes` only
 * says which of them this tab shows.
 */
export function CharterListing({ scopes, onExplain }: { scopes: readonly Scope[]; onExplain: (identity: string) => void }) {
  const [held, setHeld] = useState<Held | null>(null);
  const [kind, setKind] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [kindsDTO, scopedPrimitivesDTO] = await Promise.all([
        (await client.definitions.kinds.$get()).json(),
        (await client.charter.root.primitives.$get({ query: {} })).json(),
      ]);
      setHeld({ kinds: kindsDTO.data, listing: scopedPrimitivesDTO });
    })();
  }, []);

  if (held === null) return null;
  // A charter the engine will not read is not a charter holding nothing: what
  // is wrong with it is what there is to show, under each file (FR-115).
  if (held.listing.type === "FaultsByFile") return <CharterFaults faultsByFile={held.listing} />;

  const primitives = held.listing.data.primitives.filter(({ data }) => scopes.includes(data.scope));
  const counts = new Map(
    Object.keys(held.kinds).map((one) => [one, primitives.filter(({ data }) => data.kind === one).length]),
  );
  // What is shown until a chip is picked: the first kind anything was authored
  // of, so a reader lands on a table rather than on an empty state, and the
  // first kind there is where these layers hold nothing at all.
  const shown = kind ?? [...counts].find(([, count]) => count > 0)?.[0] ?? Object.keys(held.kinds)[0]!;
  const listed = primitives.filter(({ data }) => data.kind === shown);

  return (
    <>
      <div class="sec-head2">
        Charter primitives<span>{primitives.length} in this charter</span>
      </div>

      <div class="chips">
        {[...counts].map(([one, count]) => (
          <button key={one} class={one === shown ? "chip on" : "chip"} onClick={() => setKind(one)}>
            <span>{one}</span>
            <b>{count}</b>
          </button>
        ))}
      </div>

      <div class="actnote">
        <b>Activates when</b>
        <span>{held.kinds[shown]}</span>
      </div>

      {listed.length === 0 ? (
        <div class="mem-empty">No {shown} in this charter yet.</div>
      ) : (
        <Rows kind={shown} listed={listed} onExplain={onExplain} />
      )}
    </>
  );
}

/** Every file the engine refused, with what is wrong with it and how to put it
 *  right, in the words the engine gave — the faults `cw doctor` prints (FR-115). */
function CharterFaults({ faultsByFile }: { faultsByFile: DataDTOs.FaultsByFile }) {
  const files = Object.entries(faultsByFile.data.files);
  return (
    <>
      <div class="refused">
        <i />
        <b>The engine will not read this charter</b>
        <span>
          {files.length} file{files.length === 1 ? " is" : "s are"} refused, so there is no listing to show. Fix
          {files.length === 1 ? " it" : " them"} and the charter comes back.
        </span>
      </div>
      <div class="panel">
        {files.map(([file, faults]) => (
          <div key={file} class="dcrow">
            <span class="dcfile">{file}</span>
            <span class="dcfaults">
              {faults.map(({ data: { message, fix } }) => (
                <span key={message}>
                  {message} <i>{fix}</i>
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </>
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
 * into its explanation (FR-116).
 *
 * The columns follow the kind, because what a primitive is brought up by is its
 * kind's own contract: a guide is brought up by the globs it matches, and cites
 * a corpus for why; every kind but a mixin may pull mixins in, and a mixin may
 * not, so it has no column for them.
 */
function Rows({
  kind,
  listed,
  onExplain,
}: {
  kind: string;
  listed: DataDTOs.ScopedPrimitives["data"]["primitives"];
  onExplain: (identity: string) => void;
}) {
  const guide = kind === "guide";
  const mixing = kind !== "mixin";
  const shape = guide ? "chrow g" : mixing ? "chrow n" : "chrow m";

  return (
    <div class="panel">
      <div class={`${shape} chhead`}>
        <span>Id</span>
        <span>Description</span>
        {guide && (
          <>
            <span class="right">Matching globs</span>
            <span class="right">Rationale</span>
          </>
        )}
        {mixing && <span class="right">Mixins</span>}
        <span />
      </div>
      {listed.map(({ data: { identity, description, file, headers } }) => {
        const globs = namedIn(headers.globs);
        return (
          <div key={identity} class={shape} title={file}>
            <span class="cid">{headers.id}</span>
            <span class="cbd">
              <span class="cn">{description}</span>
              <span class="cp">{file}</span>
            </span>
            {guide && (
              <>
                {/* A guide declaring no globs is carried on every turn, as if it
                    matched every file, which is worth reading as something
                    rather than as a blank. */}
                <Chips named={globs} none="all patterns" said={globs === undefined} />
                <Chips named={namedIn(headers.rationale)} none="none" said={false} />
              </>
            )}
            {mixing && <Chips named={namedIn(headers.mixins)} none="none" said={false} />}
            <ExplainButton identity={identity} onExplain={onExplain} />
          </div>
        );
      })}
    </div>
  );
}

/** The way into one primitive's explanation, on every row that lists one
 *  (FR-116). */
export function ExplainButton({ identity, onExplain }: { identity: string; onExplain: (identity: string) => void }) {
  return (
    <button class="xpl" title={`Explain ${identity}`} aria-label={`Explain ${identity}`} onClick={() => onExplain(identity)}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M9.6 9.3a2.5 2.5 0 1 1 3.2 3.1c-.5.2-.8.7-.8 1.3v.3" />
        <path d="M12 17.2v.01" />
      </svg>
    </button>
  );
}

/** One cell of what a primitive named — globs, a rationale, mixins — or the
 *  word for having named none, said plainly where nothing being there is worth
 *  noticing and quietly where it is ordinary. */
function Chips({ named, none, said }: { named: readonly string[] | undefined; none: string; said: boolean }) {
  return (
    <span class="cgl">
      {named === undefined || named.length === 0 ? (
        <i class={said ? "said" : ""}>{none}</i>
      ) : (
        named.map((one) => (
          <span key={one} title={one}>
            {one}
          </span>
        ))
      )}
    </span>
  );
}
