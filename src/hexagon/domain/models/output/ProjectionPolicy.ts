/**
 * How one compiled file is put down over whatever is already there (FR-018,
 * FR-020, FR-051).
 *
 * Three, and the difference is whose file it is. A file this charter owns is
 * replaced: it holds what this reading of the charter says and nothing else, so
 * a compiled file someone edited by hand is written back the way the charter has
 * it. A file the charter shares with the repository — the settings a host runs
 * on — is merged into: the fields the charter speaks for are its, and every other
 * field is the repository's and is left exactly as it was. And a file that is the
 * repository's, which this charter has one section of — the entry file a host
 * reads unasked — says where that section starts and ends in its own first and
 * last line: the section is written in place where those two lines are already
 * in the file and put at the end where they are not, and everything else in the
 * file is read past.
 *
 * Every output says which of the three it is, so nothing putting them down has to
 * know one kind of output from another.
 */
export type ProjectionPolicy = "replace" | "mergeJSON" | "upsertWithMarker";
