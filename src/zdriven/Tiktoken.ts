import { getEncoding, type Tiktoken as Encoding } from "js-tiktoken";
import type { ForCountingTokens } from "#hexagon/port/zdriven/ForCountingTokens.js";

/**
 * DRIVEN ADAPTER: js-tiktoken, a tokenizer that runs offline, with
 * `o200k_base`. Not the tokenizer of the model an agent runs on, which is not
 * published; near enough to stand in for it, and said to be an estimate
 * wherever it is used (EVAL-FR-002).
 *
 * The encoding is loaded the first time a text is counted, not when this is
 * made: a command that counts nothing pays nothing for it.
 */
export class Tiktoken implements ForCountingTokens {
  #encoding: Encoding | undefined;

  countTokens(text: string): number {
    this.#encoding ??= getEncoding("o200k_base");
    return this.#encoding.encode(text).length;
  }
}
