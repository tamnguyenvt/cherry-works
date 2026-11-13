import { MissingCharterOutputItemFault } from "../charter.fault.js";
import type { CharterOutputItem } from "./charter-output-item.js";

/**
 * Everything one reading of a charter compiles to (FR-021): the items a
 * build lays, naming no place but inside the compiled output — where the
 * output lands, and what each agent reads of it, is each projection's
 * (CORE-FR-220, CORE-FR-221).
 *
 * What every reader of the charter gets is among them whether an agent is
 * installed or not: the listing, and the file that orients a reader to it
 * (FR-019). What the agents this repository runs get is each agent's own
 * listing among them, and the rest its projection makes of them (FR-018).
 */
export class CharterOutput {
  readonly #charterOutputItems: CharterOutputItem[] = [];

  /** One more item, laid after those already added (FR-020, FR-021). */
  add(charterOutputItem: CharterOutputItem): void {
    this.#charterOutputItems.push(charterOutputItem);
  }

  /** Every item, in the order a build lays them. */
  get charterOutputItems(): readonly CharterOutputItem[] {
    return this.#charterOutputItems;
  }

  /** The one item of a class it holds: a build adds each such item once, so
   *  one missing is the engine's own fault, never the person's. */
  findCharterOutputItem<Item extends CharterOutputItem>(
    // biome-ignore lint/suspicious/noExplicitAny: an item class, whatever it is made with
    itemClass: abstract new (...itemArguments: any[]) => Item,
  ): Item {
    const charterOutputItem = this.#charterOutputItems.find(
      (heldItem): heldItem is Item => heldItem instanceof itemClass,
    );
    if (charterOutputItem === undefined)
      throw new MissingCharterOutputItemFault(
        `The compiled output holds no ${itemClass.name}.`,
        "Report it: every build adds one.",
      );
    return charterOutputItem;
  }
}
