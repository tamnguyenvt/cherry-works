import { useEffect, useState } from "preact/hooks";
import type { DataDTOs } from "#hexagon/port/driver/dtos/index.js";
import { client } from "./client.js";
import { ExplainButton } from "./CharterListing.js";

/**
 * Every primitive of every layer mentioning a word, in place of the tabs
 * (FR-114). Which ones mention it is the engine's answer: the word is sent, and
 * what comes back is shown, so the page holds no rule of what matches.
 *
 * Asked again for every word typed. An answer arriving after the word has
 * changed is dropped, so what is drawn is always the answer to what the box
 * says now.
 */
export function SearchResults({
  word,
  onClear,
  onExplain,
}: {
  word: string;
  onClear: () => void;
  onExplain: (identity: string) => void;
}) {
  const [listing, setListing] = useState<DataDTOs.ScopedPrimitives | DataDTOs.FaultsByFile | null>(null);

  useEffect(() => {
    let answerSuperseded = false;
    void (async () => {
      const scopedPrimitivesDTO = await (await client.charter.root.primitives.$get({ query: { matching: word } })).json();
      if (!answerSuperseded) setListing(scopedPrimitivesDTO);
    })();
    return () => {
      answerSuperseded = true;
    };
  }, [word]);

  if (listing === null) return null;
  if (listing.type === "FaultsByFile")
    return <div class="mem-empty">The engine will not read this charter, so there is nothing to search.</div>;

  const { primitives } = listing.data;
  return (
    <>
      <div class="sec-head2">
        Search
        <span>
          {primitives.length} primitive{primitives.length === 1 ? "" : "s"} matching <b class="mono">{word}</b>
        </span>
        <button class="btn small" onClick={onClear}>
          Clear
        </button>
      </div>
      {primitives.length === 0 ? (
        <div class="mem-empty">Nothing in the charter says that.</div>
      ) : (
        <div class="panel">
          <div class="chrow s chhead">
            <span>Identity</span>
            <span>Description</span>
            <span />
          </div>
          {primitives.map(({ data: { identity, description, file } }) => (
            <div key={identity} class="chrow s" title={file}>
              <span class="cid">{identity}</span>
              <span class="cbd">
                <span class="cn">{description}</span>
                <span class="cp">{file}</span>
              </span>
              <ExplainButton identity={identity} onExplain={onExplain} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
