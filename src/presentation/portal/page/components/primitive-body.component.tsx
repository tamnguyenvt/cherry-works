import { autocompletion, type Completion, closeCompletion } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView, keymap } from "@codemirror/view";
import { Marked } from "marked";
import { useCallback, useLayoutEffect, useRef } from "react";
import type { PrimitivesAnswer } from "../portal.queries.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs.js";

/**
 * The markdown a body renders as in Preview. Raw HTML in it is shown as the
 * text it is rather than put into the page, and a link to a script goes
 * nowhere: an installed charter's body is text someone else wrote, and this page holds a
 * token that writes into the repository (plan §17.2.9). What the file holds is
 * untouched — an agent reads it as written.
 */
const bodyMarkdown = new Marked({
  renderer: {
    html: ({ text }) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
  },
  walkTokens: (token) => {
    if ((token.type === "link" || token.type === "image") && /^\s*(javascript|vbscript|data):/i.test(token.href))
      token.href = "#";
  },
});

/** A mention being typed: the last `[[` on the line and what follows it, up
 *  to the cursor, with no bracket since. */
const TYPED_MENTION_PATTERN = /\[\[[^[\]\n]*$/;

/** The rest of a mention after the cursor, where the cursor sits inside one:
 *  what follows it on the line up to the `]]` closing it. */
const MENTION_REST_PATTERN = /^[^[\]\n]*\]\]/;

/** One entry of the list `[[` opens: a primitive, or the line saying none
 *  matches. */
type MentionCompletion = Completion & { description?: string };

/** One of Source and Preview, drawn as a segment of the switch between them. */
const SEGMENT_CLASS_NAME =
  "h-auto flex-none cursor-pointer rounded-md px-[11px] py-[5px] text-[11.5px] font-semibold text-zinc-500 data-[state=active]:shadow-[0_1px_2px_rgba(0,0,0,0.08)]";

/**
 * One primitive's body, as its source or as it reads rendered (FR-119).
 *
 * The source is CodeMirror with markdown highlighting, bundled so it works
 * offline (FR-111), and opens first where the body can be written. Without
 * `onChange` the body is read-only, as an installed primitive's is, and opens on
 * Preview.
 *
 * Typing `[[` in a body that can be written lists the primitives of
 * `primitivesAnswer` to mention, and choosing one writes `[[<id>]]` (FR-245,
 * FR-246). Until the charter is read, or where the engine will not read it, no
 * list opens.
 */
export function PrimitiveBody({
  body,
  onChange,
  primitivesAnswer,
}: {
  body: string;
  onChange?: (body: string) => void;
  primitivesAnswer?: PrimitivesAnswer;
}) {
  return (
    <Tabs
      defaultValue={onChange === undefined ? "preview" : "source"}
      className="gap-0 overflow-hidden rounded-xl border bg-background"
    >
      <div className="flex items-center gap-2.5 border-b border-[#f0f0f0] px-[13px] py-[9px]">
        <span className="text-[10.5px] font-bold tracking-[0.06em] text-zinc-400 uppercase">Body</span>
        <span className="font-mono text-[10.5px] text-zinc-400">markdown</span>
        <TabsList className="ml-auto h-auto gap-0.5 rounded-lg bg-[#f0f0f2] p-[3px]">
          <TabsTrigger value="source" className={SEGMENT_CLASS_NAME}>
            Source
          </TabsTrigger>
          <TabsTrigger value="preview" className={SEGMENT_CLASS_NAME}>
            Preview
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="source" className="h-[300px] flex-none">
        <BodySource body={body} onChange={onChange} primitivesAnswer={primitivesAnswer} />
      </TabsContent>
      <TabsContent value="preview">
        <div
          className="min-h-32 px-[18px] py-4 text-[12.5px] leading-[1.65] text-zinc-700 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs [&_h1]:mb-[7px] [&_h1]:text-[15px] [&_h1]:font-bold [&_h1]:text-foreground [&_h2]:mt-4 [&_h2]:mb-[7px] [&_h2]:text-[13px] [&_h2]:font-bold [&_h2]:text-foreground [&_strong]:font-semibold [&_strong]:text-foreground [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mb-2 [&_ul]:list-disc"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: the author's own body, previewed on their own machine.
          dangerouslySetInnerHTML={{ __html: bodyMarkdown.parse(body, { async: false }) }}
        />
      </TabsContent>
    </Tabs>
  );
}

