import type { ReactNode } from "react";
import type { DataDTOs } from "#hexagon/port/driver/dtos/index.js";
import { useExplanation } from "../queries.js";
import { Button } from "./ui/button.js";
import { Separator } from "./ui/separator.js";

/**
 * Everything the engine says about one primitive, the answer `cw explain`
 * prints: what it is, when it comes up, what it pulls in, what lends from it
 * or cites it, the test cases naming it, and its file and layer (FR-029).
 *
 * Every identity in it opens that primitive's own explanation (FR-116): which
 * primitives those are is the engine's answer, so nothing here works a
 * relation out.
 */
export function PrimitiveExplanation({ identity, onExplain }: { identity: string; onExplain: (identity: string) => void }) {
  const { data: answered } = useExplanation(identity);

  if (answered === undefined) return null;
  if (answered.type === "Fault")
    return (
      <ExplanationSection title="Not in this charter">
        {answered.data.message} <span className="text-muted-foreground">{answered.data.fix}</span>
      </ExplanationSection>
    );
  if (answered.type === "FaultsByFile")
    return <ExplanationSection title="Not read">The engine will not read this charter, so there is nothing to explain.</ExplanationSection>;

  const { scopedPrimitive, activatesWhen, useMixins, rationale, hosts, citers, testCasesByFile } = answered.data;
  const { kind, description, file, scope, headers } = scopedPrimitive.data;
  const linkTo = ({ data }: DataDTOs.ScopedPrimitive) => (
    <Button key={data.identity} variant="link" className="h-auto p-0 font-mono text-xs" onClick={() => onExplain(data.identity)}>
      {data.identity}
    </Button>
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
    <div className="space-y-3">
      <ExplanationSection title="What it is">
        <b>{kind}</b> — {description}
      </ExplanationSection>
      <ExplanationSection title="When it comes up">{activatesWhen}</ExplanationSection>
      {declaredHeaders.length > 0 && (
        <ExplanationSection title="What it declares">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
            {declaredHeaders.map(([name, value]) => (
              <div key={name} className="contents">
                <dt className="text-muted-foreground">{name}</dt>
                <dd>{typeof value === "string" ? value : value.join(", ")}</dd>
              </div>
            ))}
          </dl>
        </ExplanationSection>
      )}
      {(useMixins.length > 0 || rationale !== undefined || unresolvedRationale !== undefined) && (
        <ExplanationSection title="What it pulls in">
          {useMixins.map((one) => (
            <div key={one.data.identity}>
              {linkTo(one)} <span className="text-muted-foreground">lends its body</span>
            </div>
          ))}
          {rationale !== undefined && (
            <div>
              {linkTo(rationale)} <span className="text-muted-foreground">the reasoning it cites</span>
            </div>
          )}
          {unresolvedRationale !== undefined && (
            <div className="text-destructive">
              <span className="font-mono">{unresolvedRationale}</span> (does not resolve)
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
          <span className="text-muted-foreground">No test case names it.</span>
        ) : (
          testCases.map(([testFile, situations]) => (
            <div key={testFile}>
              <span className="font-mono text-xs">{testFile}</span>
              {situations.map((situation) => (
                <div key={situation} className="pl-3 font-mono text-xs">
                  {situation}
                </div>
              ))}
            </div>
          ))
        )}
      </ExplanationSection>
      <ExplanationSection title="File">
        <span className="font-mono text-xs">{file}</span> <span className="text-muted-foreground">in the {scope} layer</span>
      </ExplanationSection>
    </div>
  );
}

/** One titled part of the explanation, a region named by its title. */
function ExplanationSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-1">
      <Separator />
      <h3 className="pt-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{title}</h3>
      <div className="text-sm">{children}</div>
    </section>
  );
}
