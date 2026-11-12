// Recorded from dist/index.d.ts as "pnpm build" leaves it, the contract 1.0.0 is to be the first release under: the declarations of its shared module. Nothing has been published under it yet. Do not edit: "pnpm release" writes it again from the library it publishes.
/**
 * One thing wrong, said without saying which file it is wrong with: what reads
 * one primitive's headers is handed the headers and nothing else, so it says
 * what is wrong and leaves the file to whoever opened it.
 *
 * An error and a value at once. Faults are collected as often as they are
 * thrown — a run names every one it finds where an exception would name the
 * first and hide the rest (FR-009) — and being an `Error` either way, there is
 * one thing to construct and one shape to report.
 *
 * The constructor is where the things a fault owes an author are asked for,
 * so none of them can be left out (SC-003). Every error this domain raises
 * extends this and adds no constructor of its own.
 *
 * A fault is the system's own, `internal`, unless it is raised with
 * `{ internal: false }`: an internal one says how the system is set up, so a
 * use case logs it and answers a message of its own in its place. Only the
 * person's faults reach them as they are (SDK-FR-017, SDK-FR-018).
 */
declare class DomainFault extends Error {
    /** The next move: the person's, or, for an internal fault, whoever runs the system. */
    readonly fix: string;
    /** An `error` fails validation; a `warn` is reported and lets the build
     *  through — worth saying and not worth stopping on, so the charter still
     *  holds and the author still knows (spec Assumptions, FR-005). */
    readonly severity: "error" | "warn";
    /** The system's own fault, not the person's: never shown to a caller as it is. */
    readonly internal: boolean;
    constructor(
    /** What is wrong with this file, never that something is wrong. */
    message: string, 
    /** The next move: the person's, or, for an internal fault, whoever runs the system. */
    fix: string, options?: {
        readonly severity?: "error" | "warn";
        readonly internal?: boolean;
        readonly cause?: unknown;
    });
}

/** What is wrong, under the file it is wrong with. A file nothing is wrong with
 *  is not in here at all. The one shape everything that reads a workspace
 *  answers in, so what a charter got wrong and what its settings did are read
 *  together without either being unwrapped first (FR-009). */
declare class FaultsByFile {
    #private;
    /** Nothing wrong with any file. */
    static readonly none: FaultsByFile;
    constructor(faultsByFilePath: Readonly<Record<string, readonly DomainFault[]>>);
    /** Every fault, under the file it is wrong with. */
    get faultsByFilePath(): Readonly<Record<string, readonly DomainFault[]>>;
    /** Is no file wrong at all? */
    get isEmpty(): boolean;
    /** These and the other ones together, a file both name holding the faults of
     *  both. */
    mergeWith(otherFaultsByFile: FaultsByFile): FaultsByFile;
    /** What is wrong badly enough to stop a build, under the file that has to
     *  change. A file whose every fault is a warning is not in here at all
     *  (FR-005). */
    filterErrors(): FaultsByFile;
}

/** Every schema of this module's DTOs, under its name — the name it carries
 *  as `type` — in alphabetical order. */