/** The editor itself, mounted into the element it is given and taken down with
 *  it. The body it starts from is read once: after that CodeMirror holds the
 *  text, and React rendering around it does not reach inside, but for the
 *  primitives a mention lists, read afresh each time `[[` opens the list. */
function BodySource({
  body,
  onChange,
  primitivesAnswer,
}: {
  body: string;
  onChange: ((body: string) => void) | undefined;
  primitivesAnswer: PrimitivesAnswer;
}) {
  const primitivesAnswerRef = useRef(primitivesAnswer);
  useLayoutEffect(() => {
    primitivesAnswerRef.current = primitivesAnswer;
  }, [primitivesAnswer]);
  // One callback for the life of this editor, so it is mounted once rather
  // than on every render.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the body is read once, when the editor mounts.
  const mountEditor = useCallback((parent: HTMLDivElement) => {
    const editorView = new EditorView({
      parent,
      doc: body,
      extensions: [
        markdown(),
        syntaxHighlighting(defaultHighlightStyle),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.lineWrapping,
        // Each primitive whose id or description holds what was typed after
        // `[[`, ignoring case, in the order the charter lists them; Escape
        // closes the list and the text stays as typed.
        autocompletion({
          icons: false,
          maxRenderedOptions: Number.POSITIVE_INFINITY,
          addToOptions: [
            {
              render: (completion: MentionCompletion) => {
                if (completion.description === undefined) return null;
                const descriptionElement = document.createElement("span");
                descriptionElement.className = "cm-mentionDescription";
                descriptionElement.textContent = completion.description;
                return descriptionElement;
              },
              position: 90,
            },
          ],
          override: [
            (completionContext) => {
              const typedMentionMatch = completionContext.matchBefore(TYPED_MENTION_PATTERN);
              const latestPrimitivesAnswer = primitivesAnswerRef.current;
              if (typedMentionMatch === null || latestPrimitivesAnswer?.type !== "Primitives") return null;
              const typedText = typedMentionMatch.text.slice("[[".length).toLowerCase();
              const mentionCompletions: MentionCompletion[] = latestPrimitivesAnswer.data.primitives
                .filter(
                  ({ data: { id, description } }) =>
                    id.toLowerCase().includes(typedText) || description.toLowerCase().includes(typedText),
                )
                .map(({ data: { id, kind, description } }) => ({
                  label: id,
                  detail: kind,
                  description,
                  apply: `[[${id}]]`,
                }));
              // Choosing inside a mention already written replaces it whole.
              const mentionRestMatch = MENTION_REST_PATTERN.exec(
                completionContext.state.sliceDoc(
                  completionContext.pos,
                  completionContext.state.doc.lineAt(completionContext.pos).to,
                ),
              );
              return {
                from: typedMentionMatch.from,
                to: completionContext.pos + (mentionRestMatch?.[0].length ?? 0),
                filter: false,
                // Choosing the line that says nothing matches closes the list
                // and leaves the text as typed, as Escape does.
                options:
                  mentionCompletions.length > 0
                    ? mentionCompletions
                    : [{ label: "Nothing in the charter matches.", apply: closeCompletion }],
              };
            },
          ],
        }),
        EditorView.editable.of(onChange !== undefined),
        EditorView.updateListener.of((viewUpdate) => {
          if (viewUpdate.docChanged) onChange?.(viewUpdate.state.doc.toString());
        }),
      ],
    });
    // The dialog around the editor answers Escape on the document before the
    // editor sees it, and keeps its draft by marking it handled, which the
    // editor then ignores: so the list is closed here, on the window, first.
    const closeMentionList = (event: KeyboardEvent) => {
      if (event.key === "Escape" && editorView.hasFocus) closeCompletion(editorView);
    };
    window.addEventListener("keydown", closeMentionList, { capture: true });
    return () => {
      window.removeEventListener("keydown", closeMentionList, { capture: true });
      editorView.destroy();
    };
  }, []);

  return <div className="h-full" ref={mountEditor} />;
}
