/**
 * DRIVEN PORT — a tokenizer that runs on this machine. The hexagon hands it a
 * text and is told how many tokens that text is; which tokenizer answers, and
 * how, is the adapter's business.
 *
 * No tokenizer of the model an agent runs on is at hand offline, so what this
 * answers is an estimate of that model's count, and whoever says the number
 * says so (EVAL-FR-002).
 */
export interface ForCountingTokens {
  /** How many tokens this text is, to the tokenizer behind this port. */
  countTokens(text: string): number;
}