declare const FaultDTOs: {
    Fault: z.ZodObject<{
        type: z.ZodLiteral<"Fault">;
        data: z.ZodObject<{
            name: z.ZodString;
            message: z.ZodString;
            fix: z.ZodString;
            severity: z.ZodEnum<{
                error: "error";
                warn: "warn";
            }>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            name: string;
            message: string;
            fix: string;
            severity: "error" | "warn";
        }) => {
            type: "Fault";
            data: {
                name: string;
                message: string;
                fix: string;
                severity: "error" | "warn";
            };
        };
    };
    FaultsByFile: z.ZodObject<{
        type: z.ZodLiteral<"FaultsByFile">;
        data: z.ZodObject<{
            files: z.ZodRecord<z.ZodString, z.ZodReadonly<z.ZodArray<z.ZodObject<{
                type: z.ZodLiteral<"Fault">;
                data: z.ZodObject<{
                    name: z.ZodString;
                    message: z.ZodString;
                    fix: z.ZodString;
                    severity: z.ZodEnum<{
                        error: "error";
                        warn: "warn";
                    }>;
                }, z.core.$strip>;
            }, z.core.$strip> & {
                of: (dataValue: {
                    name: string;
                    message: string;
                    fix: string;
                    severity: "error" | "warn";
                }) => {
                    type: "Fault";
                    data: {
                        name: string;
                        message: string;
                        fix: string;
                        severity: "error" | "warn";
                    };
                };
            }>>>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            files: Record<string, readonly {
                type: "Fault";
                data: {
                    name: string;
                    message: string;
                    fix: string;
                    severity: "error" | "warn";
                };
            }[]>;
        }) => {
            type: "FaultsByFile";
            data: {
                files: Record<string, readonly {
                    type: "Fault";
                    data: {
                        name: string;
                        message: string;
                        fix: string;
                        severity: "error" | "warn";
                    };
                }[]>;
            };
        };
    };
    Faults: z.ZodObject<{
        type: z.ZodLiteral<"Faults">;
        data: z.ZodObject<{
            faults: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                type: z.ZodLiteral<"Fault">;
                data: z.ZodObject<{
                    name: z.ZodString;
                    message: z.ZodString;
                    fix: z.ZodString;
                    severity: z.ZodEnum<{
                        error: "error";
                        warn: "warn";
                    }>;
                }, z.core.$strip>;
            }, z.core.$strip> & {
                of: (dataValue: {
                    name: string;
                    message: string;
                    fix: string;
                    severity: "error" | "warn";
                }) => {
                    type: "Fault";
                    data: {
                        name: string;
                        message: string;
                        fix: string;
                        severity: "error" | "warn";
                    };
                };
            }>>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            faults: readonly {
                type: "Fault";
                data: {
                    name: string;
                    message: string;
                    fix: string;
                    severity: "error" | "warn";
                };
            }[];
        }) => {
            type: "Faults";
            data: {
                faults: readonly {
                    type: "Fault";
                    data: {
                        name: string;
                        message: string;
                        fix: string;
                        severity: "error" | "warn";
                    };
                }[];
            };
        };
    };
};

/** Every DTO's type, under its name: what its schema infers. */
declare namespace FaultDTOs {
    type Fault = z.infer<typeof FaultDTOs.Fault>;
    type Faults = z.infer<typeof FaultDTOs.Faults>;
    type FaultsByFile = z.infer<typeof FaultDTOs.FaultsByFile>;
}

/**
 * DRIVEN PORT — recipient. The application reports and forgets.
 *
 * Named for what the application wants, not for what carries it: a terminal
 * today, a window in the later interface, a CI log tomorrow. None of that is
 * the application's business.
 */
interface ForReportingProgress {
    /** A result the user asked for. */
    reportProgress(text: string): void;
    /** A problem, and the next move after it (FR-009, SC-003). */
    reportProblem(text: string): void;
}

/**
 * What a driven adapter raises when what stands behind its port refuses: git,
 * the credential store. Nothing is wrong with the charter; the message says
 * what the tool said, and the fix what to check on this machine.
 *
 * A `DomainFault` still, so a driver reports it as it reports any other: one
 * message, one next move.
 */
declare class AdapterFault extends DomainFault {
}

/** What an adapter raises when an mcp origin refuses the credential a call was made
 *  with (`401`): the one refusal the caller can do something about, by renewing
 *  and asking again (FR-151). */
declare class UnauthorizedMcpFault extends AdapterFault {
}

/** What an adapter answering this port raises when an mcp origin cannot be
 *  reached or started, or refuses the credential a call was made with, named
 *  again here so it names this port and nothing behind it. */

/** Where one mcp origin is, as the list of mcp origins holds it: reached at an endpoint,
 *  or started as a local command reading its token from `tokenEnv`. */
interface McpServerAddress {
    readonly address: string;
    readonly endpoint?: string;
    readonly command?: {
        readonly command: string;
        readonly args: readonly string[];
        readonly tokenEnv?: string;
    };
}

/** One tool as its mcp origin lists it, by the mcp origin's own name, its input schema as
 *  it came. */
interface UpstreamTool {
    readonly name: string;
    readonly description?: string;
    readonly inputSchema: Readonly<Record<string, unknown>>;
}

/** What an mcp origin answered a call with, as it came: content, `isError` and all.
 *  Not read by the hexagon: the server decides what may be called, not what an
 *  answer means (FR-154). */
type ToolAnswer = Readonly<Record<string, unknown>>;

/** One mcp origin reached: what it listed when it was reached, and calls to it. */
interface McpServerConnection {
    readonly tools: readonly UpstreamTool[];
    /**
     * Call one of the mcp origin's tools by its own name. `accessToken` is sent with
     * this call to an mcp origin at an endpoint; a local command was handed its token
     * when it started, and ignores it.
     *
     * Raises `UnauthorizedMcpFault` where the mcp origin refuses the credential, and a
     * `AdapterFault` where the call fails on the way.
     */
    callTool(toolName: string, toolArguments: Readonly<Record<string, unknown>>, accessToken: string | undefined): Promise<ToolAnswer>;
    /** Let go of the mcp origin: a local command it started is stopped. */
    closeConnection(): Promise<void>;
}

