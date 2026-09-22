import { useCallback } from "react";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView, keymap } from "@codemirror/view";
import { Marked } from "marked";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs.js";

/**
 * The markdown a body renders as in Preview. Raw HTML in it is shown as the
 * text it is rather than put into the page, and a link to a script goes
 * nowhere: a vendor's body is text someone else wrote, and this page holds a
 * token that writes into the repository (plan §17.2.9). What the file holds is
 * untouched — an agent reads it as written.
 */
const bodyMarkdown = new Marked({
  renderer: {
    html: ({ text }) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
  },
  walkTokens: (token) => {
    if ((token.type === "link" || token.type === "image") && /^\s*(javascript|vbscript|data):/i.test(token.href)) token.href = "#";
  },
});

/** One of Source and Preview, drawn as a segment of the switch between them. */
const SEGMENT = "h-auto flex-none cursor-pointer rounded-md px-[11px] py-[5px] text-[11.5px] font-semibold text-zinc-500 data-[state=active]:shadow-[0_1px_2px_rgba(0,0,0,0.08)]";

/**
 * One primitive's body, as its source or as it reads rendered (FR-119).
 *
 * The source is CodeMirror with markdown highlighting, bundled so it works
 * offline (FR-111), and opens first where the body can be written. Without
 * `onChange` the body is read-only, as a vendored primitive's is, and opens on
 * Preview.
 */
export function PrimitiveBody({ body, onChange }: { body: string; onChange?: (body: string) => void }) {
  return (
    <Tabs defaultValue={onChange === undefined ? "preview" : "source"} className="gap-0 overflow-hidden rounded-xl border bg-background">
      <div className="flex items-center gap-2.5 border-b border-[#f0f0f0] px-[13px] py-[9px]">
        <span className="text-[10.5px] font-bold tracking-[0.06em] text-zinc-400 uppercase">Body</span>
        <span className="font-mono text-[10.5px] text-zinc-400">markdown</span>
        <TabsList className="ml-auto h-auto gap-0.5 rounded-lg bg-[#f0f0f2] p-[3px]">
          <TabsTrigger value="source" className={SEGMENT}>
            Source
          </TabsTrigger>
          <TabsTrigger value="preview" className={SEGMENT}>
            Preview
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="source" className="h-[300px] flex-none">
        <BodySource body={body} onChange={onChange} />
      </TabsContent>
      <TabsContent value="preview">
        <div
          className="min-h-32 px-[18px] py-4 text-[12.5px] leading-[1.65] text-zinc-700 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs [&_h1]:mb-[7px] [&_h1]:text-[15px] [&_h1]:font-bold [&_h1]:text-foreground [&_h2]:mt-4 [&_h2]:mb-[7px] [&_h2]:text-[13px] [&_h2]:font-bold [&_h2]:text-foreground [&_strong]:font-semibold [&_strong]:text-foreground [&_li]:ml-5 [&_ol]:list-decimal [&_p]:mb-2 [&_ul]:list-disc"
          dangerouslySetInnerHTML={{ __html: bodyMarkdown.parse(body, { async: false }) }}
        />
      </TabsContent>
    </Tabs>
  );
}

/** The editor itself, mounted into the element it is given and taken down with
 *  it. The body it starts from is read once: after that CodeMirror holds the
 *  text, and React rendering around it does not reach inside. */
function BodySource({ body, onChange }: { body: string; onChange: ((body: string) => void) | undefined }) {
  // One callback for the life of this editor, so it is mounted once rather
  // than on every render.
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
        EditorView.editable.of(onChange !== undefined),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChange?.(update.state.doc.toString());
        }),
      ],
    });
    return () => editorView.destroy();
  }, []);

  return <div className="h-full" ref={mountEditor} />;
}
