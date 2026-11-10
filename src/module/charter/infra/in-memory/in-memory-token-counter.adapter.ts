import type { ForCountingTokens } from "../../app/port/out/counting-tokens.port.js";

/** A tokenizer a test can count along with: one token per word, whatever
 *  separates the words. */
export class InMemoryTokenCounter implements ForCountingTokens {
  countTokens(text: string): number {
    return text.split(/\s+/).filter((word) => word !== "").length;
  }
}
