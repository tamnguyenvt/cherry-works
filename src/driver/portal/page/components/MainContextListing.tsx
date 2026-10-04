import { useMainContexts, useSettings } from "../queries.js";

/**
 * What the charter puts into each agent's main context when a session opens,
 * as `cw context` lists it (EVAL-FR-007): one row per primitive, the largest
 * first, the total, said to be an estimate, and held to the repository's
 * ceiling; apart, every guide loaded only when a file it names is touched.
 * Nothing is counted or ordered here; the engine did both.
 */
export function MainContextListing() {
  const mainContextsQuery = useMainContexts();
  const settingsQuery = useSettings();

  if (mainContextsQuery.data === undefined) return null;
  if (mainContextsQuery.data.type !== "MainContexts")
    return <p className="text-xs text-zinc-500">Nothing was counted: the charter does not hold. Open Doctor to see why.</p>;

  const { contexts } = mainContextsQuery.data.data;
  if (contexts.length === 0) return <p className="text-xs text-zinc-500">No agent is chosen, so no agent loads anything of the charter.</p>;
  const contextCeiling = settingsQuery.data?.data.contextCeiling;

  return (
    <div className="space-y-6">
      {contexts.map(({ data: { agent, isExact, sessionLoads, fileLoads, totalTokens } }) => (
        <section key={agent} className="space-y-3" aria-label={`${agent} main context`}>
          <h2 className="text-[13px] font-semibold">
            {agent} opens a session with {totalTokens.toLocaleString("en-US")} tokens of the charter, {isExact ? "counted exactly" : "estimated"}
            {contextCeiling !== undefined && (
              <span className={totalTokens > contextCeiling ? "text-[#b45309]" : "text-zinc-400"}>
                {" "}
                · {totalTokens > contextCeiling ? "past" : "within"} the ceiling of {contextCeiling.toLocaleString("en-US")}
              </span>
            )}
          </h2>
          {(
            [
              ["Loaded when a session opens", sessionLoads],
              ["Loaded when a file it names is touched, not in the total", fileLoads],
            ] as const
          ).map(
            ([heading, loads]) =>
              loads.length > 0 && (
                <div key={heading} className="space-y-1.5">
                  <h3 className="text-[10.5px] font-bold tracking-[0.06em] text-zinc-400 uppercase">{heading}</h3>
                  <table className="w-full overflow-hidden rounded-[11px] border border-[#f0f0f0] text-xs" aria-label={heading}>
                    <tbody>
                      {loads.map(({ data: { id, kind, tokens, globs } }) => (
                        <tr key={id} className="border-b border-zinc-100 last:border-b-0">
                          <td className="w-[90px] px-[13px] py-2 text-right font-mono">{tokens.toLocaleString("en-US")}</td>
                          <td className="w-[90px] px-2 py-2 text-zinc-500">{kind}</td>
                          <td className="px-2 py-2 font-mono">{id}</td>
                          <td className="px-2 py-2 font-mono text-zinc-400">{globs?.join(", ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ),
          )}
        </section>
      ))}
    </div>
  );
}