/**
 * DRIVEN PORT — the MCP servers a charter's mcp origins are (FR-152 – FR-154).
 *
 * The protocol, its transports and the processes a local command runs in are
 * the adapter's business; the hexagon hands it where an mcp origin is and the
 * developer's token, and gets back what the mcp origin lists and answers.
 */
interface ForCallingMcpServers {
    /**
     * Reach one mcp origin, and ask it what tools it has, within `timeoutMs`. A local
     * command is started, `accessToken` in the variable its `tokenEnv` names and
     * in no other way.
     *
     * Raises an `AdapterFault` naming the address where the mcp origin cannot be
     * reached or started, or does not answer in time.
     */
    connectServer(mcpServerAddress: McpServerAddress, accessToken: string | undefined, timeoutMs: number): Promise<McpServerConnection>;
}

/** What an adapter answering this port raises when a file or a folder cannot
 *  be read, or a path reaches out of its folder, named again here so it names
 *  this port and nothing behind it. */

/**
 * DRIVEN PORT — repository. The hexagon says which folder it means, by its path
 * from the repository's root; walking that folder is the adapter's business,
 * and where the files live — a disk today, a git object database or a test's
 * own map tomorrow — is its business too, the repository's address with it:
 * an adapter is set up on that address once (CORE-FR-217).
 *
 * A path is from the folder the adapter was set up on — the repository's
 * root — `/` between its names, with no leading or trailing `/`; the empty
 * path is that folder itself.
 */
interface ForReadingFiles {
    /** Every file under one folder, at any depth, each with what it holds, in no
     *  promised order. A folder that is not there is no files rather than a
     *  failure: a charter holding some of the kind folders and not the rest is a charter. */
    readFilesRecursively(folderPath: string): Promise<readonly ReadFile[]>;
    /** Every file under one folder, as `readFilesRecursively` answers them, each
     *  with the bytes it holds, never decoded: what is asked of a folder whose
     *  files are copied as they are, whatever they hold (CORE-FR-207,
     *  CORE-FR-208). */
    readBytesRecursively(folderPath: string): Promise<readonly ReadFile<Uint8Array>[]>;
    /** The folders one level under one folder, in no promised order. A charter
     *  asks this of `.cw/charter/vendor/` and of each owner's folder under it, where each
     *  folder is one layer someone installed (FR-023, FR-024, FR-050). */
    listFolders(folderPath: string): Promise<readonly string[]>;
    /** The text of one file that may not be there, and nothing where it is not.
     *  What is asked of a file the engine allows to be absent: the settings a
     *  repository configured itself with, and the settings file a host already
     *  keeps that a build has to write into rather than over. */
    readIfThere(filePath: string): Promise<string | undefined>;
    /** The bytes of one file that may not be there, never decoded, and nothing
     *  where it is not: what a copy is compared with (CORE-FR-207). */
    readBytesIfThere(filePath: string): Promise<Uint8Array | undefined>;
    /** The files directly in one folder, not in the folders under it, each with
     *  when it was last modified and without what it holds, in no promised
     *  order: what is asked where most of the files are not to be read. A folder
     *  that is not there is no files. */
    listFiles(folderPath: string): Promise<readonly ListedFile[]>;
    /** Where the file at this path is, as an address in this reader's own
     *  scheme: what a file is named by to whoever is told where it is kept. */
    findFileAddress(filePath: string): string;
}

/** One file as it was listed: its path from the repository, and when it was
 *  last modified. */
interface ListedFile {
    readonly path: string;
    readonly modifiedAt: Date;
}

/** One file as it was read: its path from the repository, and what it says —
 *  its text, or its bytes where they were asked for. */
interface ReadFile<Contents extends string | Uint8Array = string> {
    readonly path: string;
    readonly contents: Contents;
}

/**
 * DRIVEN PORT — the clock of this machine. The hexagon asks what time it is
 * and is told; which clock answers is the adapter's business.
 */
interface ForTellingTime {
    /** This moment. */
    tellTime(): Date;
}

/** What an adapter answering this port raises when a file cannot be written,
 *  a folder cannot be taken away, or a path reaches out of its folder, named
 *  again here so it names this port and nothing behind it. */

