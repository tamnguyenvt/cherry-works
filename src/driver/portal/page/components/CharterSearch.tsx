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
      className="relative w-96 overflow-visible rounded-md border bg-background [&_[data-slot=command-input-wrapper]]:border-0"
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
          className="absolute top-full right-0 left-0 z-50 mt-2 max-h-[60vh] rounded-lg border bg-popover shadow-lg"
          onMouseDown={(event) => event.preventDefault()}
        >
          {listing?.type === "FaultsByFile" && (
            <p className="px-3 py-4 text-sm text-muted-foreground">The engine will not read this charter, so there is nothing to search.</p>
          )}
          {listing?.type === "Fault" && (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              {listing.data.message} {listing.data.fix}
            </p>
          )}
          {listing?.type === "ScopedPrimitives" && (
            <>
              <CommandEmpty>Nothing in the charter says that.</CommandEmpty>
              {listing.data.primitives.length > 0 && (
                <CommandGroup heading={`${listing.data.primitives.length} primitive${listing.data.primitives.length === 1 ? "" : "s"}`}>
                  {listing.data.primitives.map((scopedPrimitive) => {
                    const { identity, kind, description, scope, headers } = scopedPrimitive.data;
                    return (
                      <CommandItem
                        key={identity}
                        value={identity}
                        className="grid grid-cols-[4.5rem_1fr_auto] items-baseline gap-3"
                        onSelect={() => {
                          setWord("");
                          setListShown(false);
                          onPick(scopedPrimitive);
                        }}
                      >
                        <span className="font-mono text-[10px] font-semibold text-muted-foreground uppercase">{kind}</span>
                        <span className="min-w-0">
                          <span className="block truncate font-mono text-xs">
                            <Highlighted text={String(headers.id)} word={word} />
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            <Highlighted text={description} word={word} />
                          </span>
                        </span>
                        <Badge variant="secondary" className="font-mono text-[10px]">
                          {scope}
                        </Badge>
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

/** One line with the first place the word appears in it marked, ignoring case,
 *  as the engine matched it. */
function Highlighted({ text, word }: { text: string; word: string }) {
  const at = text.toLowerCase().indexOf(word.toLowerCase());
  if (at === -1 || word === "") return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-sm bg-yellow-200 text-inherit">{text.slice(at, at + word.length)}</mark>
      {text.slice(at + word.length)}
    </>
  );
}
