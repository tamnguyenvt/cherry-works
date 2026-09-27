import { CHARTER_DIRECTORY } from "../../path.js";
import type { ProjectionPolicy } from "./ProjectionPolicy.js";
import { stamp, type StampedDocument } from "./StampedDocument.js";
import type { ClaudeComponent } from "./providers/claude/ClaudeComponent.js";

/**
 * Everything one reading of a charter compiles to (FR-021).
 *
 * Models and nothing else — no path, no contents and no file. What every reader
 * of the charter gets is here whether an agent is installed or not: the listing,
 * and the file that orients a reader to it (FR-019). What the agents this
 * repository runs get is each primitive in that host's own kinds, and a
 * repository running none has none of them (FR-018).
 */
export interface CharterOutput {
  readonly catalogue: Catalogue;
  readonly charterMd: CharterMd;
  readonly compiledPrimitives: readonly CompiledPrimitive[];
  readonly providerComponents: readonly ClaudeComponent[];
}

/**
 * What a charter holds, listed for whoever reads it (FR-011 – FR-013).
 *
 * Output, not charter: nothing here was authored and nothing here is read back,
 * and nothing here knows what a primitive is — reading one into an entry is the
 * service's, and this is handed the list (plan §2.6).
 *
 * One listing held twice over, not two listings: the same entries, read down to
 * what each reader needs. So the two cannot come to say different things about
 * one primitive, and neither can be had without the other (SC-004). What each is
 * written as — indented or not, and into which file — is the compiler's and the
 * projector's.
 *
 * Ordered by identity rather than by the order the files happened to be read, so
 * the same charter catalogues byte for byte the same and a committed catalogue
 * changes only when the charter does (SC-007).
 *
 * No bodies, in either. What a primitive says is read from the file it names,
 * when the thing it applies to comes up and not before (FR-013).
 */
export class Catalogue {
  static of(entries: readonly CatalogueFull[]): Catalogue {
    return new Catalogue(
      [...entries].sort((one, another) => (one.identity < another.identity ? -1 : one.identity > another.identity ? 1 : 0)),
    );
  }

  private constructor(private readonly entries: readonly CatalogueFull[]) {}

  /** This listing is the charter's own file: it says what the charter holds now,
   *  and nothing else has anything to say in it. */
  readonly projection: ProjectionPolicy = "replace";

  /**
   * The same listing, narrowed to the primitives of one kind (FR-011).
   *
   * A narrowed listing is a listing: what comes back answers `full` and
   * `compact` the way this does, so whoever reads it never has to ask whether it
   * was narrowed. Nothing is re-sorted — the entries keep the order they were
   * put in, which is the order by identity `of` gave them.
   */
  filterByKind(kind: string): Catalogue {
    return new Catalogue(this.entries.filter((one) => one.kind === kind));
  }

  /** Everything every primitive's headers declare about it, and the file its body
   *  is in (FR-011). */
  get full(): readonly CatalogueFull[] {
    return this.entries;
  }

  /**
   * The same primitives as an agent surveys them: what each is, what it is
   * called, and the one line saying what it is for (FR-012).
   *
   * This is what an agent reads first, so it holds nothing an agent surveying the
   * charter would not use — no globs, no tags, and no file. Having found what it
   * wants here, it asks `full` where that identity lives.
   */
  get compact(): readonly CatalogueCompact[] {
    return this.entries.map(({ identity, kind, id, description }) => ({ identity, kind, id, description }));
  }}

/** One primitive as the compact listing records it. */
export interface CatalogueCompact {
  readonly identity: string;
  readonly kind: string;
  readonly id: string;
  readonly description: string;
}

/**
 * One primitive as the full listing records it: everything its headers declare
 * about it, and the file its body is in (FR-011).
 *
 * A header nobody wrote is left out rather than recorded as nothing: a catalogue
 * says what the author declared.
 */