/**
 * DRIVEN PORT — repository, the writing half. What writing to the repository
 * needs: put this text at this path, and take that file away. Every path is
 * the repository's, as `ForReadingFiles` says one (CORE-FR-217).
 *
 * Apart from `ForReadingFiles` because the split is the point (FR-041). A
 * service constructed without this one cannot write whoever calls it, which is
 * what makes `diagnoseCharter` provably read-only rather than politely so.
 *
 * Files, never patches: compiled output is regenerated whole, so what is handed
 * over is everything the file should hold (FR-020).
 */
interface ForWritingFiles {
    /** Put this text, or these bytes as they are, at this file, whatever is
     *  there now, making whatever directories it takes to get to it. An
     *  executable file is one its owner may run by its path (CORE-FR-208). */
    writeFile(filePath: string, contents: string | Uint8Array, options?: {
        readonly isExecutable?: boolean;
    }): Promise<void>;
    /** Take this file away. A file that is not there is already gone rather than
     *  a failure: a build that deletes what a previous build wrote is asking for
     *  an end state, not for a file to exist first. */
    deleteFile(filePath: string): Promise<void>;
    /** Take this folder away, with everything under it, whatever that is. A
     *  folder that is not there is already gone, as a file is. */
    deleteFolder(folderPath: string): Promise<void>;
    /** Take this folder away only if it holds nothing at all, and leave it as it
     *  is otherwise. A folder that is not there is already gone. */
    deleteEmptyFolder(folderPath: string): Promise<void>;
}

/** DRIVEN ADAPTER: the terminal. Results on stdout, problems on stderr, so a
 *  pipeline can separate what it asked for from what went wrong. */
declare class ConsoleReporter implements ForReportingProgress {
    reportProgress(text: string): void;
    reportProblem(text: string): void;
}

/** DRIVEN ADAPTER: the filesystem, written to. What the charter compiles to,
 *  put where a host will look for it.
 *
 *  The directories are made on the way: a projection lands in `.claude/skills/`
 *  whether anything has been built here before or not, and the hexagon names a
 *  path rather than a sequence of directories to create.
 *
 *  Set up on one folder, the repository's root, and every path it is handed
 *  is from there (CORE-FR-217). */
declare class FileOutput implements ForWritingFiles {
    #private;
    constructor(
    /** The folder every path is from: refused here unless it names one
     *  (SDK-FR-010). */
    rootFolder: URL);
    writeFile(filePath: string, contents: string | Uint8Array, options?: {
        readonly isExecutable?: boolean;
    }): Promise<void>;
    deleteFile(filePath: string): Promise<void>;
    deleteFolder(folderPath: string): Promise<void>;
    deleteEmptyFolder(folderPath: string): Promise<void>;
}

/** DRIVEN ADAPTER: the filesystem. The charter as it was authored, on a disk.
 *
 *  A directory that is not there is no files rather than a failure: a charter
 *  holding some of the kind directories and not the rest is a charter, and the
 *  rest are authored the day someone needs them. Anything else the disk refuses — a
 *  permission, a broken link — is raised, since that is a repository to fix and
 *  not a charter to report on.
 *
 *  Set up on one folder, the repository's root, and every path it is asked
 *  is from there (CORE-FR-217). */
declare class FileReaders implements ForReadingFiles {
    #private;
    constructor(
    /** The folder every path is from: refused here unless it names one
     *  (SDK-FR-010). */
    rootFolder: URL);
    readFilesRecursively(folderPath: string): Promise<readonly ReadFile[]>;
    readBytesRecursively(folderPath: string): Promise<readonly ReadFile<Uint8Array>[]>;
    listFiles(folderPath: string): Promise<readonly ListedFile[]>;
    listFolders(folderPath: string): Promise<readonly string[]>;
    findFileAddress(filePath: string): string;
    readIfThere(filePath: string): Promise<string | undefined>;
    readBytesIfThere(filePath: string): Promise<Uint8Array | undefined>;
}

/**
 * DRIVEN ADAPTER: the mcp origins a charter declares, reached over the SDK's own
 * client — Streamable HTTP to an endpoint, standard input and output to a local
 * command it starts.
 *
 * An mcp origin at an endpoint is sent the token each call is handed as a bearer
 * credential, so a renewal takes effect at the next call. A local command is
 * handed its token once, in the variable its mcp names and in no other way, and
 * is stopped when its mcp origin is let go. Its standard error is the server's own.
 */
declare class McpClients implements ForCallingMcpServers {
    connectServer({ address, endpoint, command }: McpServerAddress, accessToken: string | undefined, timeoutMs: number): Promise<McpServerConnection>;
}

/** DRIVEN ADAPTER: the system clock. */
declare class SystemClock implements ForTellingTime {
    tellTime(): Date;
}