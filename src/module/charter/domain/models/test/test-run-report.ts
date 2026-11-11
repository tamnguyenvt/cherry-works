import type { TestCaseFault } from "../charter.fault.js";

/**
 * How one case came out: the test file it is in, the situation it put, said as
 * a line, and why the charter did not answer it where it did not (FR-048).
 *
 * A case passes when there is nothing unmet, so it is asked of the outcome
 * rather than worked out again by whoever reports it. There is one fault and not
 * a list, because a case expects one thing of one situation — and it is a fault
 * like any other, saying what is wrong and what the next move is, so a failing
 * case reads the way every other thing this engine refuses reads (SC-003).
 */
export class TestCaseReport {
  constructor(
    readonly suiteName: string,
    readonly situation: string,
    readonly unmet?: TestCaseFault,
  ) {}

  get passed(): boolean {
    return this.unmet === undefined;
  }
}
