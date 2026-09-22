import { useState } from "react";
import type { DataDTOs } from "#hexagon/port/driver/dtos/index.js";
import { usePrimitives } from "../queries.js";
import { Badge } from "./ui/badge.js";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command.js";

/**
 * The search in the header: a word typed lists every primitive of every layer
 * that mentions it, under the box, and choosing one opens it where it is
 * listed (FR-114).
 *
 * Which primitives mention the word is the engine's answer, asked afresh for
 * each word typed, so the list filters nothing itself. The word is this box's
 * own: nothing else on the page reads it, and it is cleared once a primitive is
 * chosen or Escape is pressed.
 */
export function CharterSearch({ onPick }: { onPick: (scopedPrimitive: DataDTOs.ScopedPrimitive) => void }) {
  const [word, setWord] = useState("");
  const [listShown, setListShown] = useState(false);
  const { data: listing } = usePrimitives(word);

  return (
    <Command
      shouldFilter={false}
      className="relative w-full overflow-visible rounded-[9px] border bg-zinc-50 text-zinc-400 focus-within:border-foreground focus-within:bg-background focus-within:text-zinc-500 [&_[data-slot=command-input-wrapper]]:h-[32px] [&_[data-slot=command-input-wrapper]]:border-0 [&_[data-slot=command-input]]:h-8 [&_[data-slot=command-input]]:text-[12.5px] [&_[data-slot=command-input]]:text-foreground [&_[data-slot=command-input]]:placeholder:text-zinc-400"
      onFocus={() => setListShown(true)}
      onBlur={() => setListShown(false)}
    >
      <CommandInput
        placeholder="Search everything"
        spellCheck={false}
        value={word}
        onValueChange={setWord}
        onKeyDown={(event) => event.key === "Escape" && setWord("")}
      />
      {listShown && word !== "" && (
        // Pressed in the list without taking the focus from the box, so the
        // list is still there when the click that chooses from it lands.
        <CommandList
          className="absolute top-full right-0 left-0 z-50 mt-[7px] max-h-[min(460px,62vh)] rounded-xl border bg-popover p-[5px] shadow-[0_20px_44px_-16px_rgba(0,0,0,0.3)] [&_[cmdk-group-heading]]:px-[11px] [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:tracking-[0.07em] [&_[cmdk-group-heading]]:text-zinc-400 [&_[cmdk-group-heading]]:uppercase [&_[data-slot=command-group]]:p-0"
          onMouseDown={(event) => event.preventDefault()}
        >
          {listing?.type === "FaultsByFile" && (
            <p className="px-3 py-3.5 text-xs text-zinc-400">The engine will not read this charter, so there is nothing to search.</p>
          )}
          {listing?.type === "Fault" && (
            <p className="px-3 py-3.5 text-xs text-zinc-400">
              {listing.data.message} {listing.data.fix}
            </p>
          )}
          {listing?.type === "ScopedPrimitives" && (
            <>
              <CommandEmpty className="px-3 py-3.5 text-xs text-zinc-400">Nothing in the charter says that.</CommandEmpty>
              {listing.data.primitives.length > 0 && (
                <CommandGroup heading={`${listing.data.primitives.length} primitive${listing.data.primitives.length === 1 ? "" : "s"}`}>
                  {listing.data.primitives.map((scopedPrimitive) => {
                    const { identity, kind, description, scope, headers } = scopedPrimitive.data;
                    return (
                      <CommandItem
                        key={identity}
                        value={identity}
                        className="grid cursor-pointer grid-cols-[74px_minmax(0,1fr)_max-content] items-baseline gap-2.5 rounded-lg px-[11px] py-2 data-[selected=true]:bg-zinc-50 data-[selected=true]:outline data-[selected=true]:outline-zinc-200"
                        onSelect={() => {
                          setWord("");
                          setListShown(false);
                          onPick(scopedPrimitive);
                        }}
                      >
                        <span className="font-mono text-[9.5px] font-bold tracking-[0.03em] text-zinc-500 uppercase">{kind}</span>
                        <span className="min-w-0">
                          <span className="block truncate font-mono text-xs text-foreground">
                            <Highlighted text={String(headers.id)} word={word} />
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] leading-[1.45] text-zinc-400">
                            <Highlighted text={description} word={word} />
                          </span>
                        </span>
                        <Badge className={`rounded-[5px] px-1.5 py-0.5 font-mono text-[9.5px] font-bold tracking-[0.03em] ${SCOPE_COLORS[scope]}`}>{scope}</Badge>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </>
          )}
        </CommandList>
      )}
    </Command>
  );
}

/** The colours a layer is tagged in, as the mockup tags them. */
const SCOPE_COLORS: Record<DataDTOs.ScopedPrimitive["data"]["scope"], string> = {
  repo: "bg-[#eff6ff] text-[#1d4ed8]",
  vendor: "bg-[#f6f2ff] text-[#7c3aed]",
  builtin: "bg-zinc-100 text-zinc-700",
};

/** One line with the first place the word appears in it marked, ignoring case,
 *  as the engine matched it. */
function Highlighted({ text, word }: { text: string; word: string }) {
  const at = text.toLowerCase().indexOf(word.toLowerCase());
  if (at === -1 || word === "") return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-[2px] bg-[#fff2b8] text-inherit">{text.slice(at, at + word.length)}</mark>
      {text.slice(at + word.length)}
    </>
  );
}
