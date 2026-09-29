import { CHARTER_DIRECTORY } from "../../../path.js";
import type { ProjectionPolicy } from "../ProjectionPolicy.js";
import { stamp, type StampedDocument } from "../StampedDocument.js";

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