export interface CatalogueFull extends CatalogueCompact {
  /** Where the body is, from the repository holding the charter — the one path
   *  that reads the same on every machine that checks it out. The compiled
   *  primitive, in what a build writes; the authored file, in what a person is
   *  listed (FR-140). */
  readonly file: string;
  readonly tags?: readonly string[];
  readonly globs?: readonly string[];
  readonly rationale?: string;
  readonly mixins?: readonly string[];
  readonly mcps?: readonly string[];
}

/**
 * What an agent has to know before it reads anything else: that this repository
 * is governed by a charter, where the charter's own listing of itself is, and
 * when each kind is to be opened (FR-019).
 *
 * Orientation, and the few rules that are not worth the risk of being missed. A
 * primitive's body is opened when its activation condition is met and not
 * before, which is what the two catalogues are for (FR-012, FR-013, SC-005) —
 * so a charter of four hundred guides compiles to the same few paragraphs as a
 * charter of four.
 *
 * The activation lines are read off the primitive classes, one per kind, each declaring
 * its own beside the headers it requires, so what a kind is and when it is
 * opened is said in one place (FR-001).
 *
 * A type and a body, and no file: what it is called and where it lands is for
 * whoever puts it down (plan §2.6). The two listings it sends a reader to are
 * named beside it, since they land in the same folder as this does. No charter either — it is handed the lines
 * it writes, so what a kind is is asked of the charter once, by the caller.
 *
 * No primitive's body reaches here, not even a guide's: this file is
 * orientation and the listings it sends a reader to. What every turn is to carry
 * is a host's to hand its agent, in that host's own kind.
 */
export class CharterMd {
  static readonly type = "charter-md" as const
  readonly type = CharterMd.type

  static of(
    kinds: readonly {
      readonly kind: string;
      readonly activatesWhen: string;
    }[],
  ): CharterMd {
    return new CharterMd(`${[
    "# Charter",
    `This repository is governed by a charter — the standards it authored under \`${CHARTER_DIRECTORY}/\`, which constrain whatever coding agent runs here. Every surface an agent reads, this file included, is generated from that charter: do not edit them, edit the primitive behind them.`,
    "## Read first",
    `[catalog.min.json](./catalog.min.json) — the kind, identity and description of every primitive this charter holds. Survey it to find what you need; open [catalog.json](./catalog.json) for that primitive's file, globs and mixins, and open a body only once its activation condition below is met.`,
    "## When each kind applies",
    kinds.map((one) => `- **${one.kind}** — ${one.activatesWhen}.`).join("\n"),
    "## One identity, one primitive",
    `An identity names one primitive in the whole charter: \`kind:id\`, whether this repository authored it, installed it from a vendor, or the engine brought it. Nothing overrides anything — two files claiming one identity is an error the charter refuses to build with.`,
  ].join("\n\n")}\n`);
  }

  /** This file is the charter's own: it is written whole over whatever is
   *  there. */
  readonly projection: ProjectionPolicy = "replace";

  /** This file as a reader opens it: the stamp saying this engine wrote it, and
   *  the orientation itself. */
  toStampedDocument(): StampedDocument {
    return stamp(this.body);
  }

  private constructor(
    readonly body: string,
  ) {}
}

/**
 * One primitive as an agent opens it: the headers its author wrote, and below
 * them the whole of what it says — the bodies of the mixins it pulls in, then its
 * own (FR-139).
 *
 * Every layer's primitive compiles to one of these, so what the catalogue sends
 * an agent to is a file in the output folder for all of them, the engine's own
 * included. The document is handed in whole: reading a primitive into it is the
 * compiler's, and where it lands is the file the catalogue names for it.
 */
export class CompiledPrimitive {
  static of(identity: string, document: string): CompiledPrimitive {
    return new CompiledPrimitive(identity, document);
  }

  /** Generated, and the charter's alone: written whole over whatever is there,
   *  and gone with the primitive it was compiled from. */
  readonly projection: ProjectionPolicy = "replace";

  /** This document as a reader opens it, with the stamp saying where to change
   *  it instead. */
  toStampedDocument(): StampedDocument {
    return stamp(this.document);
  }

  private constructor(
    /** Which primitive this is: what the catalogue entry naming its file is
     *  found by. */
    readonly identity: string,
    readonly document: string,
  ) {}
}
