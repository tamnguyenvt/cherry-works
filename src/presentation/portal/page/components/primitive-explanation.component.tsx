import type { ReactNode } from "react";
import type { CharterDTOs } from "#module/charter/module.js";
import { useExplanation } from "../portal.queries.js";
import { Button } from "./ui/button.js";

/**
 * Everything the engine says about one primitive, the answer `cw explain`
 * prints: what it is, when it comes up, what it pulls in, what lends from it,
 * cites it or names it, the test cases naming it, and its file and layer
 * (FR-029).
 *
 * Every id in it opens that primitive's own explanation (FR-116): which
 * primitives those are is the engine's answer, so nothing here works a
 * relation out.
 */
export function PrimitiveExplanation({ id, onExplain }: { id: string; onExplain: (id: string) => void }) {
  const { data: explanationAnswer } = useExplanation(id);

  if (explanationAnswer === undefined) return null;
  if (explanationAnswer.type === "Fault")
    return (
      <ExplanationSection title="Not in this charter">
        {explanationAnswer.data.message} <span className="text-muted-foreground">{explanationAnswer.data.fix}</span>
      </ExplanationSection>
    );
  if (explanationAnswer.type === "FaultsByFile")
    return (
      <ExplanationSection title="Not read">
        The engine will not read this charter, so there is nothing to explain.
      </ExplanationSection>
    );

  const { primitive, activatesWhen, useMixins, rationale, usedByPrimitives, citers, mentioners, testCasesByFile } =
    explanationAnswer.data;
  const { kind, description, file: primitiveFilePath, layerName, headers } = primitive.data;
  const renderPrimitiveLink = ({ data: linkedPrimitive }: CharterDTOs.Primitive) => (
    <Button
      key={linkedPrimitive.id}
      variant="link"
      className="h-auto rounded-none p-0 font-mono text-[11.5px] font-normal text-[#1d4ed8] underline underline-offset-2"
      onClick={() => onExplain(linkedPrimitive.id)}
    >
      {linkedPrimitive.id}
    </Button>
  );
  // A rationale the charter holds no corpus for is still what the author
  // wrote, so it is said, and said not to resolve, rather than left out.
  const unresolvedRationaleId =
    rationale === undefined && typeof headers.rationale === "string" ? headers.rationale : undefined;
  const testFileSituationEntries = Object.entries(testCasesByFile.data);
  // What this one primitive declared, beside what its kind says of all of
  // them: "the harness runs what it says to `run`" is read with what it says.
  // Its id and description are said above.
  const declaredHeaders = Object.entries(headers).filter(
    ([headerName]) => headerName !== "id" && headerName !== "description",
  );

  return (
    <div className="-mx-5 -my-[18px]">
      <ExplanationSection title="What it is">
        <b className="font-semibold text-foreground capitalize">{kind}</b> — {description}
      </ExplanationSection>
      <ExplanationSection title="When it comes up">{activatesWhen}</ExplanationSection>
      {declaredHeaders.length > 0 && (
        <ExplanationSection title="What it declares">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[11.5px]">
            {declaredHeaders.map(([headerName, headerValue]) => (
              <div key={headerName} className="contents">
                <dt className="text-zinc-400">{headerName}</dt>
                <dd>{typeof headerValue === "string" ? headerValue : headerValue.join(", ")}</dd>
              </div>
            ))}
          </dl>
        </ExplanationSection>
      )}
      {(useMixins.length > 0 || rationale !== undefined || unresolvedRationaleId !== undefined) && (
        <ExplanationSection title="What it pulls in">
          {useMixins.map((relatedPrimitive) => (
            <div key={relatedPrimitive.data.id}>
              {renderPrimitiveLink(relatedPrimitive)} <span className="text-zinc-500">lends its body</span>
            </div>
          ))}
          {rationale !== undefined && (
            <div>
              {renderPrimitiveLink(rationale)} <span className="text-zinc-500">the reasoning it cites</span>
            </div>
          )}
          {unresolvedRationaleId !== undefined && (
            <div className="text-destructive">
              <span className="font-mono">{unresolvedRationaleId}</span> (does not resolve)
            </div>
          )}
        </ExplanationSection>
      )}
      {usedByPrimitives.length > 0 && (
        <ExplanationSection title="Lent to">
          {usedByPrimitives.map((relatedPrimitive) => (
            <div key={relatedPrimitive.data.id}>{renderPrimitiveLink(relatedPrimitive)}</div>
          ))}
        </ExplanationSection>
      )}
      {citers.length > 0 && (
        <ExplanationSection title="Cited by">
          {citers.map((relatedPrimitive) => (
            <div key={relatedPrimitive.data.id}>{renderPrimitiveLink(relatedPrimitive)}</div>
          ))}
        </ExplanationSection>
      )}
      {mentioners.length > 0 && (
        <ExplanationSection title="Mentioned in">
          {mentioners.map((relatedPrimitive) => (
            <div key={relatedPrimitive.data.id}>{renderPrimitiveLink(relatedPrimitive)}</div>
          ))}
        </ExplanationSection>
      )}
      <ExplanationSection title="Tested by">
        {testFileSituationEntries.length === 0 ? (
          <span className="text-zinc-400">No test case names it.</span>
        ) : (
          testFileSituationEntries.map(([testFilePath, situations]) => (
            <div key={testFilePath}>
              <span className="font-mono text-[11px] text-foreground">{testFilePath}</span>
              {situations.map((situation) => (
                <div key={situation} className="py-0.5 pl-3 font-mono text-[11px]">
                  {situation}
                </div>
              ))}
            </div>
          ))
        )}
      </ExplanationSection>
      <ExplanationSection title="File">
        <span className="font-mono text-[11.5px] text-foreground">{primitiveFilePath}</span>{" "}
        <span className="text-zinc-500">in the {layerName} layer</span>
      </ExplanationSection>
    </div>
  );
}

/** One titled part of the explanation, a region named by its title. */
function ExplanationSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="border-b border-zinc-100 px-4 py-3.5 last:border-b-0">
      <h3 className="mb-[7px] text-[10.5px] font-bold tracking-[0.06em] text-zinc-400 uppercase">{title}</h3>
      <div className="text-[12.5px] leading-[1.65] text-zinc-700">{children}</div>
    </section>
  );
}
