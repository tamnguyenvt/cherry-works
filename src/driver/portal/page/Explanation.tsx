import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { DataDTOs, OutcomeDTOs } from "#hexagon/port/driver/dtos/index.js";
import { client } from "./client.js";

/** What asking for one explanation can come back as: the explanation, the
 *  faults of a charter the engine will not read, or the one fault of an
 *  identity it holds nothing of — raised, so the routes' types do not carry it
 *  (plan §12.2). */
type Answered = OutcomeDTOs.ExplanationOutcome | DataDTOs.FaultsByFile | DataDTOs.Fault;

/**
 * Everything the engine says about one primitive, the answer `cw explain`
 * prints: what it is, when it comes up, what it pulls in, what lends from it
 * or cites it, the test cases naming it, and its file and layer (FR-029).
 *
 * Every identity in it opens that primitive's own explanation (FR-116): which
 * primitives those are is the engine's answer, so nothing here works a
 * relation out.
 */
export function Explanation({ identity, onExplain }: { identity: string; onExplain: (identity: string) => void }) {
  const [answered, setAnswered] = useState<Answered | null>(null);

  useEffect(() => {
    void (async () => {
      // An identity is `kind:id`, and the route takes the two apart so no colon
      // is sent in a path.
      const separator = identity.indexOf(":");
      const kind = identity.slice(0, separator);
      const id = identity.slice(separator + 1);
      const response = await client.charter.root.primitives[":kind"][":id"].explanation.$get({ param: { kind, id } });
      setAnswered((await response.json()) as Answered);
    })();
  }, [identity]);

  if (answered === null) return null;
  if (answered.type === "Fault")
    return (
      <ExplanationSection title="Not in this charter">
        {answered.data.message} <span class="quiet">{answered.data.fix}</span>
      </ExplanationSection>
    );
  if (answered.type === "FaultsByFile")
    return <ExplanationSection title="Not read">The engine will not read this charter, so there is nothing to explain.</ExplanationSection>;

  const { scopedPrimitive, activatesWhen, useMixins, rationale, hosts, citers, testCasesByFile } = answered.data;
  const { kind, description, file, scope, headers } = scopedPrimitive.data;
  const linkTo = ({ data }: DataDTOs.ScopedPrimitive) => (
    <button key={data.identity} class="idlink" onClick={() => onExplain(data.identity)}>
      {data.identity}
    </button>
  );
  // A rationale the charter holds no corpus for is still what the author
  // wrote, so it is said, and said not to resolve, rather than left out.
  const unresolvedRationale = rationale === undefined && typeof headers.rationale === "string" ? headers.rationale : undefined;
  const testCases = Object.entries(testCasesByFile.data);
  // What this one primitive declared, beside what its kind says of all of
  // them: "the harness runs what it says to `run`" is read with what it says.
  // Its id and description are said above.
  const declaredHeaders = Object.entries(headers).filter(([name]) => name !== "id" && name !== "description");

  return (
    <>
      <ExplanationSection title="What it is">
        <b>{kind}</b> — {description}
      </ExplanationSection>
      <ExplanationSection title="When it comes up">{activatesWhen}</ExplanationSection>
      {declaredHeaders.length > 0 && (
        <ExplanationSection title="What it declares">
          {declaredHeaders.map(([name, value]) => (
            <div key={name} class="declared">
              <span class="mono header-name">{name}</span> <span class="mono">{typeof value === "string" ? value : value.join(", ")}</span>
            </div>
          ))}
        </ExplanationSection>
      )}
      {(useMixins.length > 0 || rationale !== undefined || unresolvedRationale !== undefined) && (
        <ExplanationSection title="What it pulls in">
          {useMixins.map((one) => (
            <div key={one.data.identity}>
              {linkTo(one)} <span class="quiet">lends its body</span>
            </div>
          ))}
          {rationale !== undefined && (
            <div>
              {linkTo(rationale)} <span class="quiet">the reasoning it cites</span>
            </div>
          )}
          {unresolvedRationale !== undefined && (
            <div>
              <span class="mono bad">{unresolvedRationale}</span> <span class="bad">(does not resolve)</span>
            </div>
          )}
        </ExplanationSection>
      )}
      {hosts.length > 0 && (
        <ExplanationSection title="Lent to">
          {hosts.map((one) => (
            <div key={one.data.identity}>{linkTo(one)}</div>
          ))}
        </ExplanationSection>
      )}
      {citers.length > 0 && (
        <ExplanationSection title="Cited by">
          {citers.map((one) => (
            <div key={one.data.identity}>{linkTo(one)}</div>
          ))}
        </ExplanationSection>
      )}
      <ExplanationSection title="Tested by">
        {testCases.length === 0 ? (
          <span class="quiet">No test case names it.</span>
        ) : (
          testCases.map(([testFile, situations]) => (
            <div key={testFile} class="cases">
              <span class="mono">{testFile}</span>
              {situations.map((situation) => (
                <div key={situation} class="mono case">
                  {situation}
                </div>
              ))}
            </div>
          ))
        )}
      </ExplanationSection>
      <ExplanationSection title="File">
        <span class="mono">{file}</span> <span class="quiet">in the {scope} layer</span>
      </ExplanationSection>
    </>
  );
}

/** One titled part of the explanation. */
function ExplanationSection({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <div class="xsec">
      <div class="xsec-t">{title}</div>
      <div class="xsec-b">{children}</div>
    </div>
  );
}
