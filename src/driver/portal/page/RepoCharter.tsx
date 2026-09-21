import { useEffect, useState } from "preact/hooks";
import type { DataDTOs } from "#hexagon/port/driver/dtos/index.js";
import { client } from "./client.js";

/** What one showing of this view was answered with: every kind there is, and
 *  what the charter holds — or, where the charter does not hold, the faults it
 *  was refused for in place of a listing. */
type Held = {
  kinds: DataDTOs.PrimitiveKinds["data"];
  listing: DataDTOs.Catalogue | DataDTOs.FaultsByFile;
};

/**
 * The repository's charter, by kind: a chip per kind carrying how many
 * primitives of it are held, the line saying when that kind comes up, and the
 * primitives themselves (FR-009, FR-010).
 *
 * Both answers are asked for when this is mounted, and this is mounted when the
 * tab is shown, so what is drawn is the charter as it is on disk now and no
 * copy of it outlives the view (FR-007).
 *
 * Every kind there is has a chip, not only the kinds something was authored of:
 * a charter holding no posture is a charter one can be written in, and the chip
 * is where a reader finds that out. Which kinds those are, and what each line
 * says, is the engine's answer rather than a list kept here (FR-005).
 */
export function RepoCharter() {
  const [held, setHeld] = useState<Held | null>(null);
  const [kind, setKind] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [kindsDTO, catalogueDTO] = await Promise.all([
        (await client.definitions.kinds.$get()).json(),
        (await client.charter.root.primitives.$get()).json(),
      ]);
      setHeld({ kinds: kindsDTO.data, listing: catalogueDTO });
    })();
  }, []);

  if (held === null) return null;
  // A charter the engine will not read is not a charter holding nothing: what
  // is wrong with it is what there is to show, under each file (T2.106).
  if (held.listing.type === "FaultsByFile")
    return <div class="mem-empty">The engine will not read this charter, so there is no listing to show.</div>;

  const entries = held.listing.data.entries;
  const counts = new Map(
    Object.keys(held.kinds).map((one) => [one, entries.filter(({ data }) => data.kind === one).length]),
  );
  // What is shown until a chip is picked: the first kind anything was authored
  // of, so a reader lands on a table rather than on an empty state, and the
  // first kind there is where a charter holds nothing at all.
  const shown = kind ?? [...counts].find(([, count]) => count > 0)?.[0] ?? Object.keys(held.kinds)[0]!;
  const listed = entries.filter(({ data }) => data.kind === shown);

  return (
    <>
      <div class="sec-head2">
        Charter primitives<span>{entries.length} in this charter</span>
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
        <Rows kind={shown} listed={listed} />
      )}
    </>
  );
}

/**
 * The primitives of one kind, a row each: what it is called, what it is for,
 * the file it is in, and what its kind is pinned down by (FR-010).
 *
 * The columns follow the kind, because what a primitive is brought up by is its
 * kind's own contract: a guide is brought up by the globs it matches, and cites
 * a corpus for why; every kind but a mixin may pull mixins in, and a mixin may
 * not, so it has no column for them.
 */
function Rows({ kind, listed }: { kind: string; listed: DataDTOs.Catalogue["data"]["entries"] }) {
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
      </div>
      {listed.map(({ data: { identity, id, description, file, globs, rationale, mixins } }) => (
        <div key={identity} class={shape} title={file}>
          <span class="cid">{id}</span>
          <span class="cbd">
            <span class="cn">{description}</span>
            <span class="cp">{file}</span>
          </span>
          {guide && (
            <>
              {/* A guide declaring no globs is carried on every turn, which is
                  worth reading as something rather than as a blank. */}
              <Chips named={globs} none="no globs" said={globs === undefined} />
              <Chips named={rationale === undefined ? undefined : [rationale]} none="none" said={false} />
            </>
          )}
          {mixing && <Chips named={mixins} none="none" said={false} />}
        </div>
      ))}
    </div>
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
