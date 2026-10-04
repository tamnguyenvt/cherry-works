import { test } from "node:test";
import assert from "node:assert/strict";
import { Tiktoken } from "../src/zdriven/Tiktoken.js";
import { InMemoryTokenCounter } from "../src/zdriven/InMemoryTokenCounter.js";

test("the tokenizer on this machine counts a text's tokens, with no key and no network (EVAL-FR-001, EVAL-SC-001)", () => {
  const tokenCounter = new Tiktoken();

  assert.equal(tokenCounter.countTokens(""), 0);
  assert.equal(tokenCounter.countTokens("hello world"), 2);
  // A word it does not hold whole is split into several tokens.
  assert.ok(tokenCounter.countTokens("antidisestablishmentarianism") > 1);
});

test("the tokenizer is loaded once and counts the same text the same way every time", () => {
  const tokenCounter = new Tiktoken();
  const guideText = "Write every sentence in plain words, whole, with no shorthand. ".repeat(50);

  assert.equal(tokenCounter.countTokens(guideText), tokenCounter.countTokens(guideText));
});

test("the tokenizer a test counts along with counts one token per word", () => {
  assert.equal(new InMemoryTokenCounter().countTokens("  one two\nthree\tfour "), 4);
});
