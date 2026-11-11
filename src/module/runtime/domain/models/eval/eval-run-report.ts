/** How one evaluation case came out: the file it is in, its prompt, the tokens
 *  the agent used, and every expectation it did not meet, said (EVAL-FR-025). */
export class EvalCaseReport {
  constructor(
    readonly suiteName: string,
    readonly prompt: string,
    readonly tokens: number,
    readonly unmetReasons: readonly string[],
    readonly logPath?: string,
    readonly sessionId?: string,
    readonly sessionPath?: string,
  ) {}

  get passed(): boolean {
    return this.unmetReasons.length === 0;
  }
}

/** How every case came out, in the order their files and cases were read, and
 *  the tokens of them all (EVAL-FR-025). */
export class EvalRunReport {
  constructor(
    readonly evalCaseReports: readonly EvalCaseReport[],
    readonly agent: string,
  ) {}

  get totalTokens(): number {
    return this.evalCaseReports.reduce((tokens, evalCaseReport) => tokens + evalCaseReport.tokens, 0);
  }
}
