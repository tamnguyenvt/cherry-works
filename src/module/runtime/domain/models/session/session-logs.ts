/** The logs of a repository's sessions as what keeps them read them: the name
 *  of the folder they were read from, for the review to say (CORE-FR-218),
 *  and each log's text. */
export class SessionLogs {
  constructor(
    readonly sessionsFolder: string,
    readonly logTexts: readonly string[],
  ) {}
}
