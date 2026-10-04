import type { ForCountingTokens } from "#hexagon/port/zdriven/ForCountingTokens.js";

/** A tokenizer a test can count along with: one token per word, whatever
 *  separates the words. */
export class InMemoryTokenCounter implements ForCountingTokens {
  countTokens(text: string): number {
    return text.split(/\s+/).filter((word) => word !== "").length;
  }
}
