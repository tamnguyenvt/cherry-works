// Recorded from dist/index.d.ts as "pnpm build" leaves it, the contract 1.0.0 is to be the first release under. Nothing has been published under it yet. Do not edit: "pnpm release" writes it again from the library it publishes.
import { z } from './zod/index.js';

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
    static readonly throwAggregate: typeof throwAggregateError;
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
/** Throws every fault at once: what is wrong is said once and in full rather
 *  than one exception at a time, so a caller reading a whole charter can name
 *  them all (FR-009). `AggregateError` is what the language already has for
 *  this, and what it carries is the faults themselves.
 *
 *  It asks for faults and not for a class of them: anything that is a fault can
 *  be thrown this way. */
declare function throwAggregateError(faults: readonly DomainFault[]): never;
/** What is wrong, under the file it is wrong with. A file nothing is wrong with
 *  is not in here at all. The one shape everything that reads a workspace
 *  answers in, so what a charter got wrong and what its settings did are read
 *  together without either being unwrapped first (FR-009). */
declare class FaultsByFile {
    #private;
    /** Nothing wrong with any file. */
    static readonly none: FaultsByFile;
    constructor(files: Readonly<Record<string, readonly DomainFault[]>>);
    /** Every fault, under the file it is wrong with. */
    get files(): Readonly<Record<string, readonly DomainFault[]>>;
    /** Is no file wrong at all? */
    get isEmpty(): boolean;
    /** These and the other's together, a file both name holding the faults of
     *  both. */
    with(other: FaultsByFile): FaultsByFile;
    /** What is wrong badly enough to stop a build, under the file that has to
     *  change. A file whose every fault is a warning is not in here at all
     *  (FR-005). */
    errors(): FaultsByFile;
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
    report(text: string): void;
    /** A problem, and the next move after it (FR-009, SC-003). */
    problem(text: string): void;
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
    callTool(name: string, args: Readonly<Record<string, unknown>>, accessToken: string | undefined): Promise<ToolAnswer>;
    /** Let go of the mcp origin: a local command it started is stopped. */
    close(): Promise<void>;
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
    connect(mcpServerAddress: McpServerAddress, accessToken: string | undefined, timeoutMs: number): Promise<McpServerConnection>;
}

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
    now(): Date;
}

/** What an adapter answering this port raises when a folder cannot be taken
 *  away, named again here so it names this port and nothing behind it. */

/**
 * DRIVEN PORT — repository, the writing half. What writing to the repository
 * needs: put this text at this path, and take that file away. Every path is
 * the repository's, as `ForReadingFiles` says one (CORE-FR-217).
 *
 * Apart from `ForReadingFiles` because the split is the point (FR-041). A
 * service constructed without this one cannot write whoever calls it, which is
 * what makes `doctor` provably read-only rather than politely so.
 *
 * Files, never patches: compiled output is regenerated whole, so what is handed
 * over is everything the file should hold (FR-020).
 */
interface ForWritingFiles {
    /** Put this text, or these bytes as they are, at this file, whatever is
     *  there now, making whatever directories it takes to get to it. An
     *  executable file is one its owner may run by its path (CORE-FR-208). */
    write(filePath: string, contents: string | Uint8Array, options?: {
        readonly executable?: boolean;
    }): Promise<void>;
    /** Take this file away. A file that is not there is already gone rather than
     *  a failure: a build that deletes what a previous build wrote is asking for
     *  an end state, not for a file to exist first. */
    delete(filePath: string): Promise<void>;
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
    report(text: string): void;
    problem(text: string): void;
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
    write(filePath: string, contents: string | Uint8Array, options?: {
        readonly executable?: boolean;
    }): Promise<void>;
    delete(filePath: string): Promise<void>;
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
    connect({ address, endpoint, command }: McpServerAddress, accessToken: string | undefined, timeoutMs: number): Promise<McpServerConnection>;
}

/** DRIVEN ADAPTER: the system clock. */
declare class SystemClock implements ForTellingTime {
    now(): Date;
}

/** Every schema of this module's DTOs, under its name — the name it carries
 *  as `type` — in alphabetical order. */
declare const CharterDTOs: {
    PrimitiveKinds: z.ZodObject<{
        type: z.ZodLiteral<"PrimitiveKinds">;
        data: z.ZodRecord<z.ZodString, z.ZodString>;
    }, z.core.$strip> & {
        of: (dataValue: Record<string, string>) => {
            type: "PrimitiveKinds";
            data: Record<string, string>;
        };
    };
    CatalogueEntry: z.ZodObject<{
        type: z.ZodLiteral<"CatalogueEntry">;
        data: z.ZodObject<{
            agentProviders: z.ZodUnion<readonly [z.ZodLiteral<"all">, z.ZodReadonly<z.ZodArray<z.ZodString>>]>;
            id: z.ZodString;
            kind: z.ZodString;
            description: z.ZodString;
            file: z.ZodString;
            globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            agentProviders: readonly string[] | "all";
            id: string;
            kind: string;
            description: string;
            file: string;
            globs?: readonly string[] | undefined;
        }) => {
            type: "CatalogueEntry";
            data: {
                agentProviders: readonly string[] | "all";
                id: string;
                kind: string;
                description: string;
                file: string;
                globs?: readonly string[] | undefined;
            };
        };
    };
    Catalogue: z.ZodObject<{
        type: z.ZodLiteral<"Catalogue">;
        data: z.ZodObject<{
            entries: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                type: z.ZodLiteral<"CatalogueEntry">;
                data: z.ZodObject<{
                    agentProviders: z.ZodUnion<readonly [z.ZodLiteral<"all">, z.ZodReadonly<z.ZodArray<z.ZodString>>]>;
                    id: z.ZodString;
                    kind: z.ZodString;
                    description: z.ZodString;
                    file: z.ZodString;
                    globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
                }, z.core.$strip>;
            }, z.core.$strip> & {
                of: (dataValue: {
                    agentProviders: readonly string[] | "all";
                    id: string;
                    kind: string;
                    description: string;
                    file: string;
                    globs?: readonly string[] | undefined;
                }) => {
                    type: "CatalogueEntry";
                    data: {
                        agentProviders: readonly string[] | "all";
                        id: string;
                        kind: string;
                        description: string;
                        file: string;
                        globs?: readonly string[] | undefined;
                    };
                };
            }>>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            entries: readonly {
                type: "CatalogueEntry";
                data: {
                    agentProviders: readonly string[] | "all";
                    id: string;
                    kind: string;
                    description: string;
                    file: string;
                    globs?: readonly string[] | undefined;
                };
            }[];
        }) => {
            type: "Catalogue";
            data: {
                entries: readonly {
                    type: "CatalogueEntry";
                    data: {
                        agentProviders: readonly string[] | "all";
                        id: string;
                        kind: string;
                        description: string;
                        file: string;
                        globs?: readonly string[] | undefined;
                    };
                }[];
            };
        };
    };
    Primitive: z.ZodObject<{
        type: z.ZodLiteral<"Primitive">;
        data: z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodString;
            description: z.ZodString;
            file: z.ZodString;
            layerName: z.ZodEnum<{
                repo: "repo";
                vendor: "vendor";
                builtin: "builtin";
            }>;
            headers: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodReadonly<z.ZodArray<z.ZodString>>]>>;
            body: z.ZodString;
            hash: z.ZodString;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            id: string;
            kind: string;
            description: string;
            file: string;
            layerName: "repo" | "vendor" | "builtin";
            headers: Record<string, string | readonly string[]>;
            body: string;
            hash: string;
        }) => {
            type: "Primitive";
            data: {
                id: string;
                kind: string;
                description: string;
                file: string;
                layerName: "repo" | "vendor" | "builtin";
                headers: Record<string, string | readonly string[]>;
                body: string;
                hash: string;
            };
        };
    };
    Primitives: z.ZodObject<{
        type: z.ZodLiteral<"Primitives">;
        data: z.ZodObject<{
            primitives: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                type: z.ZodLiteral<"Primitive">;
                data: z.ZodObject<{
                    id: z.ZodString;
                    kind: z.ZodString;
                    description: z.ZodString;
                    file: z.ZodString;
                    layerName: z.ZodEnum<{
                        repo: "repo";
                        vendor: "vendor";
                        builtin: "builtin";
                    }>;
                    headers: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodReadonly<z.ZodArray<z.ZodString>>]>>;
                    body: z.ZodString;
                    hash: z.ZodString;
                }, z.core.$strip>;
            }, z.core.$strip> & {
                of: (dataValue: {
                    id: string;
                    kind: string;
                    description: string;
                    file: string;
                    layerName: "repo" | "vendor" | "builtin";
                    headers: Record<string, string | readonly string[]>;
                    body: string;
                    hash: string;
                }) => {
                    type: "Primitive";
                    data: {
                        id: string;
                        kind: string;
                        description: string;
                        file: string;
                        layerName: "repo" | "vendor" | "builtin";
                        headers: Record<string, string | readonly string[]>;
                        body: string;
                        hash: string;
                    };
                };
            }>>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            primitives: readonly {
                type: "Primitive";
                data: {
                    id: string;
                    kind: string;
                    description: string;
                    file: string;
                    layerName: "repo" | "vendor" | "builtin";
                    headers: Record<string, string | readonly string[]>;
                    body: string;
                    hash: string;
                };
            }[];
        }) => {
            type: "Primitives";
            data: {
                primitives: readonly {
                    type: "Primitive";
                    data: {
                        id: string;
                        kind: string;
                        description: string;
                        file: string;
                        layerName: "repo" | "vendor" | "builtin";
                        headers: Record<string, string | readonly string[]>;
                        body: string;
                        hash: string;
                    };
                }[];
            };
        };
    };
    PlanSummary: z.ZodObject<{
        type: z.ZodLiteral<"PlanSummary">;
        data: z.ZodObject<{
            added: z.ZodReadonly<z.ZodArray<z.ZodString>>;
            edited: z.ZodReadonly<z.ZodArray<z.ZodString>>;
            deleted: z.ZodReadonly<z.ZodArray<z.ZodString>>;
            unchanged: z.ZodReadonly<z.ZodArray<z.ZodString>>;
            warnings: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            added: readonly string[];
            edited: readonly string[];
            deleted: readonly string[];
            unchanged: readonly string[];
            warnings?: readonly string[] | undefined;
        }) => {
            type: "PlanSummary";
            data: {
                added: readonly string[];
                edited: readonly string[];
                deleted: readonly string[];
                unchanged: readonly string[];
                warnings?: readonly string[] | undefined;
            };
        };
    };
    PrimitiveHeader: z.ZodObject<{
        type: z.ZodLiteral<"PrimitiveHeader">;
        data: z.ZodObject<{
            field: z.ZodString;
            shape: z.ZodEnum<{
                line: "line";
                list: "list";
            }>;
            required: z.ZodBoolean;
            allowedValues: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            field: string;
            shape: "line" | "list";
            required: boolean;
            allowedValues?: readonly string[] | undefined;
        }) => {
            type: "PrimitiveHeader";
            data: {
                field: string;
                shape: "line" | "list";
                required: boolean;
                allowedValues?: readonly string[] | undefined;
            };
        };
    };
    PrimitiveRequirements: z.ZodObject<{
        type: z.ZodLiteral<"PrimitiveRequirements">;
        data: z.ZodObject<{
            headers: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                type: z.ZodLiteral<"PrimitiveHeader">;
                data: z.ZodObject<{
                    field: z.ZodString;
                    shape: z.ZodEnum<{
                        line: "line";
                        list: "list";
                    }>;
                    required: z.ZodBoolean;
                    allowedValues: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
                }, z.core.$strip>;
            }, z.core.$strip> & {
                of: (dataValue: {
                    field: string;
                    shape: "line" | "list";
                    required: boolean;
                    allowedValues?: readonly string[] | undefined;
                }) => {
                    type: "PrimitiveHeader";
                    data: {
                        field: string;
                        shape: "line" | "list";
                        required: boolean;
                        allowedValues?: readonly string[] | undefined;
                    };
                };
            }>>;
            sample: z.ZodString;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            headers: readonly {
                type: "PrimitiveHeader";
                data: {
                    field: string;
                    shape: "line" | "list";
                    required: boolean;
                    allowedValues?: readonly string[] | undefined;
                };
            }[];
            sample: string;
        }) => {
            type: "PrimitiveRequirements";
            data: {
                headers: readonly {
                    type: "PrimitiveHeader";
                    data: {
                        field: string;
                        shape: "line" | "list";
                        required: boolean;
                        allowedValues?: readonly string[] | undefined;
                    };
                }[];
                sample: string;
            };
        };
    };
    TestCasesByFile: z.ZodObject<{
        type: z.ZodLiteral<"TestCasesByFile">;
        data: z.ZodRecord<z.ZodString, z.ZodReadonly<z.ZodArray<z.ZodString>>>;
    }, z.core.$strip> & {
        of: (dataValue: Record<string, readonly string[]>) => {
            type: "TestCasesByFile";
            data: Record<string, readonly string[]>;
        };
    };
    TestCaseReport: z.ZodObject<{
        type: z.ZodLiteral<"TestCaseReport">;
        data: z.ZodObject<{
            suiteName: z.ZodString;
            situation: z.ZodString;
            passed: z.ZodBoolean;
            unmet: z.ZodOptional<z.ZodObject<{
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
            }>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            suiteName: string;
            situation: string;
            passed: boolean;
            unmet?: {
                type: "Fault";
                data: {
                    name: string;
                    message: string;
                    fix: string;
                    severity: "error" | "warn";
                };
            } | undefined;
        }) => {
            type: "TestCaseReport";
            data: {
                suiteName: string;
                situation: string;
                passed: boolean;
                unmet?: {
                    type: "Fault";
                    data: {
                        name: string;
                        message: string;
                        fix: string;
                        severity: "error" | "warn";
                    };
                } | undefined;
            };
        };
    };
    TestRunReport: z.ZodObject<{
        type: z.ZodLiteral<"TestRunReport">;
        data: z.ZodObject<{
            testCaseReports: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                type: z.ZodLiteral<"TestCaseReport">;
                data: z.ZodObject<{
                    suiteName: z.ZodString;
                    situation: z.ZodString;
                    passed: z.ZodBoolean;
                    unmet: z.ZodOptional<z.ZodObject<{
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
                    }>;
                }, z.core.$strip>;
            }, z.core.$strip> & {
                of: (dataValue: {
                    suiteName: string;
                    situation: string;
                    passed: boolean;
                    unmet?: {
                        type: "Fault";
                        data: {
                            name: string;
                            message: string;
                            fix: string;
                            severity: "error" | "warn";
                        };
                    } | undefined;
                }) => {
                    type: "TestCaseReport";
                    data: {
                        suiteName: string;
                        situation: string;
                        passed: boolean;
                        unmet?: {
                            type: "Fault";
                            data: {
                                name: string;
                                message: string;
                                fix: string;
                                severity: "error" | "warn";
                            };
                        } | undefined;
                    };
                };
            }>>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            testCaseReports: readonly {
                type: "TestCaseReport";
                data: {
                    suiteName: string;
                    situation: string;
                    passed: boolean;
                    unmet?: {
                        type: "Fault";
                        data: {
                            name: string;
                            message: string;
                            fix: string;
                            severity: "error" | "warn";
                        };
                    } | undefined;
                };
            }[];
        }) => {
            type: "TestRunReport";
            data: {
                testCaseReports: readonly {
                    type: "TestCaseReport";
                    data: {
                        suiteName: string;
                        situation: string;
                        passed: boolean;
                        unmet?: {
                            type: "Fault";
                            data: {
                                name: string;
                                message: string;
                                fix: string;
                                severity: "error" | "warn";
                            };
                        } | undefined;
                    };
                }[];
            };
        };
    };
    TestCase: z.ZodObject<{
        type: z.ZodLiteral<"TestCase">;
        data: z.ZodObject<{
            situation: z.ZodString;
            expectation: z.ZodString;
            id: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            situation: string;
            expectation: string;
            id?: string | undefined;
        }) => {
            type: "TestCase";
            data: {
                situation: string;
                expectation: string;
                id?: string | undefined;
            };
        };
    };
    TestSuite: z.ZodObject<{
        type: z.ZodLiteral<"TestSuite">;
        data: z.ZodObject<{
            name: z.ZodString;
            text: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            cases: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                type: z.ZodLiteral<"TestCase">;
                data: z.ZodObject<{
                    situation: z.ZodString;
                    expectation: z.ZodString;
                    id: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>;
            }, z.core.$strip> & {
                of: (dataValue: {
                    situation: string;
                    expectation: string;
                    id?: string | undefined;
                }) => {
                    type: "TestCase";
                    data: {
                        situation: string;
                        expectation: string;
                        id?: string | undefined;
                    };
                };
            }>>;
            fault: z.ZodOptional<z.ZodObject<{
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
            }>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            name: string;
            cases: readonly {
                type: "TestCase";
                data: {
                    situation: string;
                    expectation: string;
                    id?: string | undefined;
                };
            }[];
            text?: string | undefined;
            description?: string | undefined;
            fault?: {
                type: "Fault";
                data: {
                    name: string;
                    message: string;
                    fix: string;
                    severity: "error" | "warn";
                };
            } | undefined;
        }) => {
            type: "TestSuite";
            data: {
                name: string;
                cases: readonly {
                    type: "TestCase";
                    data: {
                        situation: string;
                        expectation: string;
                        id?: string | undefined;
                    };
                }[];
                text?: string | undefined;
                description?: string | undefined;
                fault?: {
                    type: "Fault";
                    data: {
                        name: string;
                        message: string;
                        fix: string;
                        severity: "error" | "warn";
                    };
                } | undefined;
            };
        };
    };
    TestSuites: z.ZodObject<{
        type: z.ZodLiteral<"TestSuites">;
        data: z.ZodObject<{
            testSuites: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                type: z.ZodLiteral<"TestSuite">;
                data: z.ZodObject<{
                    name: z.ZodString;
                    text: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    cases: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                        type: z.ZodLiteral<"TestCase">;
                        data: z.ZodObject<{
                            situation: z.ZodString;
                            expectation: z.ZodString;
                            id: z.ZodOptional<z.ZodString>;
                        }, z.core.$strip>;
                    }, z.core.$strip> & {
                        of: (dataValue: {
                            situation: string;
                            expectation: string;
                            id?: string | undefined;
                        }) => {
                            type: "TestCase";
                            data: {
                                situation: string;
                                expectation: string;
                                id?: string | undefined;
                            };
                        };
                    }>>;
                    fault: z.ZodOptional<z.ZodObject<{
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
                    }>;
                }, z.core.$strip>;
            }, z.core.$strip> & {
                of: (dataValue: {
                    name: string;
                    cases: readonly {
                        type: "TestCase";
                        data: {
                            situation: string;
                            expectation: string;
                            id?: string | undefined;
                        };
                    }[];
                    text?: string | undefined;
                    description?: string | undefined;
                    fault?: {
                        type: "Fault";
                        data: {
                            name: string;
                            message: string;
                            fix: string;
                            severity: "error" | "warn";
                        };
                    } | undefined;
                }) => {
                    type: "TestSuite";
                    data: {
                        name: string;
                        cases: readonly {
                            type: "TestCase";
                            data: {
                                situation: string;
                                expectation: string;
                                id?: string | undefined;
                            };
                        }[];
                        text?: string | undefined;
                        description?: string | undefined;
                        fault?: {
                            type: "Fault";
                            data: {
                                name: string;
                                message: string;
                                fix: string;
                                severity: "error" | "warn";
                            };
                        } | undefined;
                    };
                };
            }>>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            testSuites: readonly {
                type: "TestSuite";
                data: {
                    name: string;
                    cases: readonly {
                        type: "TestCase";
                        data: {
                            situation: string;
                            expectation: string;
                            id?: string | undefined;
                        };
                    }[];
                    text?: string | undefined;
                    description?: string | undefined;
                    fault?: {
                        type: "Fault";
                        data: {
                            name: string;
                            message: string;
                            fix: string;
                            severity: "error" | "warn";
                        };
                    } | undefined;
                };
            }[];
        }) => {
            type: "TestSuites";
            data: {
                testSuites: readonly {
                    type: "TestSuite";
                    data: {
                        name: string;
                        cases: readonly {
                            type: "TestCase";
                            data: {
                                situation: string;
                                expectation: string;
                                id?: string | undefined;
                            };
                        }[];
                        text?: string | undefined;
                        description?: string | undefined;
                        fault?: {
                            type: "Fault";
                            data: {
                                name: string;
                                message: string;
                                fix: string;
                                severity: "error" | "warn";
                            };
                        } | undefined;
                    };
                }[];
            };
        };
    };
    TestSuiteName: z.ZodObject<{
        type: z.ZodLiteral<"TestSuiteName">;
        data: z.ZodObject<{
            name: z.ZodString;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            name: string;
        }) => {
            type: "TestSuiteName";
            data: {
                name: string;
            };
        };
    };
    EvalCase: z.ZodObject<{
        type: z.ZodLiteral<"EvalCase">;
        data: z.ZodObject<{
            prompt: z.ZodString;
            invoke: z.ZodOptional<z.ZodString>;
            follow: z.ZodOptional<z.ZodString>;
            read: z.ZodOptional<z.ZodString>;
            maxTokens: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            prompt: string;
            invoke?: string | undefined;
            follow?: string | undefined;
            read?: string | undefined;
            maxTokens?: number | undefined;
        }) => {
            type: "EvalCase";
            data: {
                prompt: string;
                invoke?: string | undefined;
                follow?: string | undefined;
                read?: string | undefined;
                maxTokens?: number | undefined;
            };
        };
    };
    EvalSuite: z.ZodObject<{
        type: z.ZodLiteral<"EvalSuite">;
        data: z.ZodObject<{
            name: z.ZodString;
            text: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            cases: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                type: z.ZodLiteral<"EvalCase">;
                data: z.ZodObject<{
                    prompt: z.ZodString;
                    invoke: z.ZodOptional<z.ZodString>;
                    follow: z.ZodOptional<z.ZodString>;
                    read: z.ZodOptional<z.ZodString>;
                    maxTokens: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strip>;
            }, z.core.$strip> & {
                of: (dataValue: {
                    prompt: string;
                    invoke?: string | undefined;
                    follow?: string | undefined;
                    read?: string | undefined;
                    maxTokens?: number | undefined;
                }) => {
                    type: "EvalCase";
                    data: {
                        prompt: string;
                        invoke?: string | undefined;
                        follow?: string | undefined;
                        read?: string | undefined;
                        maxTokens?: number | undefined;
                    };
                };
            }>>;
            fault: z.ZodOptional<z.ZodObject<{
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
            }>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            name: string;
            cases: readonly {
                type: "EvalCase";
                data: {
                    prompt: string;
                    invoke?: string | undefined;
                    follow?: string | undefined;
                    read?: string | undefined;
                    maxTokens?: number | undefined;
                };
            }[];
            text?: string | undefined;
            description?: string | undefined;
            fault?: {
                type: "Fault";
                data: {
                    name: string;
                    message: string;
                    fix: string;
                    severity: "error" | "warn";
                };
            } | undefined;
        }) => {
            type: "EvalSuite";
            data: {
                name: string;
                cases: readonly {
                    type: "EvalCase";
                    data: {
                        prompt: string;
                        invoke?: string | undefined;
                        follow?: string | undefined;
                        read?: string | undefined;
                        maxTokens?: number | undefined;
                    };
                }[];
                text?: string | undefined;
                description?: string | undefined;
                fault?: {
                    type: "Fault";
                    data: {
                        name: string;
                        message: string;
                        fix: string;
                        severity: "error" | "warn";
                    };
                } | undefined;
            };
        };
    };
    EvalSuites: z.ZodObject<{
        type: z.ZodLiteral<"EvalSuites">;
        data: z.ZodObject<{
            evalSuites: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                type: z.ZodLiteral<"EvalSuite">;
                data: z.ZodObject<{
                    name: z.ZodString;
                    text: z.ZodOptional<z.ZodString>;
                    description: z.ZodOptional<z.ZodString>;
                    cases: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                        type: z.ZodLiteral<"EvalCase">;
                        data: z.ZodObject<{
                            prompt: z.ZodString;
                            invoke: z.ZodOptional<z.ZodString>;
                            follow: z.ZodOptional<z.ZodString>;
                            read: z.ZodOptional<z.ZodString>;
                            maxTokens: z.ZodOptional<z.ZodNumber>;
                        }, z.core.$strip>;
                    }, z.core.$strip> & {
                        of: (dataValue: {
                            prompt: string;
                            invoke?: string | undefined;
                            follow?: string | undefined;
                            read?: string | undefined;
                            maxTokens?: number | undefined;
                        }) => {
                            type: "EvalCase";
                            data: {
                                prompt: string;
                                invoke?: string | undefined;
                                follow?: string | undefined;
                                read?: string | undefined;
                                maxTokens?: number | undefined;
                            };
                        };
                    }>>;
                    fault: z.ZodOptional<z.ZodObject<{
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
                    }>;
                }, z.core.$strip>;
            }, z.core.$strip> & {
                of: (dataValue: {
                    name: string;
                    cases: readonly {
                        type: "EvalCase";
                        data: {
                            prompt: string;
                            invoke?: string | undefined;
                            follow?: string | undefined;
                            read?: string | undefined;
                            maxTokens?: number | undefined;
                        };
                    }[];
                    text?: string | undefined;
                    description?: string | undefined;
                    fault?: {
                        type: "Fault";
                        data: {
                            name: string;
                            message: string;
                            fix: string;
                            severity: "error" | "warn";
                        };
                    } | undefined;
                }) => {
                    type: "EvalSuite";
                    data: {
                        name: string;
                        cases: readonly {
                            type: "EvalCase";
                            data: {
                                prompt: string;
                                invoke?: string | undefined;
                                follow?: string | undefined;
                                read?: string | undefined;
                                maxTokens?: number | undefined;
                            };
                        }[];
                        text?: string | undefined;
                        description?: string | undefined;
                        fault?: {
                            type: "Fault";
                            data: {
                                name: string;
                                message: string;
                                fix: string;
                                severity: "error" | "warn";
                            };
                        } | undefined;
                    };
                };
            }>>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            evalSuites: readonly {
                type: "EvalSuite";
                data: {
                    name: string;
                    cases: readonly {
                        type: "EvalCase";
                        data: {
                            prompt: string;
                            invoke?: string | undefined;
                            follow?: string | undefined;
                            read?: string | undefined;
                            maxTokens?: number | undefined;
                        };
                    }[];
                    text?: string | undefined;
                    description?: string | undefined;
                    fault?: {
                        type: "Fault";
                        data: {
                            name: string;
                            message: string;
                            fix: string;
                            severity: "error" | "warn";
                        };
                    } | undefined;
                };
            }[];
        }) => {
            type: "EvalSuites";
            data: {
                evalSuites: readonly {
                    type: "EvalSuite";
                    data: {
                        name: string;
                        cases: readonly {
                            type: "EvalCase";
                            data: {
                                prompt: string;
                                invoke?: string | undefined;
                                follow?: string | undefined;
                                read?: string | undefined;
                                maxTokens?: number | undefined;
                            };
                        }[];
                        text?: string | undefined;
                        description?: string | undefined;
                        fault?: {
                            type: "Fault";
                            data: {
                                name: string;
                                message: string;
                                fix: string;
                                severity: "error" | "warn";
                            };
                        } | undefined;
                    };
                }[];
            };
        };
    };
    EvalSuiteName: z.ZodObject<{
        type: z.ZodLiteral<"EvalSuiteName">;
        data: z.ZodObject<{
            name: z.ZodString;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            name: string;
        }) => {
            type: "EvalSuiteName";
            data: {
                name: string;
            };
        };
    };
    VendorFolder: z.ZodObject<{
        type: z.ZodLiteral<"VendorFolder">;
        data: z.ZodObject<{
            folder: z.ZodString;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            folder: string;
        }) => {
            type: "VendorFolder";
            data: {
                folder: string;
            };
        };
    };
    VendorFolders: z.ZodObject<{
        type: z.ZodLiteral<"VendorFolders">;
        data: z.ZodObject<{
            folders: z.ZodReadonly<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            folders: readonly string[];
        }) => {
            type: "VendorFolders";
            data: {
                folders: readonly string[];
            };
        };
    };
    SignInStatus: z.ZodObject<{
        type: z.ZodLiteral<"SignInStatus">;
        data: z.ZodObject<{
            address: z.ZodString;
            ids: z.ZodReadonly<z.ZodArray<z.ZodString>>;
            auth: z.ZodReadonly<z.ZodArray<z.ZodEnum<{
                oauth: "oauth";
                token: "token";
            }>>>;
            signedIn: z.ZodBoolean;
            method: z.ZodOptional<z.ZodEnum<{
                oauth: "oauth";
                token: "token";
            }>>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            address: string;
            ids: readonly string[];
            auth: readonly ("oauth" | "token")[];
            signedIn: boolean;
            method?: "oauth" | "token" | undefined;
        }) => {
            type: "SignInStatus";
            data: {
                address: string;
                ids: readonly string[];
                auth: readonly ("oauth" | "token")[];
                signedIn: boolean;
                method?: "oauth" | "token" | undefined;
            };
        };
    };
    SignInStatuses: z.ZodObject<{
        type: z.ZodLiteral<"SignInStatuses">;
        data: z.ZodObject<{
            signInStatuses: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                type: z.ZodLiteral<"SignInStatus">;
                data: z.ZodObject<{
                    address: z.ZodString;
                    ids: z.ZodReadonly<z.ZodArray<z.ZodString>>;
                    auth: z.ZodReadonly<z.ZodArray<z.ZodEnum<{
                        oauth: "oauth";
                        token: "token";
                    }>>>;
                    signedIn: z.ZodBoolean;
                    method: z.ZodOptional<z.ZodEnum<{
                        oauth: "oauth";
                        token: "token";
                    }>>;
                }, z.core.$strip>;
            }, z.core.$strip> & {
                of: (dataValue: {
                    address: string;
                    ids: readonly string[];
                    auth: readonly ("oauth" | "token")[];
                    signedIn: boolean;
                    method?: "oauth" | "token" | undefined;
                }) => {
                    type: "SignInStatus";
                    data: {
                        address: string;
                        ids: readonly string[];
                        auth: readonly ("oauth" | "token")[];
                        signedIn: boolean;
                        method?: "oauth" | "token" | undefined;
                    };
                };
            }>>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            signInStatuses: readonly {
                type: "SignInStatus";
                data: {
                    address: string;
                    ids: readonly string[];
                    auth: readonly ("oauth" | "token")[];
                    signedIn: boolean;
                    method?: "oauth" | "token" | undefined;
                };
            }[];
        }) => {
            type: "SignInStatuses";
            data: {
                signInStatuses: readonly {
                    type: "SignInStatus";
                    data: {
                        address: string;
                        ids: readonly string[];
                        auth: readonly ("oauth" | "token")[];
                        signedIn: boolean;
                        method?: "oauth" | "token" | undefined;
                    };
                }[];
            };
        };
    };
    ServedTool: z.ZodObject<{
        type: z.ZodLiteral<"ServedTool">;
        data: z.ZodObject<{
            name: z.ZodString;
            description: z.ZodString;
            inputSchema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            name: string;
            description: string;
            inputSchema: Record<string, unknown>;
        }) => {
            type: "ServedTool";
            data: {
                name: string;
                description: string;
                inputSchema: Record<string, unknown>;
            };
        };
    };
    ServedTools: z.ZodObject<{
        type: z.ZodLiteral<"ServedTools">;
        data: z.ZodObject<{
            tools: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                type: z.ZodLiteral<"ServedTool">;
                data: z.ZodObject<{
                    name: z.ZodString;
                    description: z.ZodString;
                    inputSchema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
                }, z.core.$strip>;
            }, z.core.$strip> & {
                of: (dataValue: {
                    name: string;
                    description: string;
                    inputSchema: Record<string, unknown>;
                }) => {
                    type: "ServedTool";
                    data: {
                        name: string;
                        description: string;
                        inputSchema: Record<string, unknown>;
                    };
                };
            }>>;
            problems: z.ZodReadonly<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            tools: readonly {
                type: "ServedTool";
                data: {
                    name: string;
                    description: string;
                    inputSchema: Record<string, unknown>;
                };
            }[];
            problems: readonly string[];
        }) => {
            type: "ServedTools";
            data: {
                tools: readonly {
                    type: "ServedTool";
                    data: {
                        name: string;
                        description: string;
                        inputSchema: Record<string, unknown>;
                    };
                }[];
                problems: readonly string[];
            };
        };
    };
    VendorPrimitive: z.ZodObject<{
        type: z.ZodLiteral<"VendorPrimitive">;
        data: z.ZodObject<{
            kind: z.ZodString;
            id: z.ZodString;
            description: z.ZodString;
            leftOutHeaders: z.ZodReadonly<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            kind: string;
            id: string;
            description: string;
            leftOutHeaders: readonly string[];
        }) => {
            type: "VendorPrimitive";
            data: {
                kind: string;
                id: string;
                description: string;
                leftOutHeaders: readonly string[];
            };
        };
    };
    MainContextLoad: z.ZodObject<{
        type: z.ZodLiteral<"MainContextLoad">;
        data: z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodString;
            tokens: z.ZodNumber;
            globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            id: string;
            kind: string;
            tokens: number;
            globs?: readonly string[] | undefined;
        }) => {
            type: "MainContextLoad";
            data: {
                id: string;
                kind: string;
                tokens: number;
                globs?: readonly string[] | undefined;
            };
        };
    };
    MainContext: z.ZodObject<{
        type: z.ZodLiteral<"MainContext">;
        data: z.ZodObject<{
            agent: z.ZodString;
            isExact: z.ZodBoolean;
            sessionLoads: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                type: z.ZodLiteral<"MainContextLoad">;
                data: z.ZodObject<{
                    id: z.ZodString;
                    kind: z.ZodString;
                    tokens: z.ZodNumber;
                    globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
                }, z.core.$strip>;
            }, z.core.$strip> & {
                of: (dataValue: {
                    id: string;
                    kind: string;
                    tokens: number;
                    globs?: readonly string[] | undefined;
                }) => {
                    type: "MainContextLoad";
                    data: {
                        id: string;
                        kind: string;
                        tokens: number;
                        globs?: readonly string[] | undefined;
                    };
                };
            }>>;
            fileLoads: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                type: z.ZodLiteral<"MainContextLoad">;
                data: z.ZodObject<{
                    id: z.ZodString;
                    kind: z.ZodString;
                    tokens: z.ZodNumber;
                    globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
                }, z.core.$strip>;
            }, z.core.$strip> & {
                of: (dataValue: {
                    id: string;
                    kind: string;
                    tokens: number;
                    globs?: readonly string[] | undefined;
                }) => {
                    type: "MainContextLoad";
                    data: {
                        id: string;
                        kind: string;
                        tokens: number;
                        globs?: readonly string[] | undefined;
                    };
                };
            }>>;
            totalTokens: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            agent: string;
            isExact: boolean;
            sessionLoads: readonly {
                type: "MainContextLoad";
                data: {
                    id: string;
                    kind: string;
                    tokens: number;
                    globs?: readonly string[] | undefined;
                };
            }[];
            fileLoads: readonly {
                type: "MainContextLoad";
                data: {
                    id: string;
                    kind: string;
                    tokens: number;
                    globs?: readonly string[] | undefined;
                };
            }[];
            totalTokens: number;
        }) => {
            type: "MainContext";
            data: {
                agent: string;
                isExact: boolean;
                sessionLoads: readonly {
                    type: "MainContextLoad";
                    data: {
                        id: string;
                        kind: string;
                        tokens: number;
                        globs?: readonly string[] | undefined;
                    };
                }[];
                fileLoads: readonly {
                    type: "MainContextLoad";
                    data: {
                        id: string;
                        kind: string;
                        tokens: number;
                        globs?: readonly string[] | undefined;
                    };
                }[];
                totalTokens: number;
            };
        };
    };
    MainContexts: z.ZodObject<{
        type: z.ZodLiteral<"MainContexts">;
        data: z.ZodObject<{
            contexts: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                type: z.ZodLiteral<"MainContext">;
                data: z.ZodObject<{
                    agent: z.ZodString;
                    isExact: z.ZodBoolean;
                    sessionLoads: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                        type: z.ZodLiteral<"MainContextLoad">;
                        data: z.ZodObject<{
                            id: z.ZodString;
                            kind: z.ZodString;
                            tokens: z.ZodNumber;
                            globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
                        }, z.core.$strip>;
                    }, z.core.$strip> & {
                        of: (dataValue: {
                            id: string;
                            kind: string;
                            tokens: number;
                            globs?: readonly string[] | undefined;
                        }) => {
                            type: "MainContextLoad";
                            data: {
                                id: string;
                                kind: string;
                                tokens: number;
                                globs?: readonly string[] | undefined;
                            };
                        };
                    }>>;
                    fileLoads: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                        type: z.ZodLiteral<"MainContextLoad">;
                        data: z.ZodObject<{
                            id: z.ZodString;
                            kind: z.ZodString;
                            tokens: z.ZodNumber;
                            globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
                        }, z.core.$strip>;
                    }, z.core.$strip> & {
                        of: (dataValue: {
                            id: string;
                            kind: string;
                            tokens: number;
                            globs?: readonly string[] | undefined;
                        }) => {
                            type: "MainContextLoad";
                            data: {
                                id: string;
                                kind: string;
                                tokens: number;
                                globs?: readonly string[] | undefined;
                            };
                        };
                    }>>;
                    totalTokens: z.ZodNumber;
                }, z.core.$strip>;
            }, z.core.$strip> & {
                of: (dataValue: {
                    agent: string;
                    isExact: boolean;
                    sessionLoads: readonly {
                        type: "MainContextLoad";
                        data: {
                            id: string;
                            kind: string;
                            tokens: number;
                            globs?: readonly string[] | undefined;
                        };
                    }[];
                    fileLoads: readonly {
                        type: "MainContextLoad";
                        data: {
                            id: string;
                            kind: string;
                            tokens: number;
                            globs?: readonly string[] | undefined;
                        };
                    }[];
                    totalTokens: number;
                }) => {
                    type: "MainContext";
                    data: {
                        agent: string;
                        isExact: boolean;
                        sessionLoads: readonly {
                            type: "MainContextLoad";
                            data: {
                                id: string;
                                kind: string;
                                tokens: number;
                                globs?: readonly string[] | undefined;
                            };
                        }[];
                        fileLoads: readonly {
                            type: "MainContextLoad";
                            data: {
                                id: string;
                                kind: string;
                                tokens: number;
                                globs?: readonly string[] | undefined;
                            };
                        }[];
                        totalTokens: number;
                    };
                };
            }>>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            contexts: readonly {
                type: "MainContext";
                data: {
                    agent: string;
                    isExact: boolean;
                    sessionLoads: readonly {
                        type: "MainContextLoad";
                        data: {
                            id: string;
                            kind: string;
                            tokens: number;
                            globs?: readonly string[] | undefined;
                        };
                    }[];
                    fileLoads: readonly {
                        type: "MainContextLoad";
                        data: {
                            id: string;
                            kind: string;
                            tokens: number;
                            globs?: readonly string[] | undefined;
                        };
                    }[];
                    totalTokens: number;
                };
            }[];
        }) => {
            type: "MainContexts";
            data: {
                contexts: readonly {
                    type: "MainContext";
                    data: {
                        agent: string;
                        isExact: boolean;
                        sessionLoads: readonly {
                            type: "MainContextLoad";
                            data: {
                                id: string;
                                kind: string;
                                tokens: number;
                                globs?: readonly string[] | undefined;
                            };
                        }[];
                        fileLoads: readonly {
                            type: "MainContextLoad";
                            data: {
                                id: string;
                                kind: string;
                                tokens: number;
                                globs?: readonly string[] | undefined;
                            };
                        }[];
                        totalTokens: number;
                    };
                }[];
            };
        };
    };
    AccessToken: z.ZodObject<{
        type: z.ZodLiteral<"AccessToken">;
        data: z.ZodObject<{
            accessToken: z.ZodString;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            accessToken: string;
        }) => {
            type: "AccessToken";
            data: {
                accessToken: string;
            };
        };
    };
    DeclaredTool: z.ZodObject<{
        type: z.ZodLiteral<"DeclaredTool">;
        data: z.ZodObject<{
            servedName: z.ZodString;
            tool: z.ZodString;
            mcpId: z.ZodString;
            origin: z.ZodObject<{
                address: z.ZodString;
                endpoint: z.ZodOptional<z.ZodString>;
                command: z.ZodOptional<z.ZodObject<{
                    command: z.ZodString;
                    args: z.ZodReadonly<z.ZodArray<z.ZodString>>;
                    tokenEnv: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                path: z.ZodOptional<z.ZodString>;
                auth: z.ZodReadonly<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            servedName: string;
            tool: string;
            mcpId: string;
            origin: {
                address: string;
                auth: readonly string[];
                endpoint?: string | undefined;
                command?: {
                    command: string;
                    args: readonly string[];
                    tokenEnv?: string | undefined;
                } | undefined;
                path?: string | undefined;
            };
        }) => {
            type: "DeclaredTool";
            data: {
                servedName: string;
                tool: string;
                mcpId: string;
                origin: {
                    address: string;
                    auth: readonly string[];
                    endpoint?: string | undefined;
                    command?: {
                        command: string;
                        args: readonly string[];
                        tokenEnv?: string | undefined;
                    } | undefined;
                    path?: string | undefined;
                };
            };
        };
    };
    DeclaredTools: z.ZodObject<{
        type: z.ZodLiteral<"DeclaredTools">;
        data: z.ZodObject<{
            tools: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                type: z.ZodLiteral<"DeclaredTool">;
                data: z.ZodObject<{
                    servedName: z.ZodString;
                    tool: z.ZodString;
                    mcpId: z.ZodString;
                    origin: z.ZodObject<{
                        address: z.ZodString;
                        endpoint: z.ZodOptional<z.ZodString>;
                        command: z.ZodOptional<z.ZodObject<{
                            command: z.ZodString;
                            args: z.ZodReadonly<z.ZodArray<z.ZodString>>;
                            tokenEnv: z.ZodOptional<z.ZodString>;
                        }, z.core.$strip>>;
                        path: z.ZodOptional<z.ZodString>;
                        auth: z.ZodReadonly<z.ZodArray<z.ZodString>>;
                    }, z.core.$strip>;
                }, z.core.$strip>;
            }, z.core.$strip> & {
                of: (dataValue: {
                    servedName: string;
                    tool: string;
                    mcpId: string;
                    origin: {
                        address: string;
                        auth: readonly string[];
                        endpoint?: string | undefined;
                        command?: {
                            command: string;
                            args: readonly string[];
                            tokenEnv?: string | undefined;
                        } | undefined;
                        path?: string | undefined;
                    };
                }) => {
                    type: "DeclaredTool";
                    data: {
                        servedName: string;
                        tool: string;
                        mcpId: string;
                        origin: {
                            address: string;
                            auth: readonly string[];
                            endpoint?: string | undefined;
                            command?: {
                                command: string;
                                args: readonly string[];
                                tokenEnv?: string | undefined;
                            } | undefined;
                            path?: string | undefined;
                        };
                    };
                };
            }>>;
            problems: z.ZodReadonly<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            tools: readonly {
                type: "DeclaredTool";
                data: {
                    servedName: string;
                    tool: string;
                    mcpId: string;
                    origin: {
                        address: string;
                        auth: readonly string[];
                        endpoint?: string | undefined;
                        command?: {
                            command: string;
                            args: readonly string[];
                            tokenEnv?: string | undefined;
                        } | undefined;
                        path?: string | undefined;
                    };
                };
            }[];
            problems: readonly string[];
        }) => {
            type: "DeclaredTools";
            data: {
                tools: readonly {
                    type: "DeclaredTool";
                    data: {
                        servedName: string;
                        tool: string;
                        mcpId: string;
                        origin: {
                            address: string;
                            auth: readonly string[];
                            endpoint?: string | undefined;
                            command?: {
                                command: string;
                                args: readonly string[];
                                tokenEnv?: string | undefined;
                            } | undefined;
                            path?: string | undefined;
                        };
                    };
                }[];
                problems: readonly string[];
            };
        };
    };
    SensorCommands: z.ZodObject<{
        type: z.ZodLiteral<"SensorCommands">;
        data: z.ZodObject<{
            commands: z.ZodReadonly<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            commands: readonly string[];
        }) => {
            type: "SensorCommands";
            data: {
                commands: readonly string[];
            };
        };
    };
    MainContextTexts: z.ZodObject<{
        type: z.ZodLiteral<"MainContextTexts">;
        data: z.ZodObject<{
            agents: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                agent: z.ZodString;
                texts: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    kind: z.ZodString;
                    text: z.ZodString;
                    globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
                }, z.core.$strip>>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            agents: readonly {
                agent: string;
                texts: readonly {
                    id: string;
                    kind: string;
                    text: string;
                    globs?: readonly string[] | undefined;
                }[];
            }[];
        }) => {
            type: "MainContextTexts";
            data: {
                agents: readonly {
                    agent: string;
                    texts: readonly {
                        id: string;
                        kind: string;
                        text: string;
                        globs?: readonly string[] | undefined;
                    }[];
                }[];
            };
        };
    };
    EvalCases: z.ZodObject<{
        type: z.ZodLiteral<"EvalCases">;
        data: z.ZodObject<{
            cases: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                suiteName: z.ZodString;
                prompt: z.ZodString;
                expect: z.ZodObject<{
                    invoke: z.ZodOptional<z.ZodString>;
                    follow: z.ZodOptional<z.ZodString>;
                    read: z.ZodOptional<z.ZodString>;
                    maxTokens: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strip>;
                guideBody: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            cases: readonly {
                suiteName: string;
                prompt: string;
                expect: {
                    invoke?: string | undefined;
                    follow?: string | undefined;
                    read?: string | undefined;
                    maxTokens?: number | undefined;
                };
                guideBody?: string | undefined;
            }[];
        }) => {
            type: "EvalCases";
            data: {
                cases: readonly {
                    suiteName: string;
                    prompt: string;
                    expect: {
                        invoke?: string | undefined;
                        follow?: string | undefined;
                        read?: string | undefined;
                        maxTokens?: number | undefined;
                    };
                    guideBody?: string | undefined;
                }[];
            };
        };
    };
    CharterLayout: z.ZodObject<{
        type: z.ZodLiteral<"CharterLayout">;
        data: z.ZodObject<{
            charterUri: z.ZodString;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            charterUri: string;
        }) => {
            type: "CharterLayout";
            data: {
                charterUri: string;
            };
        };
    };
    DoctorOutcome: z.ZodObject<{
        type: z.ZodLiteral<"DoctorOutcome">;
        data: z.ZodObject<{
            agents: z.ZodReadonly<z.ZodArray<z.ZodString>>;
            errorCount: z.ZodNumber;
            warnCount: z.ZodNumber;
            pendingCount: z.ZodNullable<z.ZodNumber>;
            faultsByFile: z.ZodObject<{
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
            problemCount: z.ZodNumber;
            mainContexts: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                agent: z.ZodString;
                totalTokens: z.ZodNumber;
            }, z.core.$strip>>>;
            mainContextCeiling: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            agents: readonly string[];
            errorCount: number;
            warnCount: number;
            pendingCount: number | null;
            faultsByFile: {
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
            problemCount: number;
            mainContexts: readonly {
                agent: string;
                totalTokens: number;
            }[];
            mainContextCeiling: number;
        }) => {
            type: "DoctorOutcome";
            data: {
                agents: readonly string[];
                errorCount: number;
                warnCount: number;
                pendingCount: number | null;
                faultsByFile: {
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
                problemCount: number;
                mainContexts: readonly {
                    agent: string;
                    totalTokens: number;
                }[];
                mainContextCeiling: number;
            };
        };
    };
    ExplanationOutcome: z.ZodObject<{
        type: z.ZodLiteral<"ExplanationOutcome">;
        data: z.ZodObject<{
            primitive: z.ZodObject<{
                type: z.ZodLiteral<"Primitive">;
                data: z.ZodObject<{
                    id: z.ZodString;
                    kind: z.ZodString;
                    description: z.ZodString;
                    file: z.ZodString;
                    layerName: z.ZodEnum<{
                        repo: "repo";
                        vendor: "vendor";
                        builtin: "builtin";
                    }>;
                    headers: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodReadonly<z.ZodArray<z.ZodString>>]>>;
                    body: z.ZodString;
                    hash: z.ZodString;
                }, z.core.$strip>;
            }, z.core.$strip> & {
                of: (dataValue: {
                    id: string;
                    kind: string;
                    description: string;
                    file: string;
                    layerName: "repo" | "vendor" | "builtin";
                    headers: Record<string, string | readonly string[]>;
                    body: string;
                    hash: string;
                }) => {
                    type: "Primitive";
                    data: {
                        id: string;
                        kind: string;
                        description: string;
                        file: string;
                        layerName: "repo" | "vendor" | "builtin";
                        headers: Record<string, string | readonly string[]>;
                        body: string;
                        hash: string;
                    };
                };
            };
            activatesWhen: z.ZodString;
            useMixins: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                type: z.ZodLiteral<"Primitive">;
                data: z.ZodObject<{
                    id: z.ZodString;
                    kind: z.ZodString;
                    description: z.ZodString;
                    file: z.ZodString;
                    layerName: z.ZodEnum<{
                        repo: "repo";
                        vendor: "vendor";
                        builtin: "builtin";
                    }>;
                    headers: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodReadonly<z.ZodArray<z.ZodString>>]>>;
                    body: z.ZodString;
                    hash: z.ZodString;
                }, z.core.$strip>;
            }, z.core.$strip> & {
                of: (dataValue: {
                    id: string;
                    kind: string;
                    description: string;
                    file: string;
                    layerName: "repo" | "vendor" | "builtin";
                    headers: Record<string, string | readonly string[]>;
                    body: string;
                    hash: string;
                }) => {
                    type: "Primitive";
                    data: {
                        id: string;
                        kind: string;
                        description: string;
                        file: string;
                        layerName: "repo" | "vendor" | "builtin";
                        headers: Record<string, string | readonly string[]>;
                        body: string;
                        hash: string;
                    };
                };
            }>>;
            rationale: z.ZodOptional<z.ZodObject<{
                type: z.ZodLiteral<"Primitive">;
                data: z.ZodObject<{
                    id: z.ZodString;
                    kind: z.ZodString;
                    description: z.ZodString;
                    file: z.ZodString;
                    layerName: z.ZodEnum<{
                        repo: "repo";
                        vendor: "vendor";
                        builtin: "builtin";
                    }>;
                    headers: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodReadonly<z.ZodArray<z.ZodString>>]>>;
                    body: z.ZodString;
                    hash: z.ZodString;
                }, z.core.$strip>;
            }, z.core.$strip> & {
                of: (dataValue: {
                    id: string;
                    kind: string;
                    description: string;
                    file: string;
                    layerName: "repo" | "vendor" | "builtin";
                    headers: Record<string, string | readonly string[]>;
                    body: string;
                    hash: string;
                }) => {
                    type: "Primitive";
                    data: {
                        id: string;
                        kind: string;
                        description: string;
                        file: string;
                        layerName: "repo" | "vendor" | "builtin";
                        headers: Record<string, string | readonly string[]>;
                        body: string;
                        hash: string;
                    };
                };
            }>;
            hosts: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                type: z.ZodLiteral<"Primitive">;
                data: z.ZodObject<{
                    id: z.ZodString;
                    kind: z.ZodString;
                    description: z.ZodString;
                    file: z.ZodString;
                    layerName: z.ZodEnum<{
                        repo: "repo";
                        vendor: "vendor";
                        builtin: "builtin";
                    }>;
                    headers: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodReadonly<z.ZodArray<z.ZodString>>]>>;
                    body: z.ZodString;
                    hash: z.ZodString;
                }, z.core.$strip>;
            }, z.core.$strip> & {
                of: (dataValue: {
                    id: string;
                    kind: string;
                    description: string;
                    file: string;
                    layerName: "repo" | "vendor" | "builtin";
                    headers: Record<string, string | readonly string[]>;
                    body: string;
                    hash: string;
                }) => {
                    type: "Primitive";
                    data: {
                        id: string;
                        kind: string;
                        description: string;
                        file: string;
                        layerName: "repo" | "vendor" | "builtin";
                        headers: Record<string, string | readonly string[]>;
                        body: string;
                        hash: string;
                    };
                };
            }>>;
            citers: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                type: z.ZodLiteral<"Primitive">;
                data: z.ZodObject<{
                    id: z.ZodString;
                    kind: z.ZodString;
                    description: z.ZodString;
                    file: z.ZodString;
                    layerName: z.ZodEnum<{
                        repo: "repo";
                        vendor: "vendor";
                        builtin: "builtin";
                    }>;
                    headers: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodReadonly<z.ZodArray<z.ZodString>>]>>;
                    body: z.ZodString;
                    hash: z.ZodString;
                }, z.core.$strip>;
            }, z.core.$strip> & {
                of: (dataValue: {
                    id: string;
                    kind: string;
                    description: string;
                    file: string;
                    layerName: "repo" | "vendor" | "builtin";
                    headers: Record<string, string | readonly string[]>;
                    body: string;
                    hash: string;
                }) => {
                    type: "Primitive";
                    data: {
                        id: string;
                        kind: string;
                        description: string;
                        file: string;
                        layerName: "repo" | "vendor" | "builtin";
                        headers: Record<string, string | readonly string[]>;
                        body: string;
                        hash: string;
                    };
                };
            }>>;
            mentioners: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                type: z.ZodLiteral<"Primitive">;
                data: z.ZodObject<{
                    id: z.ZodString;
                    kind: z.ZodString;
                    description: z.ZodString;
                    file: z.ZodString;
                    layerName: z.ZodEnum<{
                        repo: "repo";
                        vendor: "vendor";
                        builtin: "builtin";
                    }>;
                    headers: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodReadonly<z.ZodArray<z.ZodString>>]>>;
                    body: z.ZodString;
                    hash: z.ZodString;
                }, z.core.$strip>;
            }, z.core.$strip> & {
                of: (dataValue: {
                    id: string;
                    kind: string;
                    description: string;
                    file: string;
                    layerName: "repo" | "vendor" | "builtin";
                    headers: Record<string, string | readonly string[]>;
                    body: string;
                    hash: string;
                }) => {
                    type: "Primitive";
                    data: {
                        id: string;
                        kind: string;
                        description: string;
                        file: string;
                        layerName: "repo" | "vendor" | "builtin";
                        headers: Record<string, string | readonly string[]>;
                        body: string;
                        hash: string;
                    };
                };
            }>>;
            testCasesByFile: z.ZodObject<{
                type: z.ZodLiteral<"TestCasesByFile">;
                data: z.ZodRecord<z.ZodString, z.ZodReadonly<z.ZodArray<z.ZodString>>>;
            }, z.core.$strip> & {
                of: (dataValue: Record<string, readonly string[]>) => {
                    type: "TestCasesByFile";
                    data: Record<string, readonly string[]>;
                };
            };
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            primitive: {
                type: "Primitive";
                data: {
                    id: string;
                    kind: string;
                    description: string;
                    file: string;
                    layerName: "repo" | "vendor" | "builtin";
                    headers: Record<string, string | readonly string[]>;
                    body: string;
                    hash: string;
                };
            };
            activatesWhen: string;
            useMixins: readonly {
                type: "Primitive";
                data: {
                    id: string;
                    kind: string;
                    description: string;
                    file: string;
                    layerName: "repo" | "vendor" | "builtin";
                    headers: Record<string, string | readonly string[]>;
                    body: string;
                    hash: string;
                };
            }[];
            hosts: readonly {
                type: "Primitive";
                data: {
                    id: string;
                    kind: string;
                    description: string;
                    file: string;
                    layerName: "repo" | "vendor" | "builtin";
                    headers: Record<string, string | readonly string[]>;
                    body: string;
                    hash: string;
                };
            }[];
            citers: readonly {
                type: "Primitive";
                data: {
                    id: string;
                    kind: string;
                    description: string;
                    file: string;
                    layerName: "repo" | "vendor" | "builtin";
                    headers: Record<string, string | readonly string[]>;
                    body: string;
                    hash: string;
                };
            }[];
            mentioners: readonly {
                type: "Primitive";
                data: {
                    id: string;
                    kind: string;
                    description: string;
                    file: string;
                    layerName: "repo" | "vendor" | "builtin";
                    headers: Record<string, string | readonly string[]>;
                    body: string;
                    hash: string;
                };
            }[];
            testCasesByFile: {
                type: "TestCasesByFile";
                data: Record<string, readonly string[]>;
            };
            rationale?: {
                type: "Primitive";
                data: {
                    id: string;
                    kind: string;
                    description: string;
                    file: string;
                    layerName: "repo" | "vendor" | "builtin";
                    headers: Record<string, string | readonly string[]>;
                    body: string;
                    hash: string;
                };
            } | undefined;
        }) => {
            type: "ExplanationOutcome";
            data: {
                primitive: {
                    type: "Primitive";
                    data: {
                        id: string;
                        kind: string;
                        description: string;
                        file: string;
                        layerName: "repo" | "vendor" | "builtin";
                        headers: Record<string, string | readonly string[]>;
                        body: string;
                        hash: string;
                    };
                };
                activatesWhen: string;
                useMixins: readonly {
                    type: "Primitive";
                    data: {
                        id: string;
                        kind: string;
                        description: string;
                        file: string;
                        layerName: "repo" | "vendor" | "builtin";
                        headers: Record<string, string | readonly string[]>;
                        body: string;
                        hash: string;
                    };
                }[];
                hosts: readonly {
                    type: "Primitive";
                    data: {
                        id: string;
                        kind: string;
                        description: string;
                        file: string;
                        layerName: "repo" | "vendor" | "builtin";
                        headers: Record<string, string | readonly string[]>;
                        body: string;
                        hash: string;
                    };
                }[];
                citers: readonly {
                    type: "Primitive";
                    data: {
                        id: string;
                        kind: string;
                        description: string;
                        file: string;
                        layerName: "repo" | "vendor" | "builtin";
                        headers: Record<string, string | readonly string[]>;
                        body: string;
                        hash: string;
                    };
                }[];
                mentioners: readonly {
                    type: "Primitive";
                    data: {
                        id: string;
                        kind: string;
                        description: string;
                        file: string;
                        layerName: "repo" | "vendor" | "builtin";
                        headers: Record<string, string | readonly string[]>;
                        body: string;
                        hash: string;
                    };
                }[];
                testCasesByFile: {
                    type: "TestCasesByFile";
                    data: Record<string, readonly string[]>;
                };
                rationale?: {
                    type: "Primitive";
                    data: {
                        id: string;
                        kind: string;
                        description: string;
                        file: string;
                        layerName: "repo" | "vendor" | "builtin";
                        headers: Record<string, string | readonly string[]>;
                        body: string;
                        hash: string;
                    };
                } | undefined;
            };
        };
    };
    VendorAddOutcome: z.ZodObject<{
        type: z.ZodLiteral<"VendorAddOutcome">;
        data: z.ZodReadonly<z.ZodArray<z.ZodObject<{
            folder: z.ZodString;
            primitives: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                type: z.ZodLiteral<"VendorPrimitive">;
                data: z.ZodObject<{
                    kind: z.ZodString;
                    id: z.ZodString;
                    description: z.ZodString;
                    leftOutHeaders: z.ZodReadonly<z.ZodArray<z.ZodString>>;
                }, z.core.$strip>;
            }, z.core.$strip> & {
                of: (dataValue: {
                    kind: string;
                    id: string;
                    description: string;
                    leftOutHeaders: readonly string[];
                }) => {
                    type: "VendorPrimitive";
                    data: {
                        kind: string;
                        id: string;
                        description: string;
                        leftOutHeaders: readonly string[];
                    };
                };
            }>>;
        }, z.core.$strip>>>;
    }, z.core.$strip> & {
        of: (dataValue: readonly {
            folder: string;
            primitives: readonly {
                type: "VendorPrimitive";
                data: {
                    kind: string;
                    id: string;
                    description: string;
                    leftOutHeaders: readonly string[];
                };
            }[];
        }[]) => {
            type: "VendorAddOutcome";
            data: readonly {
                folder: string;
                primitives: readonly {
                    type: "VendorPrimitive";
                    data: {
                        kind: string;
                        id: string;
                        description: string;
                        leftOutHeaders: readonly string[];
                    };
                }[];
            }[];
        };
    };
};
/** Every DTO's type, under its name: what its schema infers. */
declare namespace CharterDTOs {
    type AccessToken = z.infer<typeof CharterDTOs.AccessToken>;
    type Catalogue = z.infer<typeof CharterDTOs.Catalogue>;
    type CatalogueEntry = z.infer<typeof CharterDTOs.CatalogueEntry>;
    type CharterLayout = z.infer<typeof CharterDTOs.CharterLayout>;
    type DeclaredTool = z.infer<typeof CharterDTOs.DeclaredTool>;
    type DeclaredTools = z.infer<typeof CharterDTOs.DeclaredTools>;
    type DoctorOutcome = z.infer<typeof CharterDTOs.DoctorOutcome>;
    type EvalCase = z.infer<typeof CharterDTOs.EvalCase>;
    type EvalCases = z.infer<typeof CharterDTOs.EvalCases>;
    type EvalSuite = z.infer<typeof CharterDTOs.EvalSuite>;
    type EvalSuiteName = z.infer<typeof CharterDTOs.EvalSuiteName>;
    type EvalSuites = z.infer<typeof CharterDTOs.EvalSuites>;
    type ExplanationOutcome = z.infer<typeof CharterDTOs.ExplanationOutcome>;
    type MainContext = z.infer<typeof CharterDTOs.MainContext>;
    type MainContextLoad = z.infer<typeof CharterDTOs.MainContextLoad>;
    type MainContextTexts = z.infer<typeof CharterDTOs.MainContextTexts>;
    type MainContexts = z.infer<typeof CharterDTOs.MainContexts>;
    type PlanSummary = z.infer<typeof CharterDTOs.PlanSummary>;
    type Primitive = z.infer<typeof CharterDTOs.Primitive>;
    type PrimitiveHeader = z.infer<typeof CharterDTOs.PrimitiveHeader>;
    type PrimitiveKinds = z.infer<typeof CharterDTOs.PrimitiveKinds>;
    type PrimitiveRequirements = z.infer<typeof CharterDTOs.PrimitiveRequirements>;
    type Primitives = z.infer<typeof CharterDTOs.Primitives>;
    type SensorCommands = z.infer<typeof CharterDTOs.SensorCommands>;
    type ServedTool = z.infer<typeof CharterDTOs.ServedTool>;
    type ServedTools = z.infer<typeof CharterDTOs.ServedTools>;
    type SignInStatus = z.infer<typeof CharterDTOs.SignInStatus>;
    type SignInStatuses = z.infer<typeof CharterDTOs.SignInStatuses>;
    type TestCase = z.infer<typeof CharterDTOs.TestCase>;
    type TestCaseReport = z.infer<typeof CharterDTOs.TestCaseReport>;
    type TestCasesByFile = z.infer<typeof CharterDTOs.TestCasesByFile>;
    type TestRunReport = z.infer<typeof CharterDTOs.TestRunReport>;
    type TestSuite = z.infer<typeof CharterDTOs.TestSuite>;
    type TestSuiteName = z.infer<typeof CharterDTOs.TestSuiteName>;
    type TestSuites = z.infer<typeof CharterDTOs.TestSuites>;
    type VendorAddOutcome = z.infer<typeof CharterDTOs.VendorAddOutcome>;
    type VendorFolder = z.infer<typeof CharterDTOs.VendorFolder>;
    type VendorFolders = z.infer<typeof CharterDTOs.VendorFolders>;
    type VendorPrimitive = z.infer<typeof CharterDTOs.VendorPrimitive>;
}

/** The names a layer goes by: what this repository authored itself; what it
 *  installed from someone else, under the name it installed it as (FR-023);
 *  and what the running engine brings itself, supplied on every read and kept
 *  nowhere in the repository, so nothing can refresh, edit or remove it
 *  (FR-015, FR-016). */
declare const LAYER_NAMES: readonly ["repo", "vendor", "builtin"];
/** Whose layer a primitive came from, and there are only the three. It says
 *  where a primitive was written, never what it is called: one charter has one
 *  id space, whichever layer a file arrived in (FR-014, FR-019). */
type LayerName = (typeof LAYER_NAMES)[number];
/** The layer a primitive was read in: whose it is, and for a vendor's, the
 *  name this repository installed it as (FR-023). Where it is kept is what
 *  keeps it to know, never the layer's (CORE-FR-213). */
declare class PrimitiveLayer<Name extends LayerName = LayerName> {
    readonly name: Name;
    /** The name a vendor's layer was installed as: `team/charter`. */
    readonly vendorName?: string | undefined;
    /** This repository's own layer: where a primitive is written when it is
     *  authored here (FR-039). */
    static readonly REPO: PrimitiveLayer<"repo">;
    /** The engine's own layer: kept nowhere, so there is nothing to open (FR-015,
     *  FR-018). */
    static readonly BUILTIN: PrimitiveLayer<"builtin">;
    private constructor();
    /** The name every vendor's layer goes by. */
    static get vendorName(): "vendor";
    /** The layer of the vendor this repository installed under this name. */
    static ofVendor(vendorName: string): PrimitiveLayer<"vendor">;
}

/** What one primitive's author answered, under the header each answer fills
 *  in: a line, or the entries of a list — not yet read by the kind's schema,
 *  which is what refuses what the kind will not take. */
type UnparsedHeaders = Readonly<Record<string, string | readonly string[]>>;
/** One mcp origin a token is asked for: the address its credential is kept
 *  under, its endpoint where it has one, and the id of an mcp at it, which
 *  `cw mcp auth` signs in by. */
interface McpOriginAddress {
    readonly address: string;
    readonly endpoint?: string;
    readonly mcpId: string;
}
/**
 * DRIVER PORT — charter authoring: its primitives, the vendors it
 * installs, the test and eval cases written beside it, testing it, and the mcp
 * origins it reaches, signed in to (CORE-FR-222). Runtime asks it, through
 * this port alone, for a token to an mcp origin (CORE-FR-229).
 *
 * What is authored is what a repository keeps, so nothing here reads what the
 * repository configured itself with, and nothing needs it to be under version
 * control: a vendor's source is fetched, and nothing of the repository's own
 * history is asked. Its settings are the build's.
 *
 * Every answer is a DTO, told apart from the others it may be by its `type`: a
 * driver reads what the engine said and never holds a model of the engine's.
 * Whatever stops an operation is among them, a `FaultDTOs.Fault`, and never
 * thrown: an internal one is logged and said in the system's own words
 * (SDK-FR-004, SDK-FR-017, SDK-FR-018).
 */
interface ForAuthoringCharter {
    /**
     * What this repository's charter holds, listed (FR-011, FR-012).
     *
     * Reads and says: there is no way through this to write anything (FR-041).
     * What comes back is the listing the charter compiles to and not a second
     * one made for this command, so what a user reads and what an agent reads
     * are the same listing said twice (SC-004).
     *
     * Narrowed to one kind where a kind is named, and the whole charter where none
     * is. The word is taken as typed: whether it is a kind at all is asked behind
     * this port, and a word that is none is answered as one fault rather than under a file, since it
     * leaves nothing to narrow by and there is no file it is wrong with.
     *
     * A charter with an error is refused with nothing listed and the errors given
     * back, for the reason a build is: a listing of a charter that does not hold
     * would say a charter holds primitives it has not got (FR-009).
     */
    list(kind?: string): Promise<CharterDTOs.Catalogue | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;
    /**
     * Every primitive of every layer, off the charter as it was read rather than
     * the catalogue it compiles to: each with its file, the layer it arrived in,
     * and every header it declared (FR-112, FR-114). What the portal lists by;
     * `list` stays what an agent surveys by.
     *
     * Given a word, only the primitives that mention it — in the id, the
     * kind, the description, when the kind comes up, the file or any header
     * value, ignoring case.
     *
     * A charter with an error is refused with nothing listed and the errors given
     * back, as `list` refuses it.
     */
    fullList(matching?: string): Promise<CharterDTOs.Primitives | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;
    /**
     * Which file declares one id, and which layer that file arrived in
     * (FR-017, SC-006); the mixins it uses and the corpus it cites, and what
     * uses, cites or names it (FR-014, FR-163).
     *
     * Reads and says, as `list` does: there is no way through this to write
     * anything (FR-041).
     *
     * The id is taken as typed. Text that is not an id, `<kind>:<id>` among it, and an
     * id this charter holds nothing of, are answered as one fault rather than under a file,
     * for the reason an unknown kind is: there is no file it is wrong with, and
     * nothing to explain.
     *
     * A charter with an error explains nothing and hands the errors back, the way
     * a listing does: a charter that does not hold would answer for a primitive it
     * has not got (FR-009). The collision SC-006 asks about is among those errors,
     * naming both files that claim the id, so it is read where every other
     * fault is.
     */
    explain(id: string): Promise<CharterDTOs.ExplanationOutcome | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;
    /**
     * What one kind takes of whoever authors a primitive of it: each header,
     * whether it holds a line or a list, and whether a file written without it is
     * refused (FR-004, FR-039).
     *
     * Every header the kind takes is named, not only the ones it refuses a file
     * without: a header an author may write is one they have to know the shape of,
     * and the shape is read off the same schema the file is refused against.
     *
     * Reads and says, as `list` does: there is no way through this to write
     * anything (FR-041). No charter is read either — what a kind demands is the
     * kind's own contract, and it is the same in a repository that has authored
     * nothing.
     *
     * What it is for is the asking: whoever has an author in front of them has one
     * question per header the kind requires, and does not have to know the kinds
     * to put them. A word
     * that is no kind is answered as one fault rather than under a file, the way a listing's is:
     * there is no file it is wrong with, and what comes back names every kind
     * there is.
     */
    listPrimitiveRequirements(kind: string): Promise<CharterDTOs.PrimitiveRequirements | FaultDTOs.Fault>;
    /**
     * Every kind the charter knows, and when a primitive of that kind comes up
     * (FR-010).
     *
     * Reads and says, and reads no charter either: what a kind is and when it
     * applies is the kind's own contract, so the answer is the same in a
     * repository that has authored nothing. The same declarations the compiled
     * orientation says it in, so a listing and what the agent reads cannot come to
     * say different things.
     *
     * What it is for is listing: whoever shows a charter shows it by kind, and the
     * kinds a charter holds nothing of are kinds all the same.
     */
    kinds(): Promise<CharterDTOs.PrimitiveKinds | FaultDTOs.Fault>;
    /**
     * One primitive written where its kind's primitives are authored (FR-039).
     *
     * Writes exactly one file. What arrives is what the kind was asked for —
     * `listPrimitiveRequirements` said which headers, and these are the
     * answers — so the asking belongs to whoever had an author to ask and the
     * checking belongs here: answers the kind refuses come back as the faults they
     * are and no file is written (FR-004). What it gives back is the primitive as
     * `explain` would say it — its id, the file it went into, this
     * repository's layer — so a caller can say it without going and looking.
     *
     * The body is what its author typed, and empty where none was: at the command
     * line the body is written in an editor afterwards (FR-117).
     *
     * Nothing is compiled: a build is the command that compiles a charter
     * (FR-020, FR-079).
     *
     * A word that is no kind, and an id the charter already holds in any
     * layer, are answered as one fault rather than under a file: neither leaves a file to report a
     * fault under, and the second names the file already holding it.
     */
    add(kind: string, id: string, headers: UnparsedHeaders, body?: string): Promise<CharterDTOs.Primitive | FaultDTOs.Faults | FaultDTOs.Fault>;
    /**
     * One primitive as the charter read it — its headers, its body, the file
     * and the layer — and the hash of it written out, what a save is made over
     * (FR-075, FR-078).
     *
     * Reads and says: there is no way through this to write anything (FR-041).
     * Asked of the files as read rather than of the validation, so a primitive
     * opens whatever else in the charter is wrong. An id the charter holds
     * nothing of is answered as a fault, as `explain` answers it.
     */
    open(id: string): Promise<CharterDTOs.Primitive | FaultDTOs.Fault>;
    /**
     * One repository primitive's headers and body written over, its kind, id and
     * file kept (FR-075).
     *
     * Refused, as a fault, with nothing written for a vendored or builtin primitive, naming
     * where it came from (FR-077), and for a primitive that, read again, no
     * longer has the hash it was opened at, `openedHash`, naming the file
     * (FR-078). Answers the kind will not take come back as the faults `add`
     * gives for them. Nothing is compiled or committed
     * (FR-079).
     */
    rewrite(id: string, headers: UnparsedHeaders, body: string, openedHash: string): Promise<CharterDTOs.Primitive | FaultDTOs.Faults | FaultDTOs.Fault>;
    /**
     * One repository primitive's file taken away, and nothing else (FR-076):
     * what still names it is reported dangling by the next validation. Refused, as a fault, for
     * a vendored or builtin primitive, as a rewrite is (FR-077). What comes back
     * is the primitive that was removed. Nothing is compiled or committed
     * (FR-079).
     */
    remove(id: string): Promise<CharterDTOs.Primitive | FaultDTOs.Fault>;
    /**
     * Install one source under this repository's vendor folder, pinned to this
     * version where one is named (FR-023, FR-027).
     *
     * The source is passed on as it was written: which transport it names and
     * whether the credentials for it are there is version control's business, and
     * what it says when it refuses is what the caller is told (FR-031).
     *
     * Installing one that is already there brings it up to date instead, so a
     * repository has one way of saying what it wants rather than two (FR-030).
     *
     * The folder need not be a repository; a machine without git is refused
     * (CORE-FR-205). What it installs is left unstaged for the user to read and
     * commit, whatever else is in hand (CORE-FR-190).
     *
     * What is taken is read off the source's shape where neither `selectedSkillIds` nor
     * `selectedCharterNames` is given: its one charter, else every charter under its
     * `charters/`, else every skill under its `skills/` (CORE-FR-193).
     * `selectedCharterNames` picks charters from `charters/`, each installed whole in a
     * vendor folder of its own (CORE-FR-195, CORE-FR-196); `selectedSkillIds` takes
     * skills from `skills/`, every one it holds where the shape takes them and
     * none is named, asking nothing (CORE-FR-184, CORE-FR-188).
     *
     * What it answers is each folder it filled, and the primitives installed
     * there, each skill with the headers its `SKILL.md` declared that were left
     * out (CORE-FR-186).
     */
    addVendor(sourceUri: string, version?: string, selectedSkillIds?: readonly string[], selectedCharterNames?: readonly string[]): Promise<CharterDTOs.VendorAddOutcome | FaultDTOs.Fault>;
    /** Copy source primitives into the own charter, unstaged, refusing collisions before writing (CORE-FR-198–200). */
    injectVendor(sourceUri: string, version?: string, selectedSkillIds?: readonly string[], selectedCharterNames?: readonly string[]): Promise<CharterDTOs.VendorAddOutcome | FaultDTOs.Fault>;
    /**
     * Take one installed charter away, named by the folder it was installed as
     * (FR-030), and answer that folder.
     *
     * Named by the folder rather than by the address it came from: the folder is
     * what a reader of this repository sees, and what the charter is read out of.
     *
     * Its folder is left gone in the working tree for the user to commit, whatever
     * else is in hand, in a repository or out of one. A name no vendor folder
     * answers to is refused, changing nothing (CORE-FR-204).
     */
    removeVendor(name: string): Promise<CharterDTOs.VendorFolder | FaultDTOs.Fault>;
    /**
     * Every folder a source was installed as, under this repository's vendor
     * folder, sorted (FR-053, FR-122).
     *
     * The folder is all there is to say: nothing is recorded of where one came
     * from or at which version, since version control keeps no such record
     * either and a record kept beside it is one more thing to drift (FR-046).
     */
    vendors(): Promise<CharterDTOs.VendorFolders | FaultDTOs.Fault>;
    /**
     * Every test file under `.cw/charter/test/`, run or not: its name, its text, and its
     * description and cases — or, for a file that does not read, why (FR-124).
     *
     * Reads and says, and reads no charter: nothing is resolved here, which is
     * what testing the charter does. A file that does not read is listed all the
     * same, since it is the one its author most needs to open.
     */
    suites(): Promise<CharterDTOs.TestSuites | FaultDTOs.Fault>;
    /**
     * A new test file, under a name no other test file has, holding one sample
     * case that reads as a suite (FR-091). What comes back is its name.
     */
    addSuite(): Promise<CharterDTOs.TestSuiteName | FaultDTOs.Fault>;
    /**
     * One existing test file written over with this text (FR-090). Text that does
     * not read as a suite is answered as a fault with the refusal and sample `cw test` gives,
     * and nothing is written; so is a name that is no test file. What comes back
     * is its name.
     */
    writeSuite(name: string, text: string): Promise<CharterDTOs.TestSuiteName | FaultDTOs.Fault>;
    /**
     * One test file taken away, and nothing else (FR-092). A name that is no test
     * file is answered as a fault. What comes back is its name.
     */
    removeSuite(name: string): Promise<CharterDTOs.TestSuiteName | FaultDTOs.Fault>;
    /**
     * Every file of evaluation cases, evaluated or not: its name, its text, and
     * its description and cases — or, for a file that does not read, why
     * (CORE-FR-222). Reads and says, and reads no charter: whether a case names
     * what the charter holds is evaluating's to say.
     */
    evalSuites(): Promise<CharterDTOs.EvalSuites | FaultDTOs.Fault>;
    /**
     * A new file of evaluation cases, under a name no other has, holding one
     * sample case that reads as a suite. What comes back is its name.
     */
    addEvalSuite(): Promise<CharterDTOs.EvalSuiteName | FaultDTOs.Fault>;
    /**
     * One existing file of evaluation cases written over with this text. Text
     * that does not read as a suite is answered as a fault, with a sample, and
     * nothing is written; so is a name that is no such file. What comes back is
     * its name.
     */
    writeEvalSuite(name: string, text: string): Promise<CharterDTOs.EvalSuiteName | FaultDTOs.Fault>;
    /**
     * One file of evaluation cases taken away, and nothing else. A name that is
     * no such file is answered as a fault. What comes back is its name.
     */
    removeEvalSuite(name: string): Promise<CharterDTOs.EvalSuiteName | FaultDTOs.Fault>;
    /**
     * Every address an mcp origin of the charter takes a sign-in at, ordered by
     * address, and whether the developer has signed in there (FR-150). Asks
     * nothing and changes nothing: a credential past its expiry is still signed
     * in, since it is renewed when it is used.
     */
    signInStatus(): Promise<CharterDTOs.SignInStatuses | FaultDTOs.Fault>;
    /**
     * Keep this token as the developer's credential at this address, replacing
     * whatever was kept there (FR-148, FR-149). Refused, keeping nothing, for an
     * address no mcp origin is at, one that takes no token, or an empty token.
     * What comes back is the address, signed in.
     */
    signInWithToken(address: string, token: string): Promise<CharterDTOs.SignInStatus | FaultDTOs.Fault>;
    /**
     * Sign in at this address in the developer's browser, and keep what the mcp origin
     * issued (FR-148). `showAuthorizationUrl` is handed the address to open.
     * Refused, keeping nothing, for an address no mcp origin is at or one that takes
     * no OAuth sign-in. What comes back is the address, signed in.
     */
    signInWithOAuth(address: string, showAuthorizationUrl: (authorizationUrl: string) => void): Promise<CharterDTOs.SignInStatus | FaultDTOs.Fault>;
    /**
     * Every situation this repository wrote down, resolved against its charter
     * (FR-048, FR-049, FR-050). Runs nothing, fetches nothing and asks no agent.
     * A charter with an error, or a test file that does not read, resolves
     * nothing and is answered as its faults (FR-009). Reads and says (FR-041).
     */
    test(): Promise<CharterDTOs.TestRunReport | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;
    /**
     * A folder per kind for a charter to be authored in, and the parts kept
     * beside it, laid out where nothing is yet (FR-037, CORE-FR-224). Run again,
     * it discards nothing anybody wrote. What comes back is where the charter
     * is kept.
     */
    setUpCharter(): Promise<CharterDTOs.CharterLayout | FaultDTOs.Fault>;
    /** Where the charter is kept, refused where the repository is laid out the
     *  old way, naming the skill that moves it (CORE-FR-226): what a driver asks
     *  before any command. */
    layout(): Promise<CharterDTOs.CharterLayout | FaultDTOs.Fault>;
    /**
     * The developer's access token to this mcp origin, renewed first where it
     * has expired or `isRefused` says the mcp origin has just refused it (FR-151,
     * SC-035). An mcp origin nobody signed in to, or whose credential cannot be
     * renewed, is answered as a fault naming the command that signs in again; one
     * at plain `http` on another machine is refused before anything is read.
     */
    accessToken(mcpOriginAddress: McpOriginAddress, isRefused: boolean): Promise<CharterDTOs.AccessToken | FaultDTOs.Fault>;
}

/** What an mcp origin's authorization server registered `cw` as, and which
 *  server that was: a registration is presented to the server it came from
 *  and no other. */
declare class McpClientRegistration {
    readonly clientId: string;
    readonly clientSecret?: string;
    readonly issuer: string;
    constructor({ clientId, clientSecret, issuer, }: Pick<McpClientRegistration, "clientId" | "issuer"> & Partial<Pick<McpClientRegistration, "clientSecret">>);
}
/**
 * One developer's sign-in at one address, as the credential store keeps it.
 *
 * No DTO holds it, so no driver can show one (SC-036): it is read, and handed
 * on as the access token a call is made with.
 */
declare class McpCredential {
    readonly address: string;
    readonly method: "oauth" | "token";
    readonly accessToken: string;
    readonly refreshToken?: string;
    readonly expiresAt?: string;
    readonly client?: McpClientRegistration;
    constructor({ address, method, accessToken, refreshToken, expiresAt, client, }: Pick<McpCredential, "address" | "method" | "accessToken"> & Partial<Pick<McpCredential, "refreshToken" | "expiresAt" | "client">>);
}

/**
 * What one OAuth sign-in ends with: the tokens an mcp origin issued, and what it
 * registered `cw` as, so a renewal needs no second registration (plan §19.5).
 *
 * Not a domain type, and no DTO carries one (SC-036): it goes from this port
 * into the credential store and back, and nowhere else.
 */
interface OAuthGrant {
    readonly accessToken: string;
    readonly refreshToken?: string;
    /** ISO 8601. Absent where the mcp origin said nothing of when it expires. */
    readonly expiresAt?: string;
    /** What the mcp origin's authorization server registered `cw` as, and which
     *  server that was: a registration is presented to the server it came from
     *  and no other. */
    readonly client: McpClientRegistration;
}
/**
 * DRIVEN PORT — OAuth against one mcp origin: signing in, and renewing what a
 * sign-in ended with (FR-148, FR-151).
 *
 * Discovery, registration, PKCE and the callback are the adapter's business;
 * the hexagon hands it an endpoint and keeps what comes back.
 */
interface ForAuthorizingMcpOrigins {
    /**
     * Sign in to the server at this endpoint in the developer's browser.
     *
     * `showAuthorizationUrl` is handed the address to open, once: the adapter
     * never opens it (plan §15). Raises an `AdapterFault` where the server cannot
     * be reached, the developer refuses, or nobody comes back in time.
     */
    authorize(endpoint: string, showAuthorizationUrl: (authorizationUrl: string) => void): Promise<OAuthGrant>;
    /**
     * Renew one grant with its refresh token, asking nobody.
     *
     * `undefined` where the server refuses: the developer has to sign in again.
     * A server that cannot be reached raises an `AdapterFault` instead, since
     * nothing says the grant is no good.
     */
    renew(endpoint: string, oauthGrant: OAuthGrant): Promise<OAuthGrant | undefined>;
}

/** One file of evaluation cases as what keeps them keeps it, before the
 *  engine reads it: the name it is reported under, what it holds, and where it
 *  is kept, said back and never read (CORE-FR-213). */
declare class RawEvalSuite {
    readonly name: string;
    readonly text: string;
    readonly uri: string;
    constructor(name: string, text: string, uri: string);
}

/** The name of an agent a charter is compiled for, as a file, a DTO or a
 *  command line writes it: whichever names the projections the engine was
 *  composed with answer to, never a list of its own (CORE-FR-221). */
type AgentProviderName = string;
/** One agent a charter is compiled for, by its name: what it reads of a
 *  charter, and where, is its projection's (FR-018, CORE-FR-221). */
declare class AgentProvider {
    readonly name: AgentProviderName;
    constructor(name: AgentProviderName);
    toString(): AgentProviderName;
}

/** One file of a primitive's folder beside its `index.md`: the path it has in
 *  that folder, and the bytes it holds, never decoded, so it is copied whole
 *  whatever it holds (FR-168, CORE-FR-207). */
interface AssetFile {
    readonly file: string;
    readonly contents: Uint8Array;
}
/**
 * Where a body or a sensor's `run` names another primitive: `[[<id>]]`, of any
 * kind (FR-172). Only a name so written is a reference, so prose is never taken
 * for one. The id is the first group.
 */
declare const REFERENCE: RegExp;
/**
 * Where an agent's `tools` holds an mcp origin: `[[<id>]]` for every tool that mcp
 * declares, `[[<id>]]:<tool>` for one of them (FR-156). The id is the first
 * group, the tool the second where one is named.
 */
declare const TOOL_REFERENCE: RegExp;
/** The delimiter a primitive's headers are written between. One constant for
 *  the writing here and the reading in `PrimitiveFactory.create`, so the two cannot drift. */
declare const DELIMITER = "---";
/** One line of text with something on it: a header written down and left
 *  blank is one nothing can read. */
declare const GoodLineSchema: z.ZodString;
/** A list of names, paths or globs with at least one in it: a kind that
 *  requires a list reads it entry by entry, and an empty one gives it nothing
 *  to read. */
declare const GoodArraySchema: z.ZodReadonly<z.ZodArray<z.ZodString>>;
/** A yes or a no: `true` or `false`, read as YAML reads it off a file, or as
 *  the line an author typed at `cw add` or in the portal. */
declare const FlagSchema: z.ZodPipe<z.ZodUnknown, z.ZodTransform<boolean, unknown>>;
type CommonHeaders = Readonly<z.infer<ReturnType<typeof BasePrimitive.headersSchema>>>;
/**
 * What every kind of primitive is: the headers its file declared, and the body
 * loaded only when it activates (FR-002, FR-013).
 *
 * A kind's own class extends this, declares the headers it requires, and
 * refuses a file that does not hold them — so having one is the promise that
 * the kind's contract holds (FR-004). What a file declared is read once, where
 * it is checked, and held as that kind's headers from then on.
 */
declare abstract class BasePrimitive<Headers extends CommonHeaders = CommonHeaders> {
    #private;
    /** What this primitive's file declared, read as the contract of its kind:
     *  typed by whichever kind this is, so `headers.globs` compiles on a guide
     *  and nowhere else. */
    readonly headers: Headers;
    readonly body: string;
    /** Every file of its folder beside its `index.md`, at any depth (FR-168). */
    readonly assets: readonly AssetFile[];
    static get referencePattern(): typeof REFERENCE;
    static get toolReferencePattern(): typeof TOOL_REFERENCE;
    static get delimiter(): typeof DELIMITER;
    static get goodLineSchema(): typeof GoodLineSchema;
    static get goodArraySchema(): typeof GoodArraySchema;
    static get flagSchema(): typeof FlagSchema;
    static readonly headersOf: typeof headersOf;
    /** The headers every kind declares, whatever else its own contract asks for
     *  (data-model §1). Each kind's own headers extend these, so what every
     *  primitive holds is written once. */
    static headersSchema(): z.ZodObject<{
        id: z.ZodString;
        description: z.ZodString;
        tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        rationale: z.ZodOptional<z.ZodString>;
        mixins: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
    }, z.core.$strip>;
    /** What every kind requires of its author, whatever else its own contract
     *  asks for. A kind's own `requires` stands beside this rather than adding to
     *  it, so whoever asks for a kind's headers asks for both (FR-039). `id` is
     *  not among them: a primitive is named where it is asked for rather than
     *  answered for, so what is left to ask about is what it is for. */
    static readonly requires: RequiredHeaders;
    /** The file a primitive's folder is read from, and compiled to (FR-141):
     *  said here for whoever reads a folder before any primitive is read off it,
     *  and by `index` on every primitive. */
    static readonly index = "index.md";
    /** The schema every kind's headers are read by, its own standing in place of
     *  this. What a file is refused against, and the one place saying what shape
     *  each header holds — including the ones a kind takes without requiring, so
     *  whoever is writing a header reads its shape off the same contract a file
     *  is refused against (FR-004). */
    static readonly schema: z.ZodObject;
    protected constructor(
    /** What this primitive's file declared, read as the contract of its kind:
     *  typed by whichever kind this is, so `headers.globs` compiles on a guide
     *  and nowhere else. */
    headers: Headers, body: string, 
    /** Every file of its folder beside its `index.md`, at any depth (FR-168). */
    assets?: readonly AssetFile[], 
    /** The layer it was read in; a primitive authored here is in this
     *  repository's. */
    primitiveLayer?: PrimitiveLayer, 
    /** Where what keeps it says it is kept, in its own scheme: `file:` for
     *  files, `db:` for a database. Never read here, only said back to whoever
     *  is told where it is (CORE-FR-213). */
    keptUri?: string);
    /** The layer it was read in. */
    readonly layer: PrimitiveLayer;
    /** Whose layer it came from. It says where it was written, never what it is
     *  called (FR-014, FR-019). */
    readonly layerName: LayerName;
    /** Where it is kept, as what keeps it says: none for one not yet kept. The
     *  engine's own is kept nowhere, and is said by the name of its layer
     *  (FR-015). */
    get uri(): string;
    /** Whether a word someone searched for is anywhere a reader would look for
     *  it: the id, the kind, what it is for, when its kind comes up, its
     *  folder and file under its kind, its layer and the vendor it came from,
     *  or any header it declared — ignoring case, since whoever typed it
     *  did not know how it was written (FR-114). */
    search(word: string): boolean;
    /** Whether this primitive is available to a host. No restriction means all. */
    supportsAgent(_agent: AgentProvider): boolean;
    /** Which kind this is. Each class declares it as a literal, and those
     *  literals are where `Kind` comes from. */
    abstract readonly kind: string;
    /** Its folder, from its charter folder: its kind, then each segment of its
     *  id (FR-141). */
    get primitiveFolder(): string;
    /** The file of that folder it is read from (FR-141). */
    get index(): string;
    /** When a reader of this charter is to open a primitive of its kind at all:
     *  the line its kind's class declares, in the words `cw kinds` says it in
     *  (FR-002, FR-029). */
    get activatesWhen(): string;
    /** The hash of it written out, which is what a save writes: what a save is
     *  checked against, so an edit made on disk since it was opened is not
     *  written over (FR-078). */
    get hash(): string;
    /** Its id as every name given to a host writes it, `/` as `-`:
     *  `mfbs-no-any` for `mfbs/no-any`, so a skill is invoked as `/mfbs-no-any`
     *  (FR-141, FR-171). Made here, once, so nothing that names a host's file
     *  spells it again. */
    get normId(): string;
    /**
     * This primitive as the file it is authored in: its headers between the
     * delimiters, and its body under them.
     *
     * The other direction of the reading `PrimitiveFactory.create` does, and the same
     * frontmatter, so a file written here is a file that reads back as this
     * primitive. Said here rather than by whoever writes, for the reason
     * `description` is: what a primitive holds is the primitive's own, and a
     * caller holding one already has everything the file says.
     *
     * The kind leads, since it is what decides how the rest is read (FR-003). A
     * list is written the way the parser gives it back, so an author opening the
     * file finds what they declared rather than a second spelling of it.
     *
     * Written as its author wrote it unless the compiler says otherwise (FR-139):
     * `mixins` lend their bodies, before this one's own so it reads as the point
     * and theirs as the setting, or after it where a mixin's `position` is `end`
     * — nothing is merged and no header moves (FR-006);
     * and `idReplacer` rewrites the body as its reader uses it, each mcp origin,
     * script and template it names as a link to its file (FR-147).
     */
    toMarkdown({ mixins, idReplacer, }?: {
        /** The mixin primitives it pulls in, in the order it named them: all a
         *  mixin lends is its body, and where it goes. */
        readonly mixins?: readonly {
            readonly body: string;
            readonly headers: {
                readonly position: "start" | "end";
            };
        }[];
        readonly idReplacer?: (body: string) => string;
    }): string;
    /**
     * The one line this primitive is found by, composed: what its author wrote it
     * is for, and — where its kind decides when it applies — what it applies to.
     *
     * Said here rather than by whoever compiles, because what makes a kind
     * activate is the kind's own contract (FR-001, FR-004): a skill's triggers are
     * the author's words, which only a skill knows how to say in a line. A kind
     * that nothing activates on its description is the description it was
     * written with.
     */
    description(): string;
}
/**
 * What one kind requires beyond the common headers, and the shape each of them
 * takes: one line of text, or a list of names.
 *
 * Declared by the kind's own class, because what a kind requires is its own
 * contract (FR-004). Written as data, so what a file being scaffolded is to be
 * given is read off it (FR-039).
 */
type RequiredHeaders = Readonly<Record<string, "line" | "list">>;
/**
 * One kind's headers, read off what its file declared by that kind's schema, or
 * one fault saying they are not what the kind holds (FR-004).
 *
 * The fault does not list what is wrong, header by header: it shows the kind's
 * own sample, and an author holding the two side by side sees the difference.
 * Where the schema said what is wrong in its own words — a rule spanning two
 * headers, which no sample shows at a glance — those words are the message.
 */
declare function headersOf<Schema extends z.ZodType>(sampledKind: {
    readonly kind: string;
    readonly sample: Readonly<Record<string, unknown>>;
}, headerSchema: Schema, record: Readonly<Record<string, unknown>>): Readonly<z.infer<Schema>>;

/** A role the agent delegates to, with the tools it may use (FR-004). */
type AgentHeaders = Readonly<z.infer<typeof AgentPrimitive.schema>>;
declare class AgentPrimitive extends BasePrimitive {
    readonly headers: AgentHeaders;
    static readonly kind: "agent";
    readonly kind: "agent";
    /** What this kind requires beyond the common headers, declared where its
     *  contract is: it is read both where a file is checked and where one is
     *  scaffolded (FR-004, FR-039). */
    static readonly requires: {
        readonly tools: "list";
    };
    /** The schema its headers are read by: what `BasePrimitive.headersOf` refuses a file
     *  against, and what says the shape of every header this kind takes, required
     *  or not (FR-004). */
    static readonly schema: z.ZodObject<{
        id: z.ZodString;
        description: z.ZodString;
        tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        rationale: z.ZodOptional<z.ZodString>;
        mixins: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        tools: z.ZodReadonly<z.ZodArray<z.ZodString>>;
        model: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    /** When a reader of this charter is to open this kind at all, said
     *  where the kind's contract is: the neutral surface lists one
     *  line per kind and none of them is written down twice (FR-002). */
    static readonly activatesWhen = "it is spawned by id, holding the `tools` it lists and nothing else \u2014 an mcp origin as `[[<id>]]`, or one of its tools as `[[<id>]]:<tool>`";
    /** An agent as an author writes one: what a refused header is fixed with.
     *  It holds one tool of an mcp origin the way an author writes it (FR-156). */
    static readonly sample: AgentHeaders;
    /** The agent its model is named for; none where it names no model. */
    get modelProvider(): string | undefined;
    /** The model this host runs it on, as this host names it; none where its
     *  model is named for another host, or not at all. */
    modelOf(provider: AgentProvider): string | undefined;
    /** One agent, or every fault its headers have (FR-004). */
    static of(record: Readonly<Record<string, unknown>>, body: string, assets?: readonly AssetFile[], primitiveLayer?: PrimitiveLayer, keptUri?: string): AgentPrimitive;
}

/** Reasoning a primitive cites, loaded only on demand. Beyond the common
 *  headers it asks for nothing (FR-004). */
type CorpusHeaders = Readonly<z.infer<typeof CorpusPrimitive.schema>>;
declare class CorpusPrimitive extends BasePrimitive {
    readonly headers: CorpusHeaders;
    static readonly kind: "corpus";
    readonly kind: "corpus";
    /** What this kind requires beyond the common headers: nothing. Declared all
     *  the same, since what a file is scaffolded with is read off this (FR-039). */
    static readonly requires: {};
    /** The schema its headers are read by: what `BasePrimitive.headersOf` refuses a file
     *  against, and what says the shape of every header this kind takes, required
     *  or not (FR-004). */
    static readonly schema: z.ZodObject<{
        id: z.ZodString;
        description: z.ZodString;
        tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        rationale: z.ZodOptional<z.ZodString>;
        mixins: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
    }, z.core.$strip>;
    /** When a reader of this charter is to open this kind at all, said
     *  where the kind's contract is: the neutral surface lists one
     *  line per kind and none of them is written down twice (FR-002). */
    static readonly activatesWhen = "a primitive's `rationale` cites it \u2014 the reasoning, read when someone asks why";
    /** A corpus as an author writes one: what a refused header is fixed with. */
    static readonly sample: CorpusHeaders;
    /** One corpus, or every fault its headers have (FR-004). */
    static of(record: Readonly<Record<string, unknown>>, body: string, assets?: readonly AssetFile[], primitiveLayer?: PrimitiveLayer, keptUri?: string): CorpusPrimitive;
}

/** A standard the agent is held to. Its body is loaded when a touched file
 *  matches one of its globs, and on every turn where it names none (FR-004). */
type GuideHeaders = Readonly<z.infer<typeof GuidePrimitive.schema>>;
declare class GuidePrimitive extends BasePrimitive {
    readonly headers: GuideHeaders;
    static readonly kind: "guide";
    readonly kind: "guide";
    /** What this kind requires beyond the common headers: nothing. Declared all
     *  the same, since what a file is scaffolded with is read off this (FR-039). */
    static readonly requires: {};
    /** The schema its headers are read by: what `BasePrimitive.headersOf` refuses a file
     *  against, and what says the shape of every header this kind takes, required
     *  or not (FR-004). */
    static readonly schema: z.ZodObject<{
        id: z.ZodString;
        description: z.ZodString;
        tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        rationale: z.ZodOptional<z.ZodString>;
        mixins: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
    }, z.core.$strip>;
    /** When a reader of this charter is to open this kind at all, said
     *  where the kind's contract is: the neutral surface lists one
     *  line per kind and none of them is written down twice (FR-002). */
    static readonly activatesWhen = "a touched file matches one of its `globs`, or every turn where globs are not specified";
    /** A guide as an author writes one: what a refused header is fixed with. */
    static readonly sample: GuideHeaders;
    /** One guide, or every fault its headers have (FR-004). */
    static of(record: Readonly<Record<string, unknown>>, body: string, assets?: readonly AssetFile[], primitiveLayer?: PrimitiveLayer, keptUri?: string): GuidePrimitive;
}

/**
 * Whether a developer's credential may be sent to this endpoint: `https`, or
 * plain `http` only to this machine, for a server under test. Anything else
 * would send it in the clear.
 *
 * Read as a URL rather than matched as text, so the host checked is the host
 * reached: `http://localhost:1@elsewhere/` is `elsewhere`.
 */
declare function isSecureEndpoint(endpoint: string): boolean;
/**
 * One MCP server, an mcp origin where a primitive's reasons are kept outside the
 * repository: reached at an `endpoint`, or started as a `command` (FR-142).
 *
 * One object refined rather than a union of the two shapes, so every header it
 * takes is still read off its `shape` (FR-039); which of the two a file holds,
 * and what that shape asks for beside it, is the refinement's to say.
 */
type McpHeaders = Readonly<z.infer<typeof McpPrimitive.schema>>;
declare class McpPrimitive extends BasePrimitive {
    static readonly isSecureEndpoint: typeof isSecureEndpoint;
    readonly headers: McpHeaders;
    static readonly kind: "mcp";
    readonly kind: "mcp";
    /** What this kind requires beyond the common headers. `endpoint` or
     *  `command` is required too, but which depends on the shape, so the schema's
     *  refinement says it rather than this (FR-004, FR-039). */
    static readonly requires: {
        readonly tools: "list";
    };
    /** The schema its headers are read by: what `BasePrimitive.headersOf` refuses a file
     *  against, and what says the shape of every header this kind takes, required
     *  or not (FR-004). */
    static readonly schema: z.ZodObject<{
        id: z.ZodString;
        description: z.ZodString;
        tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        rationale: z.ZodOptional<z.ZodString>;
        mixins: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        endpoint: z.ZodOptional<z.ZodString>;
        command: z.ZodOptional<z.ZodString>;
        args: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        auth: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodEnum<{
            oauth: "oauth";
            token: "token";
        }>>>>;
        tokenEnv: z.ZodOptional<z.ZodString>;
        path: z.ZodOptional<z.ZodString>;
        tools: z.ZodReadonly<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
    /** When a reader of this charter is to open this kind at all, said
     *  where the kind's contract is: the neutral surface lists one
     *  line per kind and none of them is written down twice (FR-002). */
    static readonly activatesWhen = "a primitive's body names it as `[[<id>]]` \u2014 an mcp origin outside the repository, reached through `cw mcp serve`";
    /** An mcp reached at an endpoint, as an author writes one: what a refused
     *  header is fixed with. */
    static readonly sample: McpHeaders;
    /** The same mcp origin started as a local process: what a refused file declaring
     *  `command` is held up against, since that is the shape it was nearer. */
    static readonly commandSample: McpHeaders;
    /** What a developer signs in to, and what mcp origins are told apart by beside
     *  their `path`: the endpoint, or the command followed by each of its
     *  arguments. The refinement has already held that one of the two is here
     *  (FR-142). */
    get address(): string;
    /** One mcp, or every fault its headers have, shown the sample of the shape
     *  it declared (FR-004, FR-142). */
    static of(record: Readonly<Record<string, unknown>>, body: string, assets?: readonly AssetFile[], primitiveLayer?: PrimitiveLayer, keptUri?: string): McpPrimitive;
}

/** Headers and body reused by other primitives. A leaf: it lends its body to
 *  the host that pulls it in, and pulls in none of its own (FR-006). */
type MixinHeaders = Readonly<z.infer<typeof MixinPrimitive.schema>>;
declare class MixinPrimitive extends BasePrimitive {
    readonly headers: MixinHeaders;
    static readonly kind: "mixin";
    readonly kind: "mixin";
    /** What this kind requires beyond the common headers: nothing. Declared all
     *  the same, since what a file is scaffolded with is read off this (FR-039). */
    static readonly requires: {};
    /** The schema its headers are read by: what `BasePrimitive.headersOf` refuses a file
     *  against, and what says the shape of every header this kind takes, required
     *  or not (FR-004). */
    static readonly schema: z.ZodObject<{
        id: z.ZodString;
        description: z.ZodString;
        tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        rationale: z.ZodOptional<z.ZodString>;
        mixins: z.ZodOptional<z.ZodUndefined>;
        position: z.ZodDefault<z.ZodEnum<{
            start: "start";
            end: "end";
        }>>;
    }, z.core.$strip>;
    /** When a reader of this charter is to open this kind at all, said
     *  where the kind's contract is: the neutral surface lists one
     *  line per kind and none of them is written down twice (FR-002). */
    static readonly activatesWhen = "never on its own: its body is lent to the primitives that pull it in";
    /** A mixin as an author writes one: what a refused header is fixed with. */
    static readonly sample: MixinHeaders;
    /** One mixin, or every fault its headers have (FR-004, FR-006). */
    static of(record: Readonly<Record<string, unknown>>, body: string, assets?: readonly AssetFile[], primitiveLayer?: PrimitiveLayer, keptUri?: string): MixinPrimitive;
}

/** An ordered procedure loaded when a request matches its triggers (FR-004). */
type PlaybookHeaders = Readonly<z.infer<typeof PlaybookPrimitive.schema>>;
declare class PlaybookPrimitive extends BasePrimitive {
    readonly headers: PlaybookHeaders;
    static readonly kind: "playbook";
    readonly kind: "playbook";
    /** What this kind requires beyond the common headers, declared where its
     *  contract is: it is read both where a file is checked and where one is
     *  scaffolded (FR-004, FR-039). */
    static readonly requires: {
        readonly triggers: "list";
    };
    /** The schema its headers are read by: what `BasePrimitive.headersOf` refuses a file
     *  against, and what says the shape of every header this kind takes, required
     *  or not (FR-004). */
    static readonly schema: z.ZodObject<{
        id: z.ZodString;
        description: z.ZodString;
        tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        rationale: z.ZodOptional<z.ZodString>;
        mixins: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        triggers: z.ZodReadonly<z.ZodArray<z.ZodString>>;
        "disable-user-invocation": z.ZodOptional<z.ZodPipe<z.ZodUnknown, z.ZodTransform<boolean, unknown>>>;
        "disable-model-invocation": z.ZodOptional<z.ZodPipe<z.ZodUnknown, z.ZodTransform<boolean, unknown>>>;
    }, z.core.$strip>;
    /** When a reader of this charter is to open this kind at all, said
     *  where the kind's contract is: the neutral surface lists one
     *  line per kind and none of them is written down twice (FR-002). */
    static readonly activatesWhen = "one of its `triggers` matches; the body is a sequence of skills";
    /** A playbook as an author writes one: what a refused header is fixed with. */
    static readonly sample: PlaybookHeaders;
    /** What this is found by: what it is for, and the requests its author said
     *  bring it up. */
    description(): string;
    /** One playbook, or every fault its headers have (FR-004). */
    static of(record: Readonly<Record<string, unknown>>, body: string, assets?: readonly AssetFile[], primitiveLayer?: PrimitiveLayer, keptUri?: string): PlaybookPrimitive;
}

type AgentBasedHeaders = Readonly<z.infer<ReturnType<typeof AgentBasedPrimitive.headersSchema>>>;
/** Shared provider selection for posture and sensor primitives. */
declare abstract class AgentBasedPrimitive<Headers extends AgentBasedHeaders = AgentBasedHeaders> extends BasePrimitive<Headers> {
    static headersSchema(): z.ZodObject<{
        id: z.ZodString;
        description: z.ZodString;
        tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        rationale: z.ZodOptional<z.ZodString>;
        mixins: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        "agent-provider": z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
    }, z.core.$strip>;
    static readonly schema: z.ZodObject<{
        id: z.ZodString;
        description: z.ZodString;
        tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        rationale: z.ZodOptional<z.ZodString>;
        mixins: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        "agent-provider": z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
    }, z.core.$strip>;
    supportsAgent(agent: AgentProvider): boolean;
}

/** What the agent may and may not do, as permission lists (FR-004). */
type PostureHeaders = Readonly<z.infer<typeof PosturePrimitive.schema>>;
declare class PosturePrimitive extends AgentBasedPrimitive {
    readonly headers: PostureHeaders;
    static readonly kind: "posture";
    readonly kind: "posture";
    /** What this kind requires beyond the common headers, declared where its
     *  contract is: it is read both where a file is checked and where one is
     *  scaffolded (FR-004, FR-039). */
    static readonly requires: {
        readonly allow: "list";
        readonly deny: "list";
    };
    /** The schema its headers are read by: what `BasePrimitive.headersOf` refuses a file
     *  against, and what says the shape of every header this kind takes, required
     *  or not (FR-004). */
    static readonly schema: z.ZodObject<{
        id: z.ZodString;
        description: z.ZodString;
        tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        rationale: z.ZodOptional<z.ZodString>;
        mixins: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        "agent-provider": z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        allow: z.ZodReadonly<z.ZodArray<z.ZodString>>;
        deny: z.ZodReadonly<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
    /** When a reader of this charter is to open this kind at all, said
     *  where the kind's contract is: the neutral surface lists one
     *  line per kind and none of them is written down twice (FR-002). */
    static readonly activatesWhen = "always, wherever the host can be told what to `allow` and what to `deny`";
    /** A posture as an author writes one: what a refused header is fixed with. */
    static readonly sample: PostureHeaders;
    /** One posture, or every fault its headers have (FR-004). */
    static of(record: Readonly<Record<string, unknown>>, body: string, assets?: readonly AssetFile[], primitiveLayer?: PrimitiveLayer, keptUri?: string): PosturePrimitive;
}

/** Files the agent or a sensor runs, kept as real files beside the script's
 *  `index.md`: its assets (FR-165). */
type ScriptHeaders = Readonly<z.infer<typeof ScriptPrimitive.schema>>;
declare class ScriptPrimitive extends BasePrimitive {
    readonly headers: ScriptHeaders;
    static readonly kind: "script";
    readonly kind: "script";
    /** What this kind requires beyond the common headers, declared where its
     *  contract is (FR-004, FR-039). */
    static readonly requires: {
        readonly executionPath: "line";
    };
    /** The schema its headers are read by (FR-004). */
    static readonly schema: z.ZodObject<{
        id: z.ZodString;
        description: z.ZodString;
        tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        rationale: z.ZodOptional<z.ZodString>;
        mixins: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        executionPath: z.ZodString;
    }, z.core.$strip>;
    /** When a reader of this charter is to open this kind at all (FR-002): where
     *  its assets are copied is a link to a script's folder, written as the
     *  projection lays it. */
    static readonly activatesWhen: string;
    /** A script as an author writes one: what a refused header is fixed with. */
    static readonly sample: ScriptHeaders;
    /** One script, or every fault its headers have (FR-004). */
    static of(record: Readonly<Record<string, unknown>>, body: string, assets?: readonly AssetFile[], primitiveLayer?: PrimitiveLayer, keptUri?: string): ScriptPrimitive;
    /** The asset that runs, as a path inside its folder: `run.sh` of
     *  `./run.sh`. */
    get executionPathInFolder(): string;
    /** Whether an asset of it is the one its `executionPath` names: the one
     *  run by its path, and no other (FR-160). */
    isExecutionFile(file: string): boolean;
}

/** The events a charter knows how to be raised by, and the only ones a sensor
 *  may name (FR-004).
 *
 *  Closed the way the kinds are: a name outside it is a sensor nothing will
 *  ever fire, and saying so where the file is read is the one place an author
 *  finds out. A host that raises none of them compiles no hook for it, which is
 *  that host's to say and not this list's. */
declare const SIGNALS: readonly ["PreToolUse", "PostToolUse", "UserPromptSubmit", "Stop", "SubagentStop", "PreCompact", "SessionStart", "SessionEnd", "PermissionRequest", "SubagentStart", "PostCompact"];
/** A command the agent's own harness runs when a signal fires (FR-004). */
type SensorHeaders = Readonly<z.infer<typeof SensorPrimitive.schema>>;
declare class SensorPrimitive extends AgentBasedPrimitive {
    static get signals(): typeof SIGNALS;
    readonly headers: SensorHeaders;
    static readonly kind: "sensor";
    readonly kind: "sensor";
    /** What this kind requires beyond the common headers, declared where its
     *  contract is: it is read both where a file is checked and where one is
     *  scaffolded (FR-004, FR-039). */
    static readonly requires: {
        readonly signal: "line";
        readonly run: "line";
    };
    /** The schema its headers are read by: what `BasePrimitive.headersOf` refuses a file
     *  against, and what says the shape of every header this kind takes, required
     *  or not (FR-004). */
    static readonly schema: z.ZodObject<{
        id: z.ZodString;
        description: z.ZodString;
        tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        rationale: z.ZodOptional<z.ZodString>;
        mixins: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        "agent-provider": z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        signal: z.ZodEnum<{
            PreToolUse: "PreToolUse";
            PostToolUse: "PostToolUse";
            UserPromptSubmit: "UserPromptSubmit";
            Stop: "Stop";
            SubagentStop: "SubagentStop";
            PreCompact: "PreCompact";
            SessionStart: "SessionStart";
            SessionEnd: "SessionEnd";
            PermissionRequest: "PermissionRequest";
            SubagentStart: "SubagentStart";
            PostCompact: "PostCompact";
        }>;
        run: z.ZodString;
    }, z.core.$strip>;
    /** When a reader of this charter is to open this kind at all, said
     *  where the kind's contract is: the neutral surface lists one
     *  line per kind and none of them is written down twice (FR-002). */
    static readonly activatesWhen = "the `signal` it names is raised, and the harness runs what it says to `run`";
    /** A sensor as an author writes one: what a refused header is fixed with. */
    static readonly sample: SensorHeaders;
    /** One sensor, or every fault its headers have (FR-004). */
    static of(record: Readonly<Record<string, unknown>>, body: string, assets?: readonly AssetFile[], primitiveLayer?: PrimitiveLayer, keptUri?: string): SensorPrimitive;
}

/** Know-how loaded when a request matches its triggers (FR-004). */
type SkillHeaders = Readonly<z.infer<typeof SkillPrimitive.schema>>;
declare class SkillPrimitive extends BasePrimitive {
    readonly headers: SkillHeaders;
    static readonly kind: "skill";
    readonly kind: "skill";
    /** What this kind requires beyond the common headers, declared where its
     *  contract is: it is read both where a file is checked and where one is
     *  scaffolded (FR-004, FR-039). */
    static readonly requires: {
        readonly triggers: "list";
    };
    /** The schema its headers are read by: what `BasePrimitive.headersOf` refuses a file
     *  against, and what says the shape of every header this kind takes, required
     *  or not (FR-004). */
    static readonly schema: z.ZodObject<{
        id: z.ZodString;
        description: z.ZodString;
        tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        rationale: z.ZodOptional<z.ZodString>;
        mixins: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        triggers: z.ZodReadonly<z.ZodArray<z.ZodString>>;
        "disable-user-invocation": z.ZodOptional<z.ZodPipe<z.ZodUnknown, z.ZodTransform<boolean, unknown>>>;
        "disable-model-invocation": z.ZodOptional<z.ZodPipe<z.ZodUnknown, z.ZodTransform<boolean, unknown>>>;
    }, z.core.$strip>;
    /** When a reader of this charter is to open this kind at all, said
     *  where the kind's contract is: the neutral surface lists one
     *  line per kind and none of them is written down twice (FR-002). */
    static readonly activatesWhen = "one of its `triggers` matches what is being asked";
    /** A skill as an author writes one: what a refused header is fixed with. */
    static readonly sample: SkillHeaders;
    /** What this is found by: what it is for, and the requests its author said
     *  bring it up. */
    description(): string;
    /** One skill, or every fault its headers have (FR-004). */
    static of(record: Readonly<Record<string, unknown>>, body: string, assets?: readonly AssetFile[], primitiveLayer?: PrimitiveLayer, keptUri?: string): SkillPrimitive;
}

/** A file the agent fills or copies, written as its body. Beyond the common
 *  headers it asks for nothing: the agent reads what kind of file it is off
 *  the body itself (FR-158). */
type TemplateHeaders = Readonly<z.infer<typeof TemplatePrimitive.schema>>;
declare class TemplatePrimitive extends BasePrimitive {
    readonly headers: TemplateHeaders;
    static readonly kind: "template";
    readonly kind: "template";
    /** What this kind requires beyond the common headers: nothing. Declared all
     *  the same, since what a file is scaffolded with is read off this (FR-039). */
    static readonly requires: {};
    /** The schema its headers are read by (FR-004). */
    static readonly schema: z.ZodObject<{
        id: z.ZodString;
        description: z.ZodString;
        tags: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        rationale: z.ZodOptional<z.ZodString>;
        mixins: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
    }, z.core.$strip>;
    /** When a reader of this charter is to open this kind at all (FR-002). */
    static readonly activatesWhen = "a primitive names it as `[[<id>]]` \u2014 a file the agent fills or copies, written as its body";
    /** A template as an author writes one: what a refused header is fixed with. */
    static readonly sample: TemplateHeaders;
    /** One template, or every fault its headers have (FR-004). */
    static of(record: Readonly<Record<string, unknown>>, body: string, assets?: readonly AssetFile[], primitiveLayer?: PrimitiveLayer, keptUri?: string): TemplatePrimitive;
}

/** The classes, one per kind. Adding a kind is a file beside them and a line here; what
 *  the kinds are is read back off this list rather than written down twice. */
declare const PRIMITIVE_CLASSES: readonly [typeof GuidePrimitive, typeof SensorPrimitive, typeof SkillPrimitive, typeof PlaybookPrimitive, typeof AgentPrimitive, typeof PosturePrimitive, typeof CorpusPrimitive, typeof MixinPrimitive, typeof McpPrimitive, typeof ScriptPrimitive, typeof TemplatePrimitive];
/**
 * A primitive of any kind, discriminated on `kind`: reading
 * `headers.globs` compiles on a guide and nowhere else.
 *
 * Each kind is a class of its own, holding what it requires of a file and
 * refusing one that does not hold it, so having a `Primitive` is the promise
 * that the kind's contract holds (FR-004). Read off what those classes return
 * rather than listed again: a constructor is protected, so `of` is the only way
 * one comes into being, and what it hands back is what a primitive is.
 */
type Primitive = ReturnType<(typeof PRIMITIVE_CLASSES)[number]["of"]>;
/** The primitive kinds, each read off the class that reads it. The set is
 *  closed: any other value is a fault naming the file and the offending kind
 *  (FR-001). */
declare const KINDS: readonly ("agent" | "corpus" | "guide" | "mcp" | "mixin" | "playbook" | "posture" | "script" | "sensor" | "skill" | "template")[];
type Kind = (typeof KINDS)[number];
/** An id as someone typed it, at a command or in a request, held to the shape
 *  an id is written in: text that is not one names nothing to look for
 *  (FR-172). */
declare function primitiveIdOf(typed: string): string;
declare function isKind(value: unknown): value is Kind;
/** One header a kind's author may answer for: the shape the answer takes,
 *  whether a file written without it is refused, and — where the kind reads it
 *  from a closed set — the values it may hold. What is asked before a file of
 *  this kind can be written, and what is refused where a file was written
 *  without it — one declaration, read twice. */
declare class PrimitiveHeader {
    readonly field: string;
    readonly shape: "line" | "list";
    readonly required: boolean;
    /** Every value the kind reads this header as, where the set is closed — a
     *  sensor's `signal` — so it is chosen rather than typed (FR-118). A header
     *  whose set is open has none. */
    readonly allowedValues?: readonly string[] | undefined;
    constructor(field: string, shape: "line" | "list", required: boolean, 
    /** Every value the kind reads this header as, where the set is closed — a
     *  sensor's `signal` — so it is chosen rather than typed (FR-118). A header
     *  whose set is open has none. */
    allowedValues?: readonly string[] | undefined);
}
/**
 * Every header one kind takes: what every primitive declares, and what this
 * kind's own contract adds on top of it — each with the shape it holds and
 * whether the kind refuses a file without it (FR-004, FR-039).
 *
 * Read off the kind's own class rather than listed again here, so a kind that
 * grows a header is asked for it without anything else being told. The shape
 * comes off the schema a file is refused against, so a header a kind takes
 * without requiring — a guide's globs — is written the shape it is read as, and
 * whoever answers one reads the same contract that refuses it.
 *
 * `kind` and `id` are not among them: the first is what is being asked about
 * and the second is what the primitive is to be called, so both are known
 * before there is anything to ask.
 */
declare function primitiveHeadersOf(kind: Kind): readonly PrimitiveHeader[];
/** One primitive of this kind as its own class declares one, written out the
 *  way a file holds it — the kind first, since it is what decides how the rest
 *  is read. What an author is shown beside the headers they are to answer, and
 *  the same sample a refused file is held up against (FR-001). */
declare function primitiveSampleOf(kind: Kind): string;
/** Every kind of primitive the charter knows, and how a primitive is read, made and named. */
declare class Primitives {
    static get classes(): typeof PRIMITIVE_CLASSES;
    static get kinds(): typeof KINDS;
    static readonly idOf: typeof primitiveIdOf;
    static readonly isKind: typeof isKind;
    static readonly headersOf: typeof primitiveHeadersOf;
    static readonly sampleOf: typeof primitiveSampleOf;
    private constructor();
}

/** One primitive as it is handed in, raw — kept, or answered by an author —
 *  before the engine reads it: its layer, the kind and id it is kept under, its index.md as text or as
 *  the bytes kept, every file kept with it (FR-168), and where it is kept, in
 *  that keeper's own scheme. The engine reads the text and checks it against
 *  the kind and id; it never reads the uri, which it only says back
 *  (CORE-FR-213). */
declare class RawPrimitive {
    readonly layer: PrimitiveLayer;
    readonly kind: string;
    readonly id: string;
    /** Its index.md, as text, or as bytes kept as they are (CORE-FR-207); or
     *  the headers and body an author answered, where no file is written yet
     *  (FR-011). */
    readonly contents: string | Uint8Array | {
        readonly headers: Readonly<Record<string, unknown>>;
        readonly body: string;
    };
    readonly assets: readonly AssetFile[];
    readonly uri: string;
    /** Whether it is kept as a primitive is, apart with its assets: a
     *  markdown file kept on its own is how an earlier version kept one
     *  (FR-141). */
    readonly isKeptApart: boolean;
    /** Where its keeper would keep a primitive of this kind and id, as the
     *  uri of its folder, for a fault to say where to move it (FR-141); the
     *  engine says it back and never reads it. */
    readonly folderUriOf?: ((kind: string, id: string) => string) | undefined;
    constructor(layer: PrimitiveLayer, kind: string, id: string, 
    /** Its index.md, as text, or as bytes kept as they are (CORE-FR-207); or
     *  the headers and body an author answered, where no file is written yet
     *  (FR-011). */
    contents: string | Uint8Array | {
        readonly headers: Readonly<Record<string, unknown>>;
        readonly body: string;
    }, assets: readonly AssetFile[], uri: string, 
    /** Whether it is kept as a primitive is, apart with its assets: a
     *  markdown file kept on its own is how an earlier version kept one
     *  (FR-141). */
    isKeptApart?: boolean, 
    /** Where its keeper would keep a primitive of this kind and id, as the
     *  uri of its folder, for a fault to say where to move it (FR-141); the
     *  engine says it back and never reads it. */
    folderUriOf?: ((kind: string, id: string) => string) | undefined);
    /** Its index.md as text, a leading BOM kept as a file read as text keeps it
     *  (CORE-FR-207). */
    get text(): string;
}

/** What every path into a build's output starts with: where the output
 *  lands is no part of the engine's, so it is written as this, and whoever
 *  lays or reads the output says where that is (CORE-FR-221). */
declare const OUT_FOLDER_TOKEN = "$CW_OUT";
/**
 * One part of what a build compiles to, known by what it is: the part it
 * plays, the kind of the primitive it was compiled from, or `charter` where it
 * is the whole charter's, its id there, and its path inside the build's
 * output (CORE-FR-220).
 *
 * Where the output lands is the projection's to decide (CORE-FR-221). A part's
 * text naming another names it by `linkOf`: its path inside the output, under
 * `$CW_OUT/`.
 */
declare class OutputPart {
    readonly part: string;
    readonly kind: string;
    readonly id: string;
    /** Where it lands inside the build's output: `guide/no-any/index.md`. */
    readonly path: string;
    constructor(part: string, kind: string, id: string, 
    /** Where it lands inside the build's output: `guide/no-any/index.md`. */
    path: string);
    /** What every path into the output starts with, in place of the folder it
     *  lands in. */
    static get outFolderToken(): typeof OUT_FOLDER_TOKEN;
    /** A part of the whole charter: its id is the part it plays. */
    static ofCharter(part: string, path: string): OutputPart;
    /** One primitive's compiled document, every host's. */
    static ofPrimitive(kind: string, id: string): OutputPart;
    /**
     * This part named in another's text: `$CW_OUT/` and its path inside the
     * output, then on by `suffix`, a path from this part's own folder, where one
     * is given: `./` or `../` before it read as a link reads it, every character
     * of it a URL's, a file's name beside it otherwise.
     */
    linkOf(suffix?: string): string;
}

/**
 * One file a build has decided about, before anything on disk moves.
 *
 * Where it goes, what it would hold once the build is done, and what is there
 * now — so what a build would do to it is read off the plan rather than worked
 * out again against disk (FR-022).
 */
declare class WritePlan {
    /** Where it sits, at its path from what is built — the repository, or a
     *  checkout of it: what a build says it did. */
    readonly path: string;
    /** Where it sits, at its path from the repository: where it is written. */
    readonly filePath: string;
    /** What the build would leave in it, or nothing where the plan is to take
     *  it away. */
    readonly contents?: string | Uint8Array | undefined;
    /** What it holds now, or nothing where there is no such file yet: its
     *  bytes where it is a copy, which are what it is compared by
     *  (CORE-FR-207). */
    readonly heldContents?: string | Uint8Array | undefined;
    /** Run by its path once it is down: a built script (FR-160). */
    readonly isExecutable?: boolean | undefined;
    constructor(
    /** Where it sits, at its path from what is built — the repository, or a
     *  checkout of it: what a build says it did. */
    path: string, 
    /** Where it sits, at its path from the repository: where it is written. */
    filePath: string, 
    /** What the build would leave in it, or nothing where the plan is to take
     *  it away. */
    contents?: string | Uint8Array | undefined, 
    /** What it holds now, or nothing where there is no such file yet: its
     *  bytes where it is a copy, which are what it is compared by
     *  (CORE-FR-207). */
    heldContents?: string | Uint8Array | undefined, 
    /** Run by its path once it is down: a built script (FR-160). */
    isExecutable?: boolean | undefined);
}
/** One folder a plan puts down as a source holds it, every file under it at
 *  any depth, replacing whatever that folder held (CORE-FR-042). */
declare class CopyPlan {
    /** Where it sits in the source it is copied from, the empty path its
     *  root. */
    readonly sourcePath: string;
    /** Where it lands, at its path from the repository. */
    readonly destinationPath: string;
    constructor(
    /** Where it sits in the source it is copied from, the empty path its
     *  root. */
    sourcePath: string, 
    /** Where it lands, at its path from the repository. */
    destinationPath: string);
}
/** One reading of a charter, or of a vendor's source, said as what it would
 *  do to disk: a build writes each file, an install copies a folder too. */
declare class ProjectionPlan<Plan extends WritePlan | CopyPlan = WritePlan> {
    readonly warnings: readonly string[];
    /** What the last build left, whether this one writes it again or not; or
     *  what an install takes away once it is down. */
    readonly cleanupPlan: readonly WritePlan[];
    /** Everything this reading would put down, in order. */
    readonly projectionPlan: readonly Plan[];
    constructor(warnings: readonly string[], 
    /** What the last build left, whether this one writes it again or not; or
     *  what an install takes away once it is down. */
    cleanupPlan: readonly WritePlan[], 
    /** Everything this reading would put down, in order. */
    projectionPlan: readonly Plan[]);
}

/** One suite of self-regression tests as what keeps them keeps it, before the
 *  engine reads it: the name it is asked for by (`untitled-1.json`, FR-124),
 *  what it holds, and where it is kept, said back and never read
 *  (CORE-FR-213). */
declare class RawTestSuite {
    readonly name: string;
    readonly text: string;
    readonly uri: string;
    constructor(name: string, text: string, uri: string);
}

/**
 * What a case may say (FR-047).
 *
 * Three shapes, and only three, because only three things about a charter are
 * decided without an agent: a touched file matches a guide's globs, a raised
 * event is the one a sensor names, and a touched file is denied by a posture.
 * Everything else a charter holds — which skill a request wants, which agent
 * gets delegated to — is the agent's reading of words and not this engine's, so
 * it is not something a test here can assert (FR-049).
 *
 * A primitive is named by its id, the way the whole charter names one
 * (FR-172) — checked here against what an author typed rather than against
 * what a primitive declared. Every object is strict, and that is what closes the
 * set: a case holding both a `do` and a `when` is no branch of this union, and
 * neither is one raising an event and expecting a permission — an event touches no file for the charter
 * to allow or refuse. So the shapes nothing could ever answer do not exist to
 * be handled.
 */
declare const TestCaseSchema: z.ZodUnion<readonly [z.ZodObject<{
    do: z.ZodObject<{
        touchFile: z.ZodString;
    }, z.core.$strict>;
    expect: z.ZodUnion<readonly [z.ZodObject<{
        activate: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        allow: z.ZodBoolean;
    }, z.core.$strict>]>;
}, z.core.$strict>, z.ZodObject<{
    when: z.ZodEnum<{
        PreToolUse: "PreToolUse";
        PostToolUse: "PostToolUse";
        UserPromptSubmit: "UserPromptSubmit";
        Stop: "Stop";
        SubagentStop: "SubagentStop";
        PreCompact: "PreCompact";
        SessionStart: "SessionStart";
        SessionEnd: "SessionEnd";
        PermissionRequest: "PermissionRequest";
        SubagentStart: "SubagentStart";
        PostCompact: "PostCompact";
    }>;
    expect: z.ZodObject<{
        run: z.ZodString;
    }, z.core.$strict>;
}, z.core.$strict>]>;
/**
 * One situation a test pins down, and what the charter is expected to make of
 * it (FR-047).
 *
 * A class rather than the record the schema read, because two things are asked
 * of a case wherever one turns up — the situation it puts, which a run reports
 * it under, and the id it names, which an explanation finds it by
 * (FR-014, FR-048) — and neither is worth working out from the three shapes
 * twice. Every case the schema reads is made one, so nothing downstream meets
 * the record on its own.
 *
 * What was written is kept as it was read: which of the three shapes a case is
 * decides how it resolves, and that is the resolver's question to ask of it.
 */
declare class TestCase {
    readonly written: z.infer<typeof TestCaseSchema>;
    static get schema(): typeof TestCaseSchema;
    constructor(written: z.infer<typeof TestCaseSchema>);
    /** The situation it puts, said as a line, and what it expects of it: what a
     *  run reports it under, and what an explanation names it by (FR-048,
     *  FR-014). */
    describe(): string;
    /** The situation it puts: the file it touches, or the event it raises. */
    get situation(): string;
    /** What it expects the charter to make of its situation. */
    get expectation(): string;
    /**
     * Which primitive this case expects to be activated: the sensor a raised event
     * is expected to run, or the guide a touched file is expected to bring up
     * (FR-014).
     *
     * Nothing for the third shape. That one expects a touched file to be allowed
     * or denied, which every posture in the charter answers between them, so it
     * activates no one primitive by name.
     */
    get activatedId(): string | undefined;
}

/**
 * What a test file may hold, as the one shape everything else reads it through
 * (FR-047).
 *
 * Not a primitive, and nothing compiles it. A charter is what an agent is
 * instructed by; this is what says the charter still does what it did, so it
 * lives beside the charter rather than in it and is read only when tests run.
 * That is why it is JSON and not a document with frontmatter: nobody reads it
 * but `cw test`, and there is no body for an agent to open.
 */
declare const TestSuiteSchema: z.ZodObject<{
    description: z.ZodOptional<z.ZodString>;
    cases: z.ZodArray<z.ZodPipe<z.ZodUnion<readonly [z.ZodObject<{
        do: z.ZodObject<{
            touchFile: z.ZodString;
        }, z.core.$strict>;
        expect: z.ZodUnion<readonly [z.ZodObject<{
            activate: z.ZodString;
        }, z.core.$strict>, z.ZodObject<{
            allow: z.ZodBoolean;
        }, z.core.$strict>]>;
    }, z.core.$strict>, z.ZodObject<{
        when: z.ZodEnum<{
            PreToolUse: "PreToolUse";
            PostToolUse: "PostToolUse";
            UserPromptSubmit: "UserPromptSubmit";
            Stop: "Stop";
            SubagentStop: "SubagentStop";
            PreCompact: "PreCompact";
            SessionStart: "SessionStart";
            SessionEnd: "SessionEnd";
            PermissionRequest: "PermissionRequest";
            SubagentStart: "SubagentStart";
            PostCompact: "PostCompact";
        }>;
        expect: z.ZodObject<{
            run: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>]>, z.ZodTransform<TestCase, {
        do: {
            touchFile: string;
        };
        expect: {
            activate: string;
        } | {
            allow: boolean;
        };
    } | {
        when: "PreToolUse" | "PostToolUse" | "UserPromptSubmit" | "Stop" | "SubagentStop" | "PreCompact" | "SessionStart" | "SessionEnd" | "PermissionRequest" | "SubagentStart" | "PostCompact";
        expect: {
            run: string;
        };
    }>>>;
}, z.core.$strict>;
/** One test file, as `TestSuiteSchema` read it (FR-047): what it is about, the
 *  cases it pins down, and the body it was read from, as its author wrote it
 *  and the editor shows it (FR-124). Made by `TestSuiteFactory.create` and by
 *  nothing else. */
declare class TestSuite {
    readonly description: string | undefined;
    readonly cases: readonly TestCase[];
    readonly body: string;
    static get schema(): typeof TestSuiteSchema;
    static get defaultBody(): typeof DEFAULT_TEST_SUITE_BODY;
    /** A suite that reads, said on one line: what a file the schema refused is
     *  shown. */
    static get sampleText(): typeof SAMPLE;
    constructor(description: string | undefined, cases: readonly TestCase[], body: string);
}
declare const SAMPLE: string;
/** What a new test file holds: a description and the first case of the sample,
 *  so it reads as a suite from the start and its author edits rather than
 *  looks the format up (FR-091). */
declare const DEFAULT_TEST_SUITE_BODY: string;

/** A charter this repository installs rather than authors: the source as it
 *  was typed, handed to version control as it is, and the name of the folder
 *  it lands in under the vendor folder, its owner and its repository (FR-049,
 *  FR-050). */
declare class VendorSourceOrigin {
    readonly sourceUri: string;
    readonly name: string;
    constructor(sourceUri: string, name: string);
}

/** The folder a source of many charters keeps them in, one folder each named
 *  by it, laid out as a single-charter source holds its one:
 *  `charters/<name>/.cw/charter/` (CORE-FR-195). */
declare const CHARTERS_FOLDER = "charters";
/** The file a skills repository keeps each skill in, the way `npx skills add`
 *  reads one (CORE-FR-185). */
declare const SKILL_FILE = "SKILL.md";
/** The folder a skills repository keeps the skills it publishes in, the one
 *  `npx skills` looks in first; a `SKILL.md` anywhere else — a copy kept for the
 *  repository's own agent under `.claude/skills/`, say — is none of them
 *  (CORE-FR-185). */
declare const SKILLS_FOLDER = "skills";
/** One charter a source holds: its own, named by nothing, or one of many it
 *  keeps apart, named by its folder (CORE-FR-195); whether a charter is there
 *  at all, whether it installed vendors of its own (FR-170), and its
 *  primitives as the source keeps them. `uri` is where in the source it sits, and `vendorsUri` where its
 *  own vendors would, in the words of what read it: said back and never
 *  read. `sourceFolder` is where its primitives sit in the source, for what
 *  copies them. */
declare class SourceCharter {
    readonly name: string;
    readonly holdsCharter: boolean;
    readonly holdsVendors: boolean;
    readonly rawPrimitives: readonly RawPrimitive[];
    readonly uri: string;
    readonly vendorsUri: string;
    readonly sourceFolder: string;
    constructor(name: string, holdsCharter: boolean, holdsVendors: boolean, rawPrimitives: readonly RawPrimitive[], uri: string, vendorsUri: string, sourceFolder: string);
    /** The description one of its primitives declares, empty where it
     *  declares none. Shown, never refused: the charter is installed whole, as
     *  its source holds it (CORE-FR-196). */
    descriptionOf(rawPrimitive: RawPrimitive): string;
}
/** One skill a skills repository keeps, converted (CORE-FR-185,
 *  CORE-FR-186): the skill it converts to, the headers its `SKILL.md`
 *  declares that the charter has no field for, every other file of its
 *  folder, where it sits in the source, said back and never read, and the
 *  folder it sits in, for what copies it. */
declare class SourceSkill {
    readonly convertedSkill: SkillPrimitive;
    readonly leftOutHeaders: readonly string[];
    readonly assets: readonly AssetFile[];
    readonly uri: string;
    readonly sourceFolder: string;
    constructor(convertedSkill: SkillPrimitive, leftOutHeaders: readonly string[], assets: readonly AssetFile[], uri: string, sourceFolder: string);
}
/** What one commit of a source holds, read: its own charter, the charters it
 *  keeps apart, the skills it publishes, each converted, and why each skill
 *  that does not convert does not (CORE-FR-192, CORE-FR-193). `commit` is
 *  what was fetched, for what fetched it alone to read again. */
declare class VendorSource {
    readonly origin: VendorSourceOrigin;
    readonly commit: string;
    readonly ownCharter: SourceCharter | undefined;
    readonly charters: readonly SourceCharter[];
    readonly skills: readonly SourceSkill[];
    /** Held rather than raised: a skill that does not convert refuses taking
     *  skills, and nothing else (CORE-FR-192). */
    readonly skillFaults: readonly DomainFault[];
    static get chartersFolder(): typeof CHARTERS_FOLDER;
    static get skillFile(): typeof SKILL_FILE;
    static get skillsFolder(): typeof SKILLS_FOLDER;
    constructor(origin: VendorSourceOrigin, commit: string, ownCharter: SourceCharter | undefined, charters: readonly SourceCharter[], skills: readonly SourceSkill[], 
    /** Held rather than raised: a skill that does not convert refuses taking
     *  skills, and nothing else (CORE-FR-192). */
    skillFaults: readonly DomainFault[]);
    /** Whether it publishes any skill, converted or not (CORE-FR-185). */
    get holdsSkills(): boolean;
}

/** One skill a skills repository keeps, as it is handed in, before the engine
 *  converts it (CORE-FR-185): the text of its `SKILL.md`, every other file of
 *  its folder, where it sits in the source, said back and never read, and the
 *  folder it sits in, for what copies it. */
declare class RawSourceSkill {
    readonly text: string;
    readonly assets: readonly AssetFile[];
    readonly uri: string;
    readonly sourceFolder: string;
    constructor(text: string, assets: readonly AssetFile[], uri: string, sourceFolder: string);
}
/** What one commit of a source holds, as what fetched it read it, before the
 *  engine reads its skills: its own charter, the charters it keeps apart, and
 *  the skills it publishes (CORE-FR-193). `commit` is what was fetched, for
 *  what fetched it alone to read again. */
declare class RawVendorSource {
    readonly origin: VendorSourceOrigin;
    readonly commit: string;
    readonly ownCharter: SourceCharter | undefined;
    readonly charters: readonly SourceCharter[];
    readonly rawSourceSkills: readonly RawSourceSkill[];
    constructor(origin: VendorSourceOrigin, commit: string, ownCharter: SourceCharter | undefined, charters: readonly SourceCharter[], rawSourceSkills: readonly RawSourceSkill[]);
}

/** The folder a vendor keeps its primitives in, one folder per kind under it,
 *  as the charter keeps its own. */
declare const PRIMITIVES_FOLDER = "primitive";
/** What this repository installed from others: every vendor, by the name it
 *  was installed as, `<owner>/<repository>/<name>` (FR-050, CORE-FR-196), and
 *  where it is kept, said back and never read. */
declare class VendorRoot {
    /** Every vendor installed, as `cw vendor list` names them (FR-053). */
    readonly vendors: readonly {
        readonly name: string;
        readonly uri: string;
    }[];
    static get primitivesFolder(): typeof PRIMITIVES_FOLDER;
    constructor(
    /** Every vendor installed, as `cw vendor list` names them (FR-053). */
    vendors: readonly {
        readonly name: string;
        readonly uri: string;
    }[]);
}

/** One folder under a repository, named by its path from it, and by nothing
 *  of where the repository is (CORE-FR-217). */
declare abstract class RepoFolder {
    readonly path: string;
    protected constructor(path: string);
}

/** The charter itself, the only part of the workspace a person authors: its
 *  primitives, its tests, its eval cases and its vendors, each in a folder of
 *  its own under it (CORE-FR-224). */
declare class CharterFolder extends RepoFolder {
    static readonly path: string;
}

/** The cases this repository evaluates its charter by against the real agent,
 *  one file of cases each (EVAL-FR-020), under the charter (CORE-FR-224).
 *  Beside the tests rather than inside them: a test is resolved offline, and
 *  an evaluation spends a key. */
declare class EvalFolder extends RepoFolder {
    static readonly path: string;
}

/** The repository's own primitives, a folder per kind, under the charter
 *  (CORE-FR-224). */
declare class PrimitivesFolder extends RepoFolder {
    static readonly path: string;
}

/** The situations this repository pins its charter down with, one file of cases
 *  each (FR-047), under the charter (CORE-FR-224). Apart from the primitives: a
 *  test is not a primitive, nothing compiles it and no agent is instructed by
 *  it, so it is read only when tests run. */
declare class TestFolder extends RepoFolder {
    static readonly path: string;
}

/** What this repository installed from someone else, one folder per vendor,
 *  `<owner>/<repository>` (FR-023, FR-024, FR-050), under the charter
 *  (CORE-FR-224). Apart from the primitives: what a vendor published is
 *  read-only, and what this repository authored is not. */
declare class VendorsFolder extends RepoFolder {
    static readonly path: string;
}

/** Makes what this repository installed from others out of the files kept
 *  under its vendor folder. */
declare class VendorRootFactory {
    /**
     * Each vendor at `<owner>/<repository>/<name>/primitive/` under the vendor
     * folder, named by those three folders (FR-050, CORE-FR-196).
     *
     * A file kept anywhere else is a vendor installed the way an earlier
     * version laid one, refused naming the folder to take away before it is
     * installed again: nothing of it is read as a vendor.
     *
     * `uriOf` says where a folder is kept, in its keeper's words: said back,
     * never read.
     */
    static create(vendorFilePaths: readonly string[], uriOf: (folderPath: string) => string): VendorRoot;
    private constructor();
}

/** What an adapter answering this port raises when git refuses, named again
 *  here so it names this port and nothing behind it. */

/**
 * DRIVEN PORT — reaching a source. How it is answered — a git command today, a
 * library or a test's own answer tomorrow — is the adapter's business.
 *
 * The folder a source lands in need not be a repository: nothing here needs a
 * repository, and nothing here writes to one (FR-023, CORE-FR-205).
 */
interface ForFetchingCharterSources {
    /**
     * Fetch this source, at this version where one is named, and answer the
     * commit fetched: what the other questions about a source are asked of, so it
     * is fetched once. Its text is the adapter's own, for this port alone to
     * read. Nothing in the repository is touched; it is only what a relative source is
     * read from, and whose own version control settings reach it, where it has
     * any. Whoever fetched it says `forgetCommit` when done.
     *
     * A source that cannot be reached, a version that is not there, and a machine
     * that cannot fetch at all each raise an `AdapterFault` saying so
     * (CORE-FR-190, CORE-FR-205).
     */
    fetchCommit(source: string, version?: string): Promise<string>;
    /** Every file this fetched commit holds, by its path in it, at any depth, in
     *  no promised order. */
    listFilesAt(commit: string): Promise<readonly string[]>;
    /** What one file of this fetched commit holds, as text. */
    readFileAt(commit: string, path: string): Promise<string>;
    /** What one file of this fetched commit holds, as the bytes it holds, never
     *  decoded (CORE-FR-208). */
    readBytesAt(commit: string, path: string): Promise<Uint8Array>;
    /**
     * Put one folder of this fetched commit — every file under it, at any depth —
     * at this folder of this repository, replacing whatever that folder held and
     * nothing beside it. The empty path is the commit's root. Nothing is staged
     * and nothing is committed: what lands is left in the working tree for the
     * user to read, whatever else is in hand (FR-023, FR-042, CORE-FR-187,
     * CORE-FR-190).
     */
    checkoutFolderAt(commit: string, fromFolder: string, intoSubFolder: string): Promise<void>;
    /** Let go of what was kept of this fetched commit; nothing is asked of it
     *  afterwards. */
    forgetCommit(commit: string): Promise<void>;
}

/** Keeps a repository's charter, wherever it keeps it, and knows how: its
 *  primitives, the vendors it installed, its test cases and its eval cases,
 *  through this one port (CORE-FR-228), and reads back what the last build
 *  laid of it, each part known by its host, the part it plays, its kind and its
 *  id, never by a path the engine knows (CORE-FR-221). Where a primitive, an asset of one, a
 *  vendor's or a suite sits is its own to know, never the engine's, which knows
 *  a primitive by its layer, kind and id and a suite by its name
 *  (CORE-FR-213). */
interface ForManagingCharter {
    /** Every primitive kept of the repository's charter, its own layer and each
     *  vendor's, each with its assets. Under `checkoutPath`, a checkout of the
     *  repository such as a worktree, where one is named. */
    loadCharter(checkoutPath?: string): Promise<readonly RawPrimitive[]>;
    /** A place laid out for each kind of primitive, where none was: what a
     *  repository is set up with (FR-057). */
    createCharter(): Promise<void>;
    /** One new primitive of the repository's own layer kept, with its assets
     *  where none stands there already, and a file already in its folder left
     *  as one of them; its uri. Refused, with nothing written, where it is kept
     *  already, would be kept inside another or around it, or would land outside
     *  the charter (FR-167, CORE-FR-044). */
    addPrimitive(rawPrimitive: RawPrimitive): Promise<string>;
    /** New primitives of the repository's own layer kept together, each one's
     *  uri in order; refused, with nothing written, as one added is, and where
     *  any file is already in one's folder (CORE-FR-194). */
    injectPrimitives(rawPrimitives: readonly RawPrimitive[]): Promise<readonly string[]>;
    /** Refused where the repository is laid out in a way this store no longer
     *  keeps, naming what moves it (CORE-FR-226). */
    assertLayout(): Promise<void>;
    /** Where the repository's own layer is kept, said back and never read. */
    findCharterUri(): string;
    /** One primitive of the repository's own layer kept over what it was, its
     *  assets as they are (FR-075). */
    rewritePrimitive(primitive: Primitive): Promise<void>;
    /** One primitive of the repository's own layer taken away, with its assets,
     *  and nothing else (FR-076, FR-167). */
    removePrimitive(primitive: Primitive): Promise<void>;
    /** One commit of this source, at this version where one is named, fetched
     *  and read: its own charter, the charters it keeps apart, and its skills.
     *  Whoever asked says `cleanupVendorSource` once done. A source that cannot be
     *  reached raises an `AdapterFault` saying so (CORE-FR-190). */
    fetchVendorSource(vendorSourceOrigin: VendorSourceOrigin, version?: string): Promise<RawVendorSource>;
    /** Let go of what was kept of a source fetched. */
    cleanupVendorSource(rawVendorSource: RawVendorSource): Promise<void>;
    /** Every vendor installed (FR-053). */
    loadVendorRoot(): Promise<VendorRoot>;
    /** One vendor of a source fetched put down by its plan, in order: each
     *  folder copied from the source as it holds it, each file written or taken
     *  away; what else the vendor folder holds is left as it was (CORE-FR-042,
     *  CORE-FR-186 to CORE-FR-189, CORE-FR-196). */
    storeVendor(vendorSource: VendorSource, projectionPlan: ProjectionPlan<WritePlan | CopyPlan>): Promise<void>;
    /** Where a vendor installed under this name is kept, in this keeper's
     *  words: said back, never read. */
    findVendorUri(vendorName: string): string;
    /** The vendor installed under this name taken away, with each folder above
     *  it that leaves empty (FR-047, CORE-FR-204). */
    removeVendor(vendorName: string): Promise<void>;
    /** Every test suite kept, by its name, with what it holds. */
    loadTestSuites(): Promise<readonly RawTestSuite[]>;
    /** One test suite kept under this name, as its author wrote it, over
     *  whatever it held. */
    writeTestSuite(name: string, testSuite: TestSuite): Promise<void>;
    /** The test suite kept under this name taken away. */
    removeTestSuite(name: string): Promise<void>;
    /** Every file of evaluation cases kept, by the name it is reported under,
     *  with what it holds. Under `checkoutPath`, a checkout of the repository
     *  such as a worktree, where one is named. */
    loadEvalSuites(checkoutPath?: string): Promise<readonly RawEvalSuite[]>;
    /** One file of evaluation cases kept under this name, as its author wrote
     *  it, over whatever it held. */
    writeEvalSuite(name: string, evalSuiteText: string): Promise<void>;
    /** The file of evaluation cases kept under this name taken away. */
    removeEvalSuite(name: string): Promise<void>;
    /** The text a build laid for this part, as it was laid; nothing where none
     *  was. Under `checkoutPath`, a checkout of the repository such as a
     *  worktree, where one is named. */
    loadLaidText(outputPart: OutputPart, checkoutPath?: string): Promise<string | undefined>;
    /** Where this part is laid, in the repository's own words: said back where
     *  a message names it, and never read. */
    findPlace(outputPart: OutputPart): string;
    /** Where the build's output lands, in the repository's own words: what
     *  `$CW_OUT` stands for in what the output holds, where a command of it is
     *  run (CORE-FR-221). */
    findOutputFolder(): string;
}

/** Keeps the credentials of the mcp origins, wherever they are kept: what a
 *  credential holds is never shown, and no DTO carries one (SC-036). */
interface ForStoringCredentials {
    /** The credential kept under this address, or `undefined` where none is. One
     *  that does not read as a credential is none: signing in again replaces it. */
    readCredential(address: string): Promise<McpCredential | undefined>;
    /** Keep this credential under its address, replacing what was there. */
    writeCredential(credential: McpCredential): Promise<void>;
}

/**
 * One charter, read: what the engine brings, what this repository authored,
 * what it installed under `vendor/`, and what any of them got wrong.
 *
 * Every question about the charter as a whole is asked of it here — what a
 * primitive is named by, which mixin a name means, what is wrong once the files
 * are read together — so nothing outside joins a vendor's name onto anything by
 * hand.
 */
declare class CharterRoot {
    /** Every primitive this charter holds, whichever layer authored it: what
     *  the engine brings, what this repository wrote and what it installed
     *  under `vendor/`, each under the file it was authored in and the layer
     *  its layer gives it. What a primitive says is its own; where it was
     *  written is what a fault is filed under (SC-003) and what the catalogue
     *  records (FR-011). */
    readonly primitives: readonly Primitive[];
    /** The files that were meant to be primitives and could not be read as one,
     *  and why, wherever they were. Held rather than raised: a charter is worth
     *  having with one file broken, and the broken one is worth naming
     *  (FR-009). */
    readonly faultsByFiles: FaultsByFile;
    /** The layer of everything kept, read as a primitive or not, by where it is
     *  kept: what a fault under it is weighed by (FR-005). */
    readonly layerNameByUri: Readonly<Record<string, LayerName>>;
    constructor(
    /** Every primitive this charter holds, whichever layer authored it: what
     *  the engine brings, what this repository wrote and what it installed
     *  under `vendor/`, each under the file it was authored in and the layer
     *  its layer gives it. What a primitive says is its own; where it was
     *  written is what a fault is filed under (SC-003) and what the catalogue
     *  records (FR-011). */
    primitives: readonly Primitive[], 
    /** The files that were meant to be primitives and could not be read as one,
     *  and why, wherever they were. Held rather than raised: a charter is worth
     *  having with one file broken, and the broken one is worth naming
     *  (FR-009). */
    faultsByFiles: FaultsByFile, 
    /** The layer of everything kept, read as a primitive or not, by where it is
     *  kept: what a fault under it is weighed by (FR-005). */
    layerNameByUri?: Readonly<Record<string, LayerName>>);
    /** Everything wrong with this charter, under the file that has to change: the
     *  files that could not be read as a primitive at all, and what the ones that
     *  were read get wrong together. The two never name one file — a file reading
     *  refused holds no primitive to get anything else wrong — so one asking is
     *  the whole answer (FR-009). */
    get allFaultsByFiles(): FaultsByFile;
    /**
     * Every primitive under the id the whole charter names it by (FR-015,
     * FR-017).
     *
     * One id space covers every layer and every kind, so which file declares a
     * name is a question about the whole charter and not about any one layer.
     * The first claim on an id is the one in here where two files claim it: a
     * collision is what `compositeFaultsByFiles` is for, and it names both files
     * there; nothing is asked to explain a charter that has one (SC-006).
     */
    /** Every primitive naming an agent outside `agentNames`, the agents the
     *  charter can be compiled for, under the file that has to change: in the
     *  agents it is for, or in the model it runs on (FR-033). */
    agentFaultsByFilesOf(agentNames: readonly string[]): FaultsByFile;
    get primitiveById(): ReadonlyMap<string, Primitive>;
    /** Every mixin one primitive uses, in the order it named them (FR-014). A
     *  name nothing answers to, or that answers with another kind, is left out:
     *  `compositeFaultsByFiles` already names that file as an error. */
    mixinsOf(one: Primitive): readonly Primitive[];
    /** The corpus one primitive cites as its rationale, or nothing where it cites
     *  none or cites one this charter does not hold as a corpus — which
     *  `compositeFaultsByFiles` already names (FR-005, FR-014). */
    rationaleOf(one: Primitive): Primitive | undefined;
    /** Every primitive using one mixin; nothing for any other kind (FR-014). */
    hostsOf(mixin: Primitive): readonly Primitive[];
    /** Every primitive citing one corpus as its rationale; nothing for any other
     *  kind (FR-014). */
    citersOf(corpus: Primitive): readonly Primitive[];
    /** Every primitive naming one, as `[[<id>]]` (FR-144, FR-163, FR-172). */
    mentionersOf(referencedPrimitive: Primitive): readonly Primitive[];
    /** The ids one primitive names as `[[<id>]]`, whether the charter holds them
     *  or not: in its body (FR-143, FR-172); for an agent, each mcp origin it holds by
     *  listing it among its tools (FR-156); and for a sensor, each script its
     *  `run` names (FR-161). */
    private idsMentionedIn;
    /** Does what a mixin lends reach as far as the host pulling it in, or the host
     *  no further than the mixin? A side that names no files is asking about
     *  nothing in particular, and is left alone (FR-006). */
    private reaches;
    /**
     * What is wrong with this charter that is wrong with no one file on its own,
     * under the file that has to change (FR-009).
     *
     * Reading refused the files whose own headers do not hold, and said so where
     * it read them; what is left are the questions no single file answers. Every
     * layer is read into one id space, the way one registry holds one name
     * per package: two files claim one id; one names a mixin nothing
     * answers to; one pulls in a mixin that speaks about other files than it does
     * — a mixin lends its body at projection time, so what makes the two belong
     * together is the files they both apply to (FR-006, FR-014). One cites a
     * rationale no corpus answers to, which is a warning rather than an error:
     * the rule holds without its reasoning, and the author is told the reasoning
     * is gone (FR-005). A corpus nobody cites and a mixin nobody pulls in are
     * warnings too: nothing breaks, and nothing reads them either (FR-014). So
     * are an mcp nothing names (FR-144) and a script or a template nothing names
     * (FR-163). A name no layer holds is an error (FR-162), and so are an agent
     * holding a tool its mcp does not declare — the role would be promised a
     * tool it cannot have (FR-156) — and a script whose `executionPath` names
     * no asset of it (FR-165).
     */
    get compositeFaultsByFiles(): FaultsByFile;
}

/**
 * DRIVER PORT — projecting the charter: the charter charter authoring keeps,
 * built and laid onto each agent provider the repository uses; the build and
 * its preview, the health check, the estimated main context, and what the
 * last build laid to be served or run — the tools of the mcp origins, the
 * sensors (CORE-FR-222). Runtime asks it, through this port alone, for the
 * mcp origins, the sensors of a signal, a build into a working copy, what an
 * agent is sent when a session opens, and an evaluation's cases
 * (CORE-FR-229).
 *
 * Which agents it builds for is what it was composed with, never what it reads
 * (CORE-FR-231). Every answer is a DTO, told apart from the others it may be
 * by its `type`; whatever stops an operation is among them, a
 * `FaultDTOs.Fault`, and never thrown (SDK-FR-004, SDK-FR-017, SDK-FR-018).
 */
interface ForBuildingCharter {
    /**
     * The three questions about this repository, asked in one go (FR-040): which
     * agents it compiles for, what validating its charter finds — its test files'
     * findings among it — and how many files a build would still change, with
     * the main context each agent opens with, estimated. Reads and says
     * (FR-041).
     */
    doctor(): Promise<CharterDTOs.DoctorOutcome | FaultDTOs.Fault>;
    /** What each agent this repository compiles for is sent of the charter when
     *  a session opens, estimated by a tokenizer on this machine (EVAL-FR-001,
     *  EVAL-FR-002). Reads and says (FR-041). */
    predictMainContext(): Promise<CharterDTOs.MainContexts | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;
    /**
     * One reading of the charter, put on disk (FR-020, FR-021): a charter with
     * an error is refused before anything is touched, with its errors given back
     * (FR-005, FR-009); an mcp origin that cannot be asked for its tools stops it
     * as an error does (EVAL-FR-031).
     */
    build(): Promise<CharterDTOs.PlanSummary | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;
    /** The build, worked out and stopped short of disk (FR-022). */
    preview(): Promise<CharterDTOs.PlanSummary | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;
    /** Every tool the mcp origins the last build listed serve, read off what it
     *  kept there: no mcp origin is reached to list them (EVAL-FR-031). */
    tools(): Promise<CharterDTOs.ServedTools | FaultDTOs.Fault>;
    /** Every tool the mcp origins the last build listed declare, under the name
     *  it is served by, with the mcp origin a call to it is forwarded to
     *  (FR-152 – FR-154). */
    declaredTools(): Promise<CharterDTOs.DeclaredTools | FaultDTOs.Fault>;
    /** The commands the last build laid for this signal of this agent
     *  (CORE-FR-176). */
    sensorCommands(signal: string, agent: AgentProviderName): Promise<CharterDTOs.SensorCommands | FaultDTOs.Fault>;
    /** The charter of the checkout `checkoutPath` names, built into it for the
     *  agents this was composed with, keeping the tools the last build kept
     *  (EVAL-FR-021). */
    buildInto(checkoutPath: string): Promise<CharterDTOs.PlanSummary | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;
    /** What each agent this repository compiles for is sent of the charter when
     *  a session opens, each text as the build lays it, for an exact count
     *  (EVAL-FR-004). */
    mainContextTexts(): Promise<CharterDTOs.MainContextTexts | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;
    /** Every evaluation case of the checkout `checkoutPath` names, checked
     *  against its charter: a charter with an error, a file that does not read,
     *  or a case naming a skill or a guide the charter does not hold, is answered
     *  as faults under their files (EVAL-FR-026). */
    evalCases(checkoutPath: string): Promise<CharterDTOs.EvalCases | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;
}

/**
 * DRIVEN PORT — a tokenizer that runs on this machine. The hexagon hands it a
 * text and is told how many tokens that text is; which tokenizer answers, and
 * how, is the adapter's business.
 *
 * No tokenizer of the model an agent runs on is at hand offline, so what this
 * answers is an estimate of that model's count, and whoever says the number
 * says so (EVAL-FR-002).
 */
interface ForCountingTokens {
    /** How many tokens this text is, to the tokenizer behind this port. */
    countTokens(text: string): number;
}

/**
 * What one primitive, or the charter itself, puts into an agent's main
 * context, as the text the agent is sent: when a session opens, or — where it
 * names `globs` — when a file they match is touched (EVAL-FR-001,
 * EVAL-FR-003). `id` is the primitive's, or, for what the charter puts there
 * itself, the file it is laid at.
 *
 * Its text is as it is laid: an agent reads what is laid, and what that is
 * is the agent's projection's to say (CORE-FR-221).
 */
interface MainContextText {
    readonly id: string;
    readonly kind: string;
    readonly text: string;
    readonly globs?: readonly string[];
}

/** One sensor as a build leaves it: its id, the signal it fires on, and the
 *  command that runs, each script it names written as its built file (FR-169). */
declare class BuiltSensor {
    readonly id: string;
    readonly signal: string;
    readonly command: string;
    readonly "agent-provider"?: readonly AgentProviderName[];
    constructor(fields: BuiltSensor);
}
/** The one command a host is given for a signal its charter's sensors fire
 *  on, whichever host: `cw` runs every one of them (FR-175). */
declare function sensorRunCommandOf(signal: string, agent?: AgentProvider): string;
/** Every sensor the last build compiled, in order of id: what
 *  `cw sensor run <signal>` reads, since it reads no charter (FR-179). */
declare class BuiltSensors {
    readonly sensors: readonly BuiltSensor[];
    static readonly runCommandOf: typeof sensorRunCommandOf;
    static readonly of: typeof keptBuiltSensorsOf;
    constructor(sensors: readonly BuiltSensor[]);
    /** Select only sensors that support the host raising the signal. */
    forAgent(agent: AgentProvider): BuiltSensors;
    /** What it is among the parts of a build's output: the whole charter's,
     *  every host's. */
    static get outputPart(): OutputPart;
    get outputPart(): OutputPart;
    /** What it holds: generated, and the charter's alone. Indented, since it is
     *  committed and read in diffs when a sensor's command changes. */
    get text(): string;
    /** Every signal at least one sensor names, each once, in the order the
     *  sensors name them. */
    get signals(): readonly string[];
}
/**
 * The sensors the last build compiled, from the text it kept (CORE-FR-179):
 * never the charter, so a sensor runs as built.
 *
 * No list, or one that does not read, is no sensor: what reads it is a hook,
 * and the host is given that hook only by a build that wrote the list.
 */
declare function keptBuiltSensorsOf(sensorsText: string | undefined): BuiltSensors;

/**
 * What a charter holds, listed for whoever reads it (FR-011, FR-013).
 *
 * Output, not charter: nothing here was authored and nothing here is read back,
 * and nothing here knows what a primitive is — reading one into an entry is the
 * service's, and this is handed the list (plan §2.6).
 *
 * It says itself what it is and what it holds; where it lands is the
 * projection's (CORE-FR-221).
 *
 * Ordered by id rather than by the order the files happened to be read, so
 * the same charter catalogues byte for byte the same and a committed catalogue
 * changes only when the charter does (SC-007).
 *
 * No bodies. What a primitive says is read from the file it names,
 * when the thing it applies to comes up and not before (FR-013).
 */
declare class Catalogue {
    readonly entries: readonly CatalogueEntry[];
    readonly agent?: AgentProvider | undefined;
    /** Entries in the order they are to be listed: by id (SC-007). */
    constructor(entries: readonly CatalogueEntry[], agent?: AgentProvider | undefined);
    /** What a catalogue is among the parts of a build's output: the listing
     *  every host shares, or one host's own (FR-011). */
    static outputPartOf(agent?: AgentProvider): OutputPart;
    get outputPart(): OutputPart;
    /** What it holds: the charter's own. Indented, since it is committed and
     *  read in diffs, and a listing whose entries land one per line says what
     *  changed in the charter rather than that the listing changed. */
    get text(): string;
    /**
     * The same listing, narrowed to the primitives of one kind (FR-011).
     *
     * A narrowed listing is a listing: what comes back answers `entries` the way
     * this does, so whoever reads it never has to ask whether it was narrowed. Nothing is re-sorted — the entries keep the order they were
     * put in, which is the order by id they were made in.
     */
    filterByKind(kind: string): Catalogue;
}
/**
 * One primitive as the listing records it: what it is called, what it is for,
 * the files it applies to, and the file its body is in (FR-011). Its kind and
 * id are all it is known by, and every other header is read from that file.
 *
 * Globs nobody wrote are left out rather than recorded as nothing.
 */
declare class CatalogueEntry {
    /** The agents it is listed for, or `all` where its primitive names none:
     *  what splits the catalogues in memory; omitted from their JSON files. */
    readonly agentProviders: "all" | readonly AgentProviderName[];
    readonly kind: string;
    readonly id: string;
    readonly description: string;
    /** Where the body is: a link, under `$CW_OUT/`, to the compiled
     *  primitive, in what a build writes; the authored file's uri, in what a
     *  person is listed (FR-140). */
    readonly file: string;
    readonly globs?: readonly string[];
    constructor(fields: CatalogueEntry);
}

/**
 * A document this engine wrote, saying so in itself (FR-017, FR-020).
 *
 * A build takes away what it no longer compiles, and where it looks is a
 * directory a host reads — the same directory someone may have written a command
 * or a skill of their own into, by hand, long before a charter was ever built
 * here. A path is not enough to tell the two apart, and guessing wrong destroys
 * someone's work. So a file this build puts down carries a stamp, and a build
 * deletes nothing that does not.
 *
 * It doubles as what a reader needs: a compiled file someone opens says where to
 * go and change it, rather than being edited into something the next build
 * undoes.
 *
 * Only what is written as prose can carry one. A listing is JSON and has nowhere
 * to say it, and a host's settings file is the repository's as much as this
 * engine's — those two are known by where they are instead.
 */
declare const GENERATED_STAMP = "Generated by cherry-works";
/**
 * One document with the stamp on the end of it: making one is stamping it.
 *
 * The one way any output of this engine becomes the text of a document, so every
 * one of them carries the stamp and none of them has to remember to. What the
 * document says above it is whoever compiled it; this adds the line and nothing
 * else.
 */
declare class StampedDocument {
    /** The document's text, the stamp on the end of it. */
    readonly text: string;
    constructor(document: string);
    /** The stamp alone, as it ends every stamped document. */
    static get footer(): string;
    /** The words of the stamp, for a document that is no prose and says it
     *  another way. */
    static get stampText(): typeof GENERATED_STAMP;
    /** Did this build, or one before it, write this file? Asked of what is on
     *  disk before anything is taken away. */
    static isStamped(contents: string): boolean;
}

/**
 * What an agent has to know before it reads anything else: that this repository
 * is governed by a charter, where the charter's own listing of itself is, and
 * when each kind is to be opened (FR-019).
 *
 * Orientation, and the few rules that are not worth the risk of being missed. A
 * primitive's body is opened when its activation condition is met and not
 * before, which is what the catalogue is for (FR-013) —
 * so a charter of four hundred guides compiles to the same few paragraphs as a
 * charter of four.
 *
 * The activation lines are read off the primitive classes, one per kind, each declaring
 * its own beside the headers it requires, so what a kind is and when it is
 * opened is said in one place (FR-001).
 *
 * It lands in the output folder, beside the listing it sends a reader to by
 * name. No charter here — it is handed the lines it writes, so what a kind is
 * is asked of the charter once, by the caller.
 *
 * No primitive's body reaches here, not even a guide's: this file is
 * orientation and the listings it sends a reader to. What every turn is to carry
 * is a host's to hand its agent, in that host's own kind.
 */
declare class CharterMd {
    /** This file as a reader opens it: the stamp saying this engine wrote it,
     *  and the orientation itself. */
    private readonly stampedDocument;
    static readonly type: "charter-md";
    readonly type: "charter-md";
    constructor(
    /** This file as a reader opens it: the stamp saying this engine wrote it,
     *  and the orientation itself. */
    stampedDocument: StampedDocument);
    /** What it is among the parts of a build's output: the one every host's
     *  entry file sends its agent to (FR-019, FR-051), the charter's own. */
    static get outputPart(): OutputPart;
    get outputPart(): OutputPart;
    get text(): string;
}

/** One asset of a compiled primitive: its path in the primitive's folder,
 *  what it holds, and whether it is run by its path (FR-160, FR-168). */
interface CompiledAsset {
    readonly file: string;
    readonly contents: Uint8Array;
    readonly executable: boolean;
}
/**
 * One primitive as an agent opens it: the headers its author wrote, and below
 * them the whole of what it says — the bodies of the mixins it pulls in, then its
 * own (FR-139) — with its assets beside it (FR-168).
 *
 * Every layer's primitive compiles to one of these, so what the catalogue sends
 * an agent to is a file in the output folder for all of them, the engine's own
 * included. The document is handed in whole: reading a primitive into it is the
 * compiler's. Where it and its assets land is the projection's (CORE-FR-221).
 */
declare class CompiledPrimitive {
    /** The kind of the primitive it was compiled from. */
    readonly kind: string;
    /** That primitive's id: `team/review`. */
    readonly id: string;
    /** What its document holds, stamped with where to change it instead. */
    private readonly stampedDocument;
    /** Its assets, laid beside its document: the path each has in its
     *  folder, what it holds, and whether it is run by its path — the one a
     *  script says to run (FR-160, FR-168). */
    readonly assets: readonly CompiledAsset[];
    constructor(
    /** The kind of the primitive it was compiled from. */
    kind: string, 
    /** That primitive's id: `team/review`. */
    id: string, 
    /** What its document holds, stamped with where to change it instead. */
    stampedDocument: StampedDocument, 
    /** Its assets, laid beside its document: the path each has in its
     *  folder, what it holds, and whether it is run by its path — the one a
     *  script says to run (FR-160, FR-168). */
    assets?: readonly CompiledAsset[]);
    /** What it is among the parts of a build's output: every host's. */
    get outputPart(): OutputPart;
    /** Its document as an agent opens it: generated, and the charter's alone
     *  (FR-140). */
    get text(): string;
}

/** The ways a developer may sign in to an mcp origin (FR-142): what an `mcp`
 *  primitive declares, and what the list of mcp origins carries for each address.
 *  Shared by the charter and the output, as the agent providers are. */
declare const MCP_AUTH_METHOD_NAMES: readonly ["oauth", "token"];
/** One of them, as a primitive's headers and the list of mcp origins write it. */
type McpAuthMethodName = (typeof MCP_AUTH_METHOD_NAMES)[number];

/** One tool as an mcp origin lists it: its name, what it does, and what it takes. */
interface McpToolDefinition {
    readonly name: string;
    readonly description: string;
    readonly inputSchema: Readonly<Record<string, unknown>>;
}
/**
 * One address and `path`, once, however many mcps declare it (FR-145).
 *
 * Where an mcp origin is, how a developer signs in to it, and the tools it listed
 * when the build reached it: which of them each mcp there lets the agent use is
 * its own, and the catalogue already lists every mcp. Keyed by where it is rather than by what it is called, because the
 * repository and a vendor may call one mcp origin by two names.
 */
declare class McpOrigin {
    /** Every mcp at this address and path, sorted. */
    readonly ids: readonly string[];
    /** The name each of those ids is served under, its tools as
     *  `<name>__<tool>`: made once, by the build that wrote the bodies naming
     *  it, so the server reads it rather than making it again (FR-145). */
    readonly names: Readonly<Record<string, string>>;
    readonly address: string;
    readonly endpoint?: string;
    readonly command?: {
        readonly command: string;
        readonly args: readonly string[];
        readonly tokenEnv?: string;
    };
    readonly path?: string;
    /** Every way any mcp here lets a developer sign in. */
    readonly auth: readonly McpAuthMethodName[];
    /** Each tool an mcp here declares, as the mcp origin listed it when the build
     *  reached it, by name: what the server lists without reaching the mcp origin
     *  (EVAL-FR-031). None in a list written before it was kept. */
    readonly tools?: readonly McpToolDefinition[];
    constructor(fields: McpOrigin);
}
/** What an mcp origin is told apart by: its address and path, never its name. */
declare const originKeyOf: ({ address, path }: {
    readonly address: string;
    readonly path?: string | undefined;
}) => string;
/** Every mcp origin the charter's mcps reach, each once: what `cw mcp serve` and
 *  `cw mcp auth` read, since neither reads a charter (FR-145). Ordered by
 *  address, then path (SC-007). */
declare class McpOrigins {
    readonly origins: readonly McpOrigin[];
    static get originKeyOf(): typeof originKeyOf;
    constructor(origins: readonly McpOrigin[]);
    /** What it is among the parts of a build's output: the whole charter's,
     *  every host's. */
    static get outputPart(): OutputPart;
    get outputPart(): OutputPart;
    /** What it holds: generated, and the charter's alone. Indented, since it is
     *  committed and read in diffs when a mcp origin moves (SC-038). */
    get text(): string;
}

/** One part of what a charter compiles to: what it is, its text, and, for a
 *  compiled primitive, its assets (CORE-FR-220). */
type CompiledPart = Catalogue | CharterMd | CompiledPrimitive | McpOrigins | BuiltSensors;
/**
 * Everything one reading of a charter compiles to (FR-021), naming no place
 * but inside the build's output: where the output lands, and what each agent
 * reads of it, is each projection's (CORE-FR-220, CORE-FR-221).
 *
 * What every reader of the charter gets is here whether an agent is installed or
 * not: the listing, and the file that orients a reader to it (FR-019). What the
 * agents this repository runs get is each agent's own listing here, and the
 * rest its projection makes of this (FR-018).
 */
declare class CharterOutput {
    /** Primitives shared by all providers. */
    readonly catalogue: Catalogue;
    readonly charterMd: CharterMd;
    readonly compiledPrimitives: readonly CompiledPrimitive[];
    readonly mcpOrigins: McpOrigins;
    readonly builtSensors: BuiltSensors;
    readonly agentBasedCatalogues: Readonly<Record<AgentProviderName, Catalogue>>;
    constructor(
    /** Primitives shared by all providers. */
    catalogue: Catalogue, charterMd: CharterMd, compiledPrimitives: readonly CompiledPrimitive[], mcpOrigins: McpOrigins, builtSensors: BuiltSensors, agentBasedCatalogues?: Readonly<Record<AgentProviderName, Catalogue>>);
    /** Every part of it, in the order a build lays them (FR-020, FR-021). */
    get compiledParts(): readonly CompiledPart[];
}

/** How one header value is written into the frontmatter. A list becomes
 *  `["a", "b"]`, with every entry in double quotes, because an unquoted glob
 *  such as `*.md` starts with `*`, which YAML reads as an alias. A line YAML
 *  would read as something other than that text — a list, a mapping, a comment,
 *  a quoted string, a boolean or a number — is written in double quotes too, so
 *  a sensor's `[ -z … ] || …` reads back as the command it is. Any other value
 *  is written as it is. */
declare function formatFrontmatterValue(value: unknown): string;
/** Each string, shortened to a name of its own: what `shortenStringsOf`
 *  answers, keyed by the string it was handed. */
type ShortStrings = Readonly<Record<string, string>>;
/**
 * Each string shortened to its first segment and four hex characters hashed
 * from the whole: `moneyforward_c3ae` for `moneyforward/billing-service`,
 * the first segment being what comes before the first `/`.
 *
 * Short whatever the string's length, and the same whatever other strings are
 * handed in with it, since the hash is of this string alone. FNV-1a over 32
 * bits, the first four hex characters kept: a name to tell strings apart by,
 * not a secret. Two that hash alike are told apart by a number, `_2` onward, in
 * the order the strings sort in.
 */
declare function shortenStringsOf(strings: readonly string[]): ShortStrings;
/** The hash of one text, in hex: what tells two readings of a primitive apart,
 *  as a short string that crosses HTTP as it is (FR-078). FNV-1a over 64 bits:
 *  read synchronously wherever a primitive is, and a mark of change, not a
 *  secret. */
declare function contentHashOf(content: string): string;
/** The headers and the body of a markdown file opening with a `---`
 *  frontmatter block, or nothing for a file that does not. */
declare function frontmatterOf(markdown: string): {
    headers: Readonly<Record<string, unknown>>;
    body: string;
} | undefined;
/** What several models share: how a frontmatter value is written and read back, how strings are shortened apart, and what a content hashes to. */
declare class ModelHelper {
    static readonly formatFrontmatterValue: typeof formatFrontmatterValue;
    static readonly frontmatterOf: typeof frontmatterOf;
    static readonly shortenStringsOf: typeof shortenStringsOf;
    static readonly contentHashOf: typeof contentHashOf;
    private constructor();
}

/**
 * What a TOML file holds once the charter's own table is written into it: the
 * file's text as it is where nothing it says changes, and otherwise the two
 * merged. Tables merge field by field at every depth; an entry of an array of
 * tables the file already holds is not added twice; a scalar or a scalar array
 * is the charter's whole. A file that is not TOML is refused, naming where it
 * is.
 */
declare function mergedTomlText(currentText: string | undefined, charterText: string, place: string): string;

/**
 * One file a host reads, whichever host: what it is and what it holds, so
 * laying it knows nothing of the host that asked for it but its kind there
 * and its id (FR-018).
 *
 * A host's file is a document (`DocumentBasedComponent`) or settings
 * (`SettingBasedComponent`); each of a host's own kinds extends one of the two.
 * Where it lands, and how it goes over what is there, is its host's
 * projection's (CORE-FR-221).
 */
declare abstract class ProviderComponent {
    /** The host that reads it. */
    readonly host: string;
    /** The kind of the primitive it was compiled from, or `charter` where it
     *  is the whole charter's. */
    readonly primitiveKind: string;
    /** What that host knows it by: the name it is called, or, for a file of
     *  the whole charter, the folder it is for or the part it plays. */
    readonly id: string;
    /** The whole of what the file holds, or of this engine's part of it, each
     *  path into the build's output under `$CW_OUT/`. */
    readonly document: string;
    readonly warnings: readonly string[];
    protected constructor(
    /** The host that reads it. */
    host: string, 
    /** The kind of the primitive it was compiled from, or `charter` where it
     *  is the whole charter's. */
    primitiveKind: string, 
    /** What that host knows it by: the name it is called, or, for a file of
     *  the whole charter, the folder it is for or the part it plays. */
    id: string, 
    /** The whole of what the file holds, or of this engine's part of it, each
     *  path into the build's output under `$CW_OUT/`. */
    document: string, warnings?: readonly string[]);
    get text(): string;
    /** Which of its host's kinds this is. Each class declares it as a literal. */
    abstract readonly kind: string;
}

/** A document this host reads no frontmatter of: the file it loads whole,
 *  whatever is in it. Its whole content is the body. */
type NoHeaders = Record<string, never>;
/**
 * One file a host reads as a document: frontmatter, then a body (FR-018).
 *
 * The other side of the compilation. A charter is what an author wrote — the
 * kinds, in the charter's words; this is what one host reads — its kinds, in
 * its words. Between the two sits a compiler, and the two never meet anywhere
 * else: a `guide` becomes a claude skill there and nowhere in the charter, and
 * the charter does not know this file exists.
 *
 * A document is frontmatter this host reads first and a body it opens once that
 * frontmatter says to. A kind of this host that is one is a class extending this,
 * declaring — in an interface of its own — what its frontmatter holds; a kind
 * whose file this host reads whole declares none and is body alone.
 *
 * A document carries what it is called, since that is part of what it is, and
 * the kind of primitive it was compiled from. Where it goes is its host's
 * projection's (CORE-FR-221).
 */
declare abstract class DocumentBasedComponent<Headers extends object = NoHeaders> extends ProviderComponent {
    /** What this host calls this one: the charter id with the `/` a filename
     *  does not carry written `-`, so `acme/review` is `acme-review` (FR-141,
     *  FR-171). Every document has one,
     *  whether or not that host reads it out of the frontmatter: it is what the
     *  file is called. */
    readonly name: string;
    /** What this host reads before the body, as the kind's own interface has
     *  it. Typed by whichever kind this is, so nothing reads a field of one
     *  kind's frontmatter off another's. */
    readonly headers: Headers;
    /** What the primitive says, with the mixins it pulls in already written
     *  into it (FR-006). */
    readonly body: string;
    protected constructor(host: string, primitiveKind: string, 
    /** What this host calls this one: the charter id with the `/` a filename
     *  does not carry written `-`, so `acme/review` is `acme-review` (FR-141,
     *  FR-171). Every document has one,
     *  whether or not that host reads it out of the frontmatter: it is what the
     *  file is called. */
    name: string, 
    /** What this host reads before the body, as the kind's own interface has
     *  it. Typed by whichever kind this is, so nothing reads a field of one
     *  kind's frontmatter off another's. */
    headers: Headers, 
    /** What the primitive says, with the mixins it pulls in already written
     *  into it (FR-006). */
    body: string);
}

/**
 * One file a host reads as settings: JSON it shares with the repository, which
 * this engine writes its own fields into and never over (FR-018, FR-146).
 *
 * No frontmatter, no body and no stamp: JSON has nowhere to carry one, and the
 * file is the repository's as much as this engine's, so it is known by the
 * part it plays instead.
 */
declare abstract class SettingBasedComponent<Settings extends object> extends ProviderComponent {
    /** The fields this engine speaks for in that file. */
    readonly settings: Settings;
    protected constructor(host: string, 
    /** The part it plays, which is its id there: one such file to a host. */
    part: string, 
    /** The fields this engine speaks for in that file. */
    settings: Settings);
}

/**
 * DRIVEN PORT — what one agent reads of a charter, and where: the files it
 * reads and how each goes over what is there, its own links in them, and
 * what of them it holds in its main context (FR-018, CORE-FR-221). The engine
 * hands it the charter and what the charter compiles to, whose paths are
 * under `$CW_OUT/`, and knows no agent: one is taught to the engine by
 * handing its application one more of these, under the agent's name.
 */
interface ForManagingLocalAgentOutput {
    /**
     * What laying this agent's files would do, decided and not yet done
     * (FR-020, FR-022): each place it would write, with what it would hold and
     * what it holds now, each place the last build left for it that this one
     * would take away or write again, and what it could not lay as the charter
     * says. Reads, and only reads. Under `checkoutPath`, a checkout of the
     * repository such as a worktree, where one is named.
     */
    createAgentProjectionPlan(charter: CharterRoot, charterOutput: CharterOutput, checkoutPath?: string): Promise<ProjectionPlan>;
    /** What this agent puts into its main context of the charter, each text as
     *  it lays it (EVAL-FR-001, EVAL-FR-003). */
    mainContextTextsOf(charter: CharterRoot, charterOutput: CharterOutput): readonly MainContextText[];
    /** How many of this agent's tokens one token of the tokenizer on this
     *  machine stands for: what an estimate is scaled by (EVAL-SC-002). */
    readonly tokenFactor: number;
}

/**
 * The local files a build checks and writes: it lays a build's output onto a
 * repository, wherever it lays it, and writes every file a build planned: where the output lands is its own to know,
 * never the engine's, which knows a part by its path inside the output, under
 * `$CW_OUT/` (CORE-FR-220, CORE-FR-221). What each agent reads is
 * that agent's projection's, `ForManagingLocalAgentOutput`.
 *
 * What the build laid is read back through the charter's repository,
 * `ForManagingCharter`, never off a path the engine knows (CORE-FR-222).
 */
interface ForManagingLocalOutput {
    /**
     * What laying this output would do, decided and not yet done (FR-020,
     * FR-022): each place it would write, with what it would hold and what it
     * holds now, and each place the last build left in the output that this one
     * would take away or write again. Reads, and only reads. Under
     * `checkoutPath`, a checkout of the repository such as a worktree, where one
     * is named.
     */
    createProjectionPlan(charterOutput: CharterOutput, checkoutPath?: string): Promise<ProjectionPlan>;
    /** That plan carried out, every agent's files in it: what the last build
     *  left taken away, then this one written (FR-020, FR-021). */
    writePlan(plan: ProjectionPlan): Promise<void>;
}

/**
 * What every agent's projection onto a repository's files does the same way:
 * each of the agent's files planned at its place over what is there now, each
 * stamped file the last build left in the agent's own folders taken away
 * where this one writes it no more, and the paths into the build's output in
 * each written from where the file lands (FR-018, FR-020, CORE-FR-221). What
 * the files are, where each lands and how it goes over what is there is each
 * agent's own.
 */
declare abstract class AgentProjection implements ForManagingLocalAgentOutput {
    #private;
    protected readonly fileReader: ForReadingFiles;
    constructor(fileReader: ForReadingFiles);
    abstract readonly tokenFactor: number;
    /** The folders only this agent's files are in: every stamped file a build
     *  left there is the build's to take away (FR-020). */
    protected abstract readonly ownedFolders: readonly string[];
    /** Every file this agent reads of the charter (FR-018). */
    protected abstract componentsOf(charter: CharterRoot, charterOutput: CharterOutput): readonly ProviderComponent[];
    /** Where one of this agent's files lands, from the repository's root. */
    protected abstract placeOf(component: ProviderComponent): string;
    abstract mainContextTextsOf(charter: CharterRoot, charterOutput: CharterOutput): readonly MainContextText[];
    /** What a file is once this build's part is written over `currentText`,
     *  what is there now: the charter's part alone, where the file is the
     *  charter's. */
    protected contentsOf(_component: ProviderComponent, laidText: string, _currentText: string | undefined, _place: string): string;
    /** What else the last build left for this agent outside its own folders,
     *  each with what to write back where it is the repository's too. */
    protected planOtherCleanup(_checkoutPath: string): Promise<readonly WritePlan[]>;
    createAgentProjectionPlan(charter: CharterRoot, charterOutput: CharterOutput, checkoutPath?: string): Promise<ProjectionPlan>;
}

/**
 * DRIVEN ADAPTER: a charter projected onto Claude Code — its rules, skills,
 * subagents, settings and MCP configuration under the folders it reads, and
 * the charter's section of `CLAUDE.md` (FR-018, FR-051, CORE-FR-221).
 *
 * How a file goes over what is there is decided by its kind. A file the
 * charter owns is replaced. The settings and the MCP configuration, which the
 * charter shares with the repository, are merged into: the fields the charter
 * speaks for are its, and every other is left as it was (FR-018). And the
 * entry file, which is the repository's, has the charter's section written in
 * place (FR-051).
 */
declare class ClaudeProjection extends AgentProjection {
    readonly tokenFactor = 1.43;
    protected readonly ownedFolders: string[];
    protected componentsOf(charter: CharterRoot, charterOutput: CharterOutput): readonly ProviderComponent[];
    protected placeOf(component: ProviderComponent): string;
    protected contentsOf(component: ProviderComponent, laidText: string, currentText: string | undefined): string;
    mainContextTextsOf(charter: CharterRoot, charterOutput: CharterOutput): readonly MainContextText[];
}

/**
 * DRIVEN ADAPTER: a charter projected onto Codex — its skills, subagents,
 * command rules and configuration under the folders it reads, and the
 * charter's section of `AGENTS.md`, at the repository's root and in each
 * folder a guide's globs name (FR-018, FR-051, CORE-FR-221).
 *
 * How a file goes over what is there is decided by its kind. A file the
 * charter owns is replaced; the configuration, which the charter shares with
 * the repository, is merged into, every table the charter does not speak for
 * left as it was (FR-018); and an entry file, which is the repository's, has
 * the charter's section written in place (FR-051).
 */
declare class CodexProjection extends AgentProjection {
    readonly tokenFactor = 1;
    protected readonly ownedFolders: string[];
    protected componentsOf(charter: CharterRoot, charterOutput: CharterOutput): readonly ProviderComponent[];
    protected placeOf(component: ProviderComponent): string;
    protected contentsOf(component: ProviderComponent, laidText: string, currentText: string | undefined, place: string): string;
    /** Every nested entry file carrying the stamp, each with the text that is
     *  the repository's own where some is: a stamped section does not make the
     *  text around it the build's (FR-020). Only folders are walked, not every
     *  file of the repository read. */
    protected planOtherCleanup(checkoutPath: string): Promise<readonly WritePlan[]>;
    mainContextTextsOf(charter: CharterRoot, charterOutput: CharterOutput): readonly MainContextText[];
}

/**
 * Keeps a charter as files, all of it through the one port (CORE-FR-228),
 * under `.cw/charter/` (CORE-FR-224): the repository's own primitives under
 * `primitive/`, each a folder of its kind's, `<kind>/<id>/`, holding its
 * index.md and its assets; the vendors it installed under `vendor/`, each
 * named as it was installed; its test cases under `test/` and its eval cases
 * under `eval/`, a JSON file each. A source is read as cw lays one out: its
 * own charter at `.cw/charter/primitive/`, charters kept apart at
 * `charters/<name>/.cw/charter/primitive/`, and skills under `skills/`
 * (CORE-FR-185, CORE-FR-195).
 *
 * A repository laid out the old way — its kinds right under `.cw/charter/`,
 * its tests, eval cases and vendors right under `.cw/` — is refused by every
 * operation, and so is a source laid out that way, naming the skill that
 * moves it (CORE-FR-226).
 */
declare class FileCharterRepository implements ForManagingCharter {
    #private;
    constructor(fileReader: ForReadingFiles, fileWriter: ForWritingFiles, sourceFetcher: ForFetchingCharterSources);
    loadCharter(checkoutPath?: string): Promise<readonly RawPrimitive[]>;
    createCharter(): Promise<void>;
    addPrimitive(rawPrimitive: RawPrimitive): Promise<string>;
    injectPrimitives(rawPrimitives: readonly RawPrimitive[]): Promise<readonly string[]>;
    assertLayout(): Promise<void>;
    findCharterUri(): string;
    rewritePrimitive(primitive: Primitive): Promise<void>;
    removePrimitive(primitive: Primitive): Promise<void>;
    fetchVendorSource(vendorSourceOrigin: VendorSourceOrigin, version?: string): Promise<RawVendorSource>;
    cleanupVendorSource(rawVendorSource: RawVendorSource): Promise<void>;
    loadVendorRoot(): Promise<VendorRoot>;
    storeVendor(vendorSource: VendorSource, projectionPlan: ProjectionPlan<WritePlan | CopyPlan>): Promise<void>;
    findVendorUri(vendorName: string): string;
    removeVendor(vendorName: string): Promise<void>;
    loadTestSuites(): Promise<readonly RawTestSuite[]>;
    writeTestSuite(name: string, testSuite: TestSuite): Promise<void>;
    removeTestSuite(name: string): Promise<void>;
    loadEvalSuites(checkoutPath?: string): Promise<readonly RawEvalSuite[]>;
    writeEvalSuite(name: string, evalSuiteText: string): Promise<void>;
    removeEvalSuite(name: string): Promise<void>;
    loadLaidText(outputPart: OutputPart, checkoutPath?: string): Promise<string | undefined>;
    findPlace(outputPart: OutputPart): string;
    findOutputFolder(): string;
}

/**
 * DRIVEN ADAPTER: git, as the command everyone already has.
 *
 * Each fetch lands in a store of its own, a temporary bare repository, so the
 * folder installed into need not be a repository and its own object store and
 * index are never touched, if it is one. That store's folder is the commit this
 * adapter answers: it holds the one commit fetched, under `FETCH_HEAD`. The
 * fetch still reads the repository's own git config, where the folder is in one,
 * so a source is reached as `git fetch` run there would reach it (CORE-FR-205).
 * Handing it over takes git 2.31 or later.
 */
declare class GitSources implements ForFetchingCharterSources {
    #private;
    constructor(
    /** The repository this works in, every path it is handed from its root:
     *  refused here unless it names a folder (SDK-FR-010). */
    repoFolder: URL);
    /** `git init --bare` first, as nothing else needs a folder: a refusal with
     *  no such command is a machine without git, not a source out of reach. */
    fetchCommit(source: string, version?: string): Promise<string>;
    /** `git ls-tree -r`, the paths split on the NUL `-z` ends each with, so a
     *  path holding a newline or a quote is read as it is. */
    listFilesAt(storeFolder: string): Promise<readonly string[]>;
    /** `git show FETCH_HEAD:<path>`. */
    readFileAt(storeFolder: string, path: string): Promise<string>;
    /** `git cat-file blob FETCH_HEAD:<path>`, its output taken as bytes: the
     *  blob as it was committed, with no textconv a user's own git config sets
     *  (CORE-FR-207). */
    readBytesAt(storeFolder: string, path: string): Promise<Uint8Array>;
    /** `git read-tree --prefix` into an index of the store's, and `checkout-index`
     *  into a work tree of the store's, then a copy beside the folder, swapped with
     *  it once whole, the folder put back if the swap fails. The
     *  repository's own index, and what is staged in it, is never read from or
     *  written to. */
    checkoutFolderAt(storeFolder: string, fromFolder: string, intoSubFolder: string): Promise<void>;
    /** A store left behind is only a temporary folder, and never worth reporting
     *  a source that landed as one that failed. */
    forgetCommit(storeFolder: string): Promise<void>;
}

/**
 * DRIVEN ADAPTER: each mcp origin's credential kept as one JSON secret under
 * its address, in the operating system's own credential store, reached by
 * the command each system ships — `security` on macOS, `secret-tool` on Linux
 * (FR-149).
 *
 * The secret goes in on standard input, so it never shows in a process
 * listing. `security add-generic-password` takes a password only as an
 * argument, so on macOS the whole command is written to `security -i`, the
 * secret as hex through `-X`. What a command prints while writing is never
 * repeated in a fault: it could echo what it was given.
 *
 * Any other platform refuses every call, naming the two it supports.
 */
declare class KeychainCredentialsRepository implements ForStoringCredentials {
    #private;
    private readonly platform;
    /** Which system's store to use: this process's, unless a test names
     *  another. Named as `process.platform` names it, and typed as a plain
     *  string so a tool importing it type-checks without Node's own types. */
    constructor(platform?: string);
    readCredential(address: string): Promise<McpCredential | undefined>;
    writeCredential(credential: McpCredential): Promise<void>;
    /** macOS and Linux have a store this knows; anything else is refused
     *  before a command runs. */
    private refuseUnsupportedPlatform;
    private throwFault;
}

/**
 * DRIVEN ADAPTER: a build's output laid onto the repository as files, under
 * `.cw/out/`, which nothing else writes, each part as the build compiled it
 * (CORE-FR-221); and every file a build planned, each agent's own among them,
 * written.
 */
declare class LocalRepoManipulator implements ForManagingLocalOutput {
    #private;
    constructor(fileReader: ForReadingFiles, fileWriter: ForWritingFiles);
    createProjectionPlan(charterOutput: CharterOutput, checkoutPath?: string): Promise<ProjectionPlan>;
    writePlan(buildPlan: ProjectionPlan): Promise<void>;
}

/**
 * DRIVEN ADAPTER: OAuth against one MCP server, over the SDK's own client —
 * discovery, dynamic registration, PKCE and renewal are its (plan §19.5).
 *
 * A sign-in listens on `127.0.0.1` at a port the system picks, for the one
 * request the browser comes back with, and closes. The address to open is
 * handed to the caller, never opened here (plan §15). Nothing is kept here:
 * the grant goes back to the caller, and the credential store is its business.
 */
declare class OAuth implements ForAuthorizingMcpOrigins {
    #private;
    constructor(callbackTimeoutMs?: number);
    authorize(endpoint: string, showAuthorizationUrl: (authorizationUrl: string) => void): Promise<OAuthGrant>;
    renew(endpoint: string, oauthGrant: OAuthGrant): Promise<OAuthGrant | undefined>;
}

/**
 * DRIVEN ADAPTER: js-tiktoken, a tokenizer that runs offline, with
 * `o200k_base`. Not the tokenizer of the model an agent runs on, which is not
 * published; near enough to stand in for it, and said to be an estimate
 * wherever it is used (EVAL-FR-002).
 *
 * The encoding is loaded the first time a text is counted, not when this is
 * made: a command that counts nothing pays nothing for it.
 */
declare class Tiktoken implements ForCountingTokens {
    #private;
    countTokens(text: string): number;
}

/** Every schema of this module's DTOs, under its name — the name it carries
 *  as `type` — in alphabetical order. */
declare const RuntimeDTOs: {
    EvalCaseReport: z.ZodObject<{
        type: z.ZodLiteral<"EvalCaseReport">;
        data: z.ZodObject<{
            suiteName: z.ZodString;
            prompt: z.ZodString;
            passed: z.ZodBoolean;
            tokens: z.ZodNumber;
            unmetReasons: z.ZodReadonly<z.ZodArray<z.ZodString>>;
            logPath: z.ZodOptional<z.ZodString>;
            sessionId: z.ZodOptional<z.ZodString>;
            sessionPath: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            suiteName: string;
            prompt: string;
            passed: boolean;
            tokens: number;
            unmetReasons: readonly string[];
            logPath?: string | undefined;
            sessionId?: string | undefined;
            sessionPath?: string | undefined;
        }) => {
            type: "EvalCaseReport";
            data: {
                suiteName: string;
                prompt: string;
                passed: boolean;
                tokens: number;
                unmetReasons: readonly string[];
                logPath?: string | undefined;
                sessionId?: string | undefined;
                sessionPath?: string | undefined;
            };
        };
    };
    EvalRunReport: z.ZodObject<{
        type: z.ZodLiteral<"EvalRunReport">;
        data: z.ZodObject<{
            agent: z.ZodString;
            evalCaseReports: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                type: z.ZodLiteral<"EvalCaseReport">;
                data: z.ZodObject<{
                    suiteName: z.ZodString;
                    prompt: z.ZodString;
                    passed: z.ZodBoolean;
                    tokens: z.ZodNumber;
                    unmetReasons: z.ZodReadonly<z.ZodArray<z.ZodString>>;
                    logPath: z.ZodOptional<z.ZodString>;
                    sessionId: z.ZodOptional<z.ZodString>;
                    sessionPath: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>;
            }, z.core.$strip> & {
                of: (dataValue: {
                    suiteName: string;
                    prompt: string;
                    passed: boolean;
                    tokens: number;
                    unmetReasons: readonly string[];
                    logPath?: string | undefined;
                    sessionId?: string | undefined;
                    sessionPath?: string | undefined;
                }) => {
                    type: "EvalCaseReport";
                    data: {
                        suiteName: string;
                        prompt: string;
                        passed: boolean;
                        tokens: number;
                        unmetReasons: readonly string[];
                        logPath?: string | undefined;
                        sessionId?: string | undefined;
                        sessionPath?: string | undefined;
                    };
                };
            }>>;
            totalTokens: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            agent: string;
            evalCaseReports: readonly {
                type: "EvalCaseReport";
                data: {
                    suiteName: string;
                    prompt: string;
                    passed: boolean;
                    tokens: number;
                    unmetReasons: readonly string[];
                    logPath?: string | undefined;
                    sessionId?: string | undefined;
                    sessionPath?: string | undefined;
                };
            }[];
            totalTokens: number;
        }) => {
            type: "EvalRunReport";
            data: {
                agent: string;
                evalCaseReports: readonly {
                    type: "EvalCaseReport";
                    data: {
                        suiteName: string;
                        prompt: string;
                        passed: boolean;
                        tokens: number;
                        unmetReasons: readonly string[];
                        logPath?: string | undefined;
                        sessionId?: string | undefined;
                        sessionPath?: string | undefined;
                    };
                }[];
                totalTokens: number;
            };
        };
    };
    EvalLogAnalysis: z.ZodObject<{
        type: z.ZodLiteral<"EvalLogAnalysis">;
        data: z.ZodObject<{
            logs: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                logPath: z.ZodString;
                createdAt: z.ZodString;
                agent: z.ZodString;
                prompt: z.ZodString;
                workingFolderPath: z.ZodString;
                outputPath: z.ZodString;
                stdoutPath: z.ZodString;
                stderrPath: z.ZodString;
                success: z.ZodBoolean;
                totalTokens: z.ZodNumber;
                unmetReasons: z.ZodReadonly<z.ZodArray<z.ZodString>>;
                answer: z.ZodString;
                toolCalls: z.ZodReadonly<z.ZodArray<z.ZodString>>;
                sessionId: z.ZodOptional<z.ZodString>;
                sessionPath: z.ZodOptional<z.ZodString>;
                error: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            logs: readonly {
                logPath: string;
                createdAt: string;
                agent: string;
                prompt: string;
                workingFolderPath: string;
                outputPath: string;
                stdoutPath: string;
                stderrPath: string;
                success: boolean;
                totalTokens: number;
                unmetReasons: readonly string[];
                answer: string;
                toolCalls: readonly string[];
                sessionId?: string | undefined;
                sessionPath?: string | undefined;
                error?: string | undefined;
            }[];
        }) => {
            type: "EvalLogAnalysis";
            data: {
                logs: readonly {
                    logPath: string;
                    createdAt: string;
                    agent: string;
                    prompt: string;
                    workingFolderPath: string;
                    outputPath: string;
                    stdoutPath: string;
                    stderrPath: string;
                    success: boolean;
                    totalTokens: number;
                    unmetReasons: readonly string[];
                    answer: string;
                    toolCalls: readonly string[];
                    sessionId?: string | undefined;
                    sessionPath?: string | undefined;
                    error?: string | undefined;
                }[];
            };
        };
    };
    ToolAnswer: z.ZodObject<{
        type: z.ZodLiteral<"ToolAnswer">;
        data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strip> & {
        of: (dataValue: Record<string, unknown>) => {
            type: "ToolAnswer";
            data: Record<string, unknown>;
        };
    };
    SessionSummary: z.ZodObject<{
        type: z.ZodLiteral<"SessionSummary">;
        data: z.ZodObject<{
            span: z.ZodObject<{
                since: z.ZodString;
                until: z.ZodString;
            }, z.core.$strip>;
            sessions: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                sessionId: z.ZodString;
                model: z.ZodString;
                lastStopAt: z.ZodString;
                tokens: z.ZodObject<{
                    input: z.ZodNumber;
                    output: z.ZodNumber;
                    cacheWrite: z.ZodNumber;
                    cacheRead: z.ZodNumber;
                }, z.core.$strip>;
                totalTokens: z.ZodNumber;
            }, z.core.$strip>>>;
            sessionCount: z.ZodNumber;
            totalTokens: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            span: {
                since: string;
                until: string;
            };
            sessions: readonly {
                sessionId: string;
                model: string;
                lastStopAt: string;
                tokens: {
                    input: number;
                    output: number;
                    cacheWrite: number;
                    cacheRead: number;
                };
                totalTokens: number;
            }[];
            sessionCount: number;
            totalTokens: number;
        }) => {
            type: "SessionSummary";
            data: {
                span: {
                    since: string;
                    until: string;
                };
                sessions: readonly {
                    sessionId: string;
                    model: string;
                    lastStopAt: string;
                    tokens: {
                        input: number;
                        output: number;
                        cacheWrite: number;
                        cacheRead: number;
                    };
                    totalTokens: number;
                }[];
                sessionCount: number;
                totalTokens: number;
            };
        };
    };
    SessionReviewOutcome: z.ZodObject<{
        type: z.ZodLiteral<"SessionReviewOutcome">;
        data: z.ZodObject<{
            sessionsFolder: z.ZodString;
            sessionSummary: z.ZodObject<{
                type: z.ZodLiteral<"SessionSummary">;
                data: z.ZodObject<{
                    span: z.ZodObject<{
                        since: z.ZodString;
                        until: z.ZodString;
                    }, z.core.$strip>;
                    sessions: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                        sessionId: z.ZodString;
                        model: z.ZodString;
                        lastStopAt: z.ZodString;
                        tokens: z.ZodObject<{
                            input: z.ZodNumber;
                            output: z.ZodNumber;
                            cacheWrite: z.ZodNumber;
                            cacheRead: z.ZodNumber;
                        }, z.core.$strip>;
                        totalTokens: z.ZodNumber;
                    }, z.core.$strip>>>;
                    sessionCount: z.ZodNumber;
                    totalTokens: z.ZodNumber;
                }, z.core.$strip>;
            }, z.core.$strip> & {
                of: (dataValue: {
                    span: {
                        since: string;
                        until: string;
                    };
                    sessions: readonly {
                        sessionId: string;
                        model: string;
                        lastStopAt: string;
                        tokens: {
                            input: number;
                            output: number;
                            cacheWrite: number;
                            cacheRead: number;
                        };
                        totalTokens: number;
                    }[];
                    sessionCount: number;
                    totalTokens: number;
                }) => {
                    type: "SessionSummary";
                    data: {
                        span: {
                            since: string;
                            until: string;
                        };
                        sessions: readonly {
                            sessionId: string;
                            model: string;
                            lastStopAt: string;
                            tokens: {
                                input: number;
                                output: number;
                                cacheWrite: number;
                                cacheRead: number;
                            };
                            totalTokens: number;
                        }[];
                        sessionCount: number;
                        totalTokens: number;
                    };
                };
            };
            dailySessionSummary: z.ZodRecord<z.ZodString, z.ZodObject<{
                type: z.ZodLiteral<"SessionSummary">;
                data: z.ZodObject<{
                    span: z.ZodObject<{
                        since: z.ZodString;
                        until: z.ZodString;
                    }, z.core.$strip>;
                    sessions: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                        sessionId: z.ZodString;
                        model: z.ZodString;
                        lastStopAt: z.ZodString;
                        tokens: z.ZodObject<{
                            input: z.ZodNumber;
                            output: z.ZodNumber;
                            cacheWrite: z.ZodNumber;
                            cacheRead: z.ZodNumber;
                        }, z.core.$strip>;
                        totalTokens: z.ZodNumber;
                    }, z.core.$strip>>>;
                    sessionCount: z.ZodNumber;
                    totalTokens: z.ZodNumber;
                }, z.core.$strip>;
            }, z.core.$strip> & {
                of: (dataValue: {
                    span: {
                        since: string;
                        until: string;
                    };
                    sessions: readonly {
                        sessionId: string;
                        model: string;
                        lastStopAt: string;
                        tokens: {
                            input: number;
                            output: number;
                            cacheWrite: number;
                            cacheRead: number;
                        };
                        totalTokens: number;
                    }[];
                    sessionCount: number;
                    totalTokens: number;
                }) => {
                    type: "SessionSummary";
                    data: {
                        span: {
                            since: string;
                            until: string;
                        };
                        sessions: readonly {
                            sessionId: string;
                            model: string;
                            lastStopAt: string;
                            tokens: {
                                input: number;
                                output: number;
                                cacheWrite: number;
                                cacheRead: number;
                            };
                            totalTokens: number;
                        }[];
                        sessionCount: number;
                        totalTokens: number;
                    };
                };
            }>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            sessionsFolder: string;
            sessionSummary: {
                type: "SessionSummary";
                data: {
                    span: {
                        since: string;
                        until: string;
                    };
                    sessions: readonly {
                        sessionId: string;
                        model: string;
                        lastStopAt: string;
                        tokens: {
                            input: number;
                            output: number;
                            cacheWrite: number;
                            cacheRead: number;
                        };
                        totalTokens: number;
                    }[];
                    sessionCount: number;
                    totalTokens: number;
                };
            };
            dailySessionSummary: Record<string, {
                type: "SessionSummary";
                data: {
                    span: {
                        since: string;
                        until: string;
                    };
                    sessions: readonly {
                        sessionId: string;
                        model: string;
                        lastStopAt: string;
                        tokens: {
                            input: number;
                            output: number;
                            cacheWrite: number;
                            cacheRead: number;
                        };
                        totalTokens: number;
                    }[];
                    sessionCount: number;
                    totalTokens: number;
                };
            }>;
        }) => {
            type: "SessionReviewOutcome";
            data: {
                sessionsFolder: string;
                sessionSummary: {
                    type: "SessionSummary";
                    data: {
                        span: {
                            since: string;
                            until: string;
                        };
                        sessions: readonly {
                            sessionId: string;
                            model: string;
                            lastStopAt: string;
                            tokens: {
                                input: number;
                                output: number;
                                cacheWrite: number;
                                cacheRead: number;
                            };
                            totalTokens: number;
                        }[];
                        sessionCount: number;
                        totalTokens: number;
                    };
                };
                dailySessionSummary: Record<string, {
                    type: "SessionSummary";
                    data: {
                        span: {
                            since: string;
                            until: string;
                        };
                        sessions: readonly {
                            sessionId: string;
                            model: string;
                            lastStopAt: string;
                            tokens: {
                                input: number;
                                output: number;
                                cacheWrite: number;
                                cacheRead: number;
                            };
                            totalTokens: number;
                        }[];
                        sessionCount: number;
                        totalTokens: number;
                    };
                }>;
            };
        };
    };
    SensorRunOutcome: z.ZodObject<{
        type: z.ZodLiteral<"SensorRunOutcome">;
        data: z.ZodObject<{
            exitCode: z.ZodNumber;
            answer: z.ZodString;
            problem: z.ZodString;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            exitCode: number;
            answer: string;
            problem: string;
        }) => {
            type: "SensorRunOutcome";
            data: {
                exitCode: number;
                answer: string;
                problem: string;
            };
        };
    };
    MainContextLoad: z.ZodObject<{
        type: z.ZodLiteral<"MainContextLoad">;
        data: z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodString;
            tokens: z.ZodNumber;
            globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            id: string;
            kind: string;
            tokens: number;
            globs?: readonly string[] | undefined;
        }) => {
            type: "MainContextLoad";
            data: {
                id: string;
                kind: string;
                tokens: number;
                globs?: readonly string[] | undefined;
            };
        };
    };
    MainContext: z.ZodObject<{
        type: z.ZodLiteral<"MainContext">;
        data: z.ZodObject<{
            agent: z.ZodString;
            isExact: z.ZodBoolean;
            sessionLoads: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                type: z.ZodLiteral<"MainContextLoad">;
                data: z.ZodObject<{
                    id: z.ZodString;
                    kind: z.ZodString;
                    tokens: z.ZodNumber;
                    globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
                }, z.core.$strip>;
            }, z.core.$strip> & {
                of: (dataValue: {
                    id: string;
                    kind: string;
                    tokens: number;
                    globs?: readonly string[] | undefined;
                }) => {
                    type: "MainContextLoad";
                    data: {
                        id: string;
                        kind: string;
                        tokens: number;
                        globs?: readonly string[] | undefined;
                    };
                };
            }>>;
            fileLoads: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                type: z.ZodLiteral<"MainContextLoad">;
                data: z.ZodObject<{
                    id: z.ZodString;
                    kind: z.ZodString;
                    tokens: z.ZodNumber;
                    globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
                }, z.core.$strip>;
            }, z.core.$strip> & {
                of: (dataValue: {
                    id: string;
                    kind: string;
                    tokens: number;
                    globs?: readonly string[] | undefined;
                }) => {
                    type: "MainContextLoad";
                    data: {
                        id: string;
                        kind: string;
                        tokens: number;
                        globs?: readonly string[] | undefined;
                    };
                };
            }>>;
            totalTokens: z.ZodNumber;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            agent: string;
            isExact: boolean;
            sessionLoads: readonly {
                type: "MainContextLoad";
                data: {
                    id: string;
                    kind: string;
                    tokens: number;
                    globs?: readonly string[] | undefined;
                };
            }[];
            fileLoads: readonly {
                type: "MainContextLoad";
                data: {
                    id: string;
                    kind: string;
                    tokens: number;
                    globs?: readonly string[] | undefined;
                };
            }[];
            totalTokens: number;
        }) => {
            type: "MainContext";
            data: {
                agent: string;
                isExact: boolean;
                sessionLoads: readonly {
                    type: "MainContextLoad";
                    data: {
                        id: string;
                        kind: string;
                        tokens: number;
                        globs?: readonly string[] | undefined;
                    };
                }[];
                fileLoads: readonly {
                    type: "MainContextLoad";
                    data: {
                        id: string;
                        kind: string;
                        tokens: number;
                        globs?: readonly string[] | undefined;
                    };
                }[];
                totalTokens: number;
            };
        };
    };
    MainContexts: z.ZodObject<{
        type: z.ZodLiteral<"MainContexts">;
        data: z.ZodObject<{
            contexts: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                type: z.ZodLiteral<"MainContext">;
                data: z.ZodObject<{
                    agent: z.ZodString;
                    isExact: z.ZodBoolean;
                    sessionLoads: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                        type: z.ZodLiteral<"MainContextLoad">;
                        data: z.ZodObject<{
                            id: z.ZodString;
                            kind: z.ZodString;
                            tokens: z.ZodNumber;
                            globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
                        }, z.core.$strip>;
                    }, z.core.$strip> & {
                        of: (dataValue: {
                            id: string;
                            kind: string;
                            tokens: number;
                            globs?: readonly string[] | undefined;
                        }) => {
                            type: "MainContextLoad";
                            data: {
                                id: string;
                                kind: string;
                                tokens: number;
                                globs?: readonly string[] | undefined;
                            };
                        };
                    }>>;
                    fileLoads: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                        type: z.ZodLiteral<"MainContextLoad">;
                        data: z.ZodObject<{
                            id: z.ZodString;
                            kind: z.ZodString;
                            tokens: z.ZodNumber;
                            globs: z.ZodOptional<z.ZodReadonly<z.ZodArray<z.ZodString>>>;
                        }, z.core.$strip>;
                    }, z.core.$strip> & {
                        of: (dataValue: {
                            id: string;
                            kind: string;
                            tokens: number;
                            globs?: readonly string[] | undefined;
                        }) => {
                            type: "MainContextLoad";
                            data: {
                                id: string;
                                kind: string;
                                tokens: number;
                                globs?: readonly string[] | undefined;
                            };
                        };
                    }>>;
                    totalTokens: z.ZodNumber;
                }, z.core.$strip>;
            }, z.core.$strip> & {
                of: (dataValue: {
                    agent: string;
                    isExact: boolean;
                    sessionLoads: readonly {
                        type: "MainContextLoad";
                        data: {
                            id: string;
                            kind: string;
                            tokens: number;
                            globs?: readonly string[] | undefined;
                        };
                    }[];
                    fileLoads: readonly {
                        type: "MainContextLoad";
                        data: {
                            id: string;
                            kind: string;
                            tokens: number;
                            globs?: readonly string[] | undefined;
                        };
                    }[];
                    totalTokens: number;
                }) => {
                    type: "MainContext";
                    data: {
                        agent: string;
                        isExact: boolean;
                        sessionLoads: readonly {
                            type: "MainContextLoad";
                            data: {
                                id: string;
                                kind: string;
                                tokens: number;
                                globs?: readonly string[] | undefined;
                            };
                        }[];
                        fileLoads: readonly {
                            type: "MainContextLoad";
                            data: {
                                id: string;
                                kind: string;
                                tokens: number;
                                globs?: readonly string[] | undefined;
                            };
                        }[];
                        totalTokens: number;
                    };
                };
            }>>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            contexts: readonly {
                type: "MainContext";
                data: {
                    agent: string;
                    isExact: boolean;
                    sessionLoads: readonly {
                        type: "MainContextLoad";
                        data: {
                            id: string;
                            kind: string;
                            tokens: number;
                            globs?: readonly string[] | undefined;
                        };
                    }[];
                    fileLoads: readonly {
                        type: "MainContextLoad";
                        data: {
                            id: string;
                            kind: string;
                            tokens: number;
                            globs?: readonly string[] | undefined;
                        };
                    }[];
                    totalTokens: number;
                };
            }[];
        }) => {
            type: "MainContexts";
            data: {
                contexts: readonly {
                    type: "MainContext";
                    data: {
                        agent: string;
                        isExact: boolean;
                        sessionLoads: readonly {
                            type: "MainContextLoad";
                            data: {
                                id: string;
                                kind: string;
                                tokens: number;
                                globs?: readonly string[] | undefined;
                            };
                        }[];
                        fileLoads: readonly {
                            type: "MainContextLoad";
                            data: {
                                id: string;
                                kind: string;
                                tokens: number;
                                globs?: readonly string[] | undefined;
                            };
                        }[];
                        totalTokens: number;
                    };
                }[];
            };
        };
    };
};
/** Every DTO's type, under its name: what its schema infers. */
declare namespace RuntimeDTOs {
    type EvalCaseReport = z.infer<typeof RuntimeDTOs.EvalCaseReport>;
    type EvalLogAnalysis = z.infer<typeof RuntimeDTOs.EvalLogAnalysis>;
    type EvalRunReport = z.infer<typeof RuntimeDTOs.EvalRunReport>;
    type MainContext = z.infer<typeof RuntimeDTOs.MainContext>;
    type MainContextLoad = z.infer<typeof RuntimeDTOs.MainContextLoad>;
    type MainContexts = z.infer<typeof RuntimeDTOs.MainContexts>;
    type SensorRunOutcome = z.infer<typeof RuntimeDTOs.SensorRunOutcome>;
    type SessionReviewOutcome = z.infer<typeof RuntimeDTOs.SessionReviewOutcome>;
    type SessionSummary = z.infer<typeof RuntimeDTOs.SessionSummary>;
    type ToolAnswer = z.infer<typeof RuntimeDTOs.ToolAnswer>;
}

/**
 * DRIVER PORT — running what the charter built: the sensors of a signal, the
 * calls forwarded to the mcp origins, the evaluations against the real agent
 * and their log, the main context counted exactly, and the agents' sessions
 * kept on this machine (CORE-FR-222). What it needs of the charter it asks
 * charter's applications, in DTOs (CORE-FR-229).
 *
 * Every answer is a DTO, told apart from the others it may be by its `type`;
 * whatever stops an operation is among them, a `FaultDTOs.Fault`, and never
 * thrown (SDK-FR-004, SDK-FR-017, SDK-FR-018).
 */
interface ForRunningCharter {
    /** The sensors of one signal, run as one hook, each to its end whatever the
     *  others do (CORE-FR-176 – CORE-FR-179), for the agent named: the engine
     *  assumes none (CORE-FR-233). */
    runSensors(signal: string, stdin: string, agentProviderName: AgentProviderName): Promise<RuntimeDTOs.SensorRunOutcome | FaultDTOs.Fault>;
    /** One call forwarded to the mcp origin serving it, reached for this call
     *  alone and let go once it has answered (EVAL-FR-031, FR-154). */
    call(name: string, args: Readonly<Record<string, unknown>>): Promise<RuntimeDTOs.ToolAnswer | FaultDTOs.Fault>;
    /** What each agent the repository compiles for is sent of the charter when a
     *  session opens, counted exactly by its own command line (EVAL-FR-004). */
    countMainContext(): Promise<RuntimeDTOs.MainContexts | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;
    /**
     * Select an explicitly requested configured agent, or the sole configured
     * agent. Several agents require a choice from the driver before execution.
     *
     * Every case kept beside the charter as last committed, each handed once to
     * promptfoo, which puts it to the agent, run headless in a worktree of the
     * last commit kept under the log with its charter built, and grades it; and
     * how each came out (EVAL-FR-020). promptfoo is installed first where it is
     * not on the machine yet, saying so (EVAL-FR-032). Every worktree is removed,
     * and the working tree is left as it was (EVAL-FR-021). A charter with an
     * error, an evaluation file that does not read, and a case naming what the
     * charter does not hold are given back as faults, with no case run
     * (EVAL-FR-026).
     */
    evaluate(agent?: string): Promise<RuntimeDTOs.EvalRunReport | FaultDTOs.FaultsByFile | FaultDTOs.Fault>;
    /** What promptfoo logged of an evaluation, the last one where no log is
     *  named, read back. */
    analyze(logFilePath?: string): Promise<RuntimeDTOs.EvalLogAnalysis | FaultDTOs.Fault>;
    /**
     * The sessions kept, summed up by day and by session, in tokens, over the
     * days from `since` to `until`, both counted in and each `YYYY-MM-DD`: the
     * last 31 days where neither is given (EVAL-FR-030). No session kept is an
     * answer rather than a failure.
     */
    sessionSummary(since?: string, until?: string): Promise<RuntimeDTOs.SessionReviewOutcome | FaultDTOs.Fault>;
}

/** What an adapter answering this port raises when git refuses, named again
 *  here so it names this port and nothing behind it. */

/**
 * DRIVEN PORT — worktrees of a repository's last commit, the one thing
 * evaluating asks of version control, apart from what fetching a source asks
 * (CORE-FR-206).
 */
interface ForKeepingWorktrees {
    /**
     * A worktree of this repository's last commit, checked out detached at this
     * path from the repository: its files as committed, and none of the work in hand
     * (EVAL-FR-021). A repository with nothing committed, and a folder under no
     * repository, each raise an `AdapterFault` in git's words.
     */
    addWorktree(worktreePath: string): Promise<void>;
    /** One worktree taken away: its folder, and version control's record of
     *  it. A folder that is no worktree any more, or is not there, is removed
     *  all the same. */
    removeWorktree(worktreePath: string): Promise<void>;
}

/** The logs of a repository's sessions as what keeps them read them: the name
 *  of the folder they were read from, for the review to say (CORE-FR-218),
 *  and each log's text. */
declare class SessionLogs {
    readonly sessionsFolder: string;
    readonly logTexts: readonly string[];
    constructor(sessionsFolder: string, logTexts: readonly string[]);
}

/** Reads the logs `cw-session-tokens-counter` keeps, one per session. */
interface ForLoadingSessionAnalysis {
    /**
     * The text of every session's log under the folder this repository's
     * sessions are kept in, last written from `writtenFromMs` until
     * `writtenUntilMs`, in milliseconds since the epoch (EVAL-FR-009,
     * EVAL-SC-007), with the name of that folder. Which folder that is — the
     * `sessionAnalysisFolder` the repository's settings name, or else one under
     * the developer's home named after the repository — is the adapter's to
     * find, since where the repository and the home are is its alone
     * (CORE-FR-218). Each session keeps one folder of its own, its log directly
     * in it; a folder that is not there holds none.
     */
    loadSessionLogs(sessionAnalysisFolder: string | undefined, writtenFromMs: number, writtenUntilMs: number): Promise<SessionLogs>;
}

/** What an adapter answering this port raises when the command line refuses,
 *  named again here so it names this port and nothing behind it. */

/**
 * DRIVEN PORT — an agent's own command line, run headless: one prompt asked,
 * and the model's answer to it out. One adapter per agent's command line;
 * the composition root hands each under the agent it runs (EVAL-FR-004).
 *
 * The prompt is run in a folder of its own holding nothing, so what the model
 * was sent is the command line's own and the prompt, and nothing of whichever
 * repository asked.
 */
interface ForCheckingAgentCli {
    /** Is the command line installed on this machine? */
    isInstalled(): Promise<boolean>;
}
interface ForRunningAgentCli extends ForCheckingAgentCli {
    /** This prompt asked, and what the model answered: what it said, and the
     *  usage the command line reports of what it was sent. */
    ask(prompt: string): Promise<Answer>;
}
/** One prompt answered, as the command line reports it. */
interface Answer {
    readonly resultText: string;
    readonly usage: PromptUsage;
}
/** The input side of one run's usage, as the command line reports it: tokens
 *  sent fresh, written to the cache, and read from it. */
interface PromptUsage {
    readonly inputTokens: number;
    readonly cacheCreationInputTokens: number;
    readonly cacheReadInputTokens: number;
}

/** What an adapter answering this port raises when promptfoo cannot be
 *  installed or stops with an error, named again here so it names this port and
 *  nothing behind it. */

/**
 * DRIVEN PORT — promptfoo, the evaluation framework a charter is evaluated
 * under (EVAL-FR-020, EVAL-FR-032): installed once onto this machine, then
 * handed one test at a time, which it runs against the selected agent in the folder
 * named and grades by the assertions it carries.
 */
interface ForRunningPromptfoo {
    /** Is promptfoo, and what it needs to run the supported agents, on this machine? */
    isInstalled(): Promise<boolean>;
    /** Install it once into a folder of its own, outside every repository. */
    install(): Promise<void>;
    /** Where it is installed, as the developer would find it. */
    readonly installFolderPath: string;
    /** One test run with `promptfoo eval`: its prompt put to the selected agent,
     *  headless, in the working folder, with the project's settings and skills
     *  and edits accepted, on whatever it is signed in with; and how it came
     *  out. A run promptfoo itself fails raises an `AdapterFault`. */
    evaluate(promptfooTest: PromptfooTest): Promise<PromptfooTestResult>;
    /** Read saved promptfoo artifacts without invoking an agent. With no path,
     * list the latest twenty case logs belonging to this repository. */
    readLogs(logFilePath?: string): Promise<readonly PromptfooLog[]>;
}
/** One promptfoo test, in promptfoo's own words. */
interface PromptfooTest {
    readonly agent: string;
    readonly description: string;
    readonly prompt: string;
    /** The folder the selected agent runs in, by its path from the repository. */
    readonly workingPath: string;
    readonly assertions: readonly PromptfooAssertion[];
}
/** One promptfoo assertion: a skill the agent invoked, a rubric an agent
 *  grader holds what the agent did to, reading the working folder itself, or
 *  a JavaScript check of the response. */
interface PromptfooAssertion {
    readonly type: "skill-used" | "agent-rubric" | "javascript" | "file-read";
    readonly value: string;
}
/** How one test came out, as promptfoo writes it: whether it passed, the
 *  tokens the provider reported in all, each assertion's grading, and the
 *  error where the provider could not run. */
interface PromptfooTestResult {
    readonly success: boolean;
    readonly totalTokens: number;
    readonly componentResults: readonly {
        readonly assertionType: string;
        readonly pass: boolean;
        readonly reason: string;
    }[];
    readonly error?: string;
    readonly logPath?: string;
    readonly sessionId?: string;
    readonly sessionPath?: string;
}
/** A saved case and its diagnostics, read without an inference call. */
interface PromptfooLog {
    readonly logPath: string;
    readonly createdAt: string;
    readonly agent: string;
    readonly prompt: string;
    readonly workingFolderPath: string;
    readonly outputPath: string;
    readonly stdoutPath: string;
    readonly stderrPath: string;
    readonly success: boolean;
    readonly totalTokens: number;
    readonly unmetReasons: readonly string[];
    readonly answer: string;
    readonly toolCalls: readonly string[];
    readonly sessionId?: string;
    readonly sessionPath?: string;
    readonly error?: string;
}

/**
 * DRIVEN PORT — the shell of this machine: one command line run in a folder,
 * handed text on its standard input, and what it exited with and wrote.
 *
 * A command that fails is answered as its exit code and what it wrote, never
 * raised: whether that is wrong is the caller's to say.
 */
interface ForRunningShellCommands {
    /** Run `command` in the folder at `workingPath` from the repository through the shell, `stdin` written to it,
     *  and answer once it has exited. */
    runShellCommand(command: string, workingPath: string, stdin: string): Promise<ShellCommandResult>;
}
/** What one command line came to. */
interface ShellCommandResult {
    readonly exitCode: number;
    readonly stdout: string;
    readonly stderr: string;
}

/**
 * What every agent's own command line is to the engine: one it can ask
 * whether it is installed. An agent that runs evaluations headless answers
 * prompts as well (`ForRunningAgentCli`); what it runs and how is the agent's
 * own.
 */
declare abstract class AgentCli implements ForCheckingAgentCli {
    abstract isInstalled(): Promise<boolean>;
}

/**
 * DRIVEN ADAPTER: Claude Code's own command line, `claude -p`, run headless.
 *
 * Each prompt is run in an empty folder of its own, with nothing loaded, so
 * the model is sent Claude Code's own instructions and the prompt, and the
 * same instructions on every run. A count is read off the JSON it prints, of
 * the first message sent: a model answering at length can run on into a
 * second, whose input the total adds again. It runs on whatever `claude` is
 * signed in with: no key of this engine's (EVAL-FR-004). At most
 * `PARALLEL_RUNNER_COUNT` run together.
 */
declare class ClaudeCli extends AgentCli implements ForRunningAgentCli {
    #private;
    isInstalled(): Promise<boolean>;
    ask(prompt: string): Promise<Answer>;
}

/** Check the Codex CLI used by promptfoo without asking a model. */
declare class CodexCli extends AgentCli {
    isInstalled(): Promise<boolean>;
}

/** Reads the session logs kept as files, a folder per session. */
declare class FileSessionAnalysisRepository implements ForLoadingSessionAnalysis {
    #private;
    constructor(
    /** What reads files under a folder, set up here on the root of the home's
     *  address, so a folder the settings name anywhere under it is reached and
     *  no reader set up anywhere else is handed in. */
    fileReaderAt: (rootFolder: URL) => ForReadingFiles, 
    /** The repository whose sessions are read, which names the folder they are
     *  kept in where its settings name none. */
    repoFolder: URL, 
    /** The developer's home folder, which the sessions are kept under unless
     *  the repository names a folder of its own. Each refused here unless it
     *  names a folder (SDK-FR-010). */
    homeFolder: URL);
    loadSessionLogs(sessionAnalysisFolder: string | undefined, writtenFromMs: number, writtenUntilMs: number): Promise<SessionLogs>;
}

/** DRIVEN ADAPTER: git worktrees, as the command everyone already has. */
declare class GitWorktrees implements ForKeepingWorktrees {
    #private;
    constructor(
    /** The repository this works in, every path it is handed from its root:
     *  refused here unless it names a folder (SDK-FR-010). */
    repoFolder: URL);
    /** `git worktree add --detach` at `HEAD`, forced over a record of one
     *  left at that folder by a run stopped halfway. */
    addWorktree(worktreePath: string): Promise<void>;
    /** `git worktree remove --force`, then the folder removed whatever git
     *  said, and `git worktree prune` for a record whose folder is gone, which a
     *  folder under no repository has none of. */
    removeWorktree(worktreePath: string): Promise<void>;
}

declare class Promptfoo implements ForRunningPromptfoo {
    #private;
    private readonly agentSessionFolders;
    /** `repoFolder`: the repository every working path is from, and
     *  `cherryWorksFolder`: this engine's own folder on the machine, each
     *  refused unless it names a folder (SDK-FR-010), and turned into a path
     *  only when promptfoo is reached (SDK-FR-011). */
    constructor(repoFolder: URL, cherryWorksFolder: URL, agentSessionFolders?: readonly string[]);
    get installFolderPath(): string;
    isInstalled(): Promise<boolean>;
    install(): Promise<void>;
    evaluate({ agent, description, prompt, workingPath, assertions }: PromptfooTest): Promise<PromptfooTestResult>;
    /** Resolve only existing local session files, never manufacture a path from an id. */
    private findSessionLog;
    readLogs(logFilePath?: string): Promise<readonly PromptfooLog[]>;
}

/** DRIVEN ADAPTER: the system shell, as a host runs a hook's command. */
declare class Shell implements ForRunningShellCommands {
    #private;
    constructor(
    /** The repository this works in, every path it is handed from its root:
     *  refused here unless it names a folder (SDK-FR-010). */
    repoFolder: URL);
    runShellCommand(command: string, workingPath: string, stdin: string): Promise<ShellCommandResult>;
}

/** Every schema of this module's DTOs, under its name — the name it carries
 *  as `type` — in alphabetical order. */
declare const WorkspaceDTOs: {
    WorkspaceSettings: z.ZodObject<{
        type: z.ZodLiteral<"WorkspaceSettings">;
        data: z.ZodObject<{
            isSetUp: z.ZodBoolean;
            agents: z.ZodReadonly<z.ZodArray<z.ZodString>>;
            mainContextCeiling: z.ZodNumber;
            sessionAnalysisFolder: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip> & {
        of: (dataValue: {
            isSetUp: boolean;
            agents: readonly string[];
            mainContextCeiling: number;
            sessionAnalysisFolder?: string | undefined;
        }) => {
            type: "WorkspaceSettings";
            data: {
                isSetUp: boolean;
                agents: readonly string[];
                mainContextCeiling: number;
                sessionAnalysisFolder?: string | undefined;
            };
        };
    };
};
/** Every DTO's type, under its name: what its schema infers. */
declare namespace WorkspaceDTOs {
    type WorkspaceSettings = z.infer<typeof WorkspaceDTOs.WorkspaceSettings>;
}

/**
 * DRIVER PORT — managing the workspace: what a repository configured itself
 * with, kept in its settings, and setting it up (CORE-FR-231). Whoever
 * composes the engine reads them here and hands them to the applications that
 * run by them; neither the charter nor runtime reads them.
 *
 * Every answer is a DTO, told apart from the others it may be by its `type`;
 * whatever stops an operation is among them, a `FaultDTOs.Fault`, and never
 * thrown (SDK-FR-004, SDK-FR-017, SDK-FR-018). Settings that do not read are
 * a `SettingsFault`, saying what to correct (FR-037).
 */
interface ForManagingWorkspace {
    /** The agents a repository may name in its settings: the ones the engine
     *  was composed to compile for (CORE-FR-221). */
    readonly agentProviderNames: readonly string[];
    /** The settings the repository keeps; none is a repository never set up,
     *  which compiles for no agent (FR-019). */
    settings(): Promise<WorkspaceDTOs.WorkspaceSettings | FaultDTOs.Fault>;
    /**
     * The repository set up for these agents (FR-032 – FR-038): its settings
     * kept, the ceiling kept where one was set now or before and written only
     * where it is not the 20,000 none means, and version control told to ignore
     * the log, once, every other line of its ignore file kept (CORE-FR-225), and a
     * README written where it has none, naming the `cw` that set it up.
     * No agent, an agent this engine compiles for none of, and a ceiling that
     * is no whole number above 0 are refused, nothing kept (FR-033).
     */
    setUp(agents: readonly string[], cwVersion: string, mainContextCeiling?: number): Promise<WorkspaceDTOs.WorkspaceSettings | FaultDTOs.Fault>;
}

/** The README a repository's workspace is set up with: what the folder is,
 *  the `cw` that set it up, and how to start authoring the charter in it.
 *  Written once, at setup, and the repository's to change after. */
declare class WorkspaceReadme {
    /** The version of `cw` that set the charter up. */
    readonly cwVersion: string;
    static readonly path = ".cw/README.md";
    constructor(
    /** The version of `cw` that set the charter up. */
    cwVersion: string);
    get text(): string;
}

/**
 * What a repository configured itself with — which agents it compiles its
 * charter for, the ceiling of a main context, where its sessions are kept on
 * this machine (FR-033, EVAL-FR-006, EVAL-FR-012). Kept by the workspace
 * module alone, and handed to the applications that run by it (CORE-FR-231).
 */
declare class WorkspaceSettings {
    readonly agents: readonly string[];
    readonly mainContextCeiling?: number | undefined;
    readonly sessionAnalysisFolder?: string | undefined;
    /** The tokens of main context past which the health check warns where the
     *  repository set none (EVAL-FR-006). */
    static readonly defaultMainContextCeiling = 20000;
    /** How the settings are written: which agents is checked against the ones
     *  the engine compiles for by the factory, which is told them. */
    static readonly schema: z.ZodObject<{
        agents: z.ZodArray<z.ZodString>;
        mainContextCeiling: z.ZodOptional<z.ZodNumber>;
        sessionContextMark: z.ZodOptional<z.ZodNumber>;
        sessionAnalysisFolder: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    constructor(agents: readonly string[], mainContextCeiling?: number | undefined, sessionAnalysisFolder?: string | undefined);
    /** The ceiling the health check holds a main context to. */
    get mainContextCeilingOrDefault(): number;
}

/** Where a repository keeps what it configured itself with, from its root
 *  (CORE-FR-231), and the ignore file of the workspace beside it, with the
 *  line of it that keeps the log out of version control (CORE-FR-225). */
declare class SettingsFile {
    static readonly path = ".cw/settings.json";
    static readonly gitignorePath = ".cw/.gitignore";
    static readonly logLine = "log/";
}

/**
 * DRIVEN PORT — where a repository keeps its settings and the ignore file of
 * its workspace (CORE-FR-231, CORE-FR-225).
 */
interface ForStoringWorkspaceSettings {
    /** The text the settings are kept in, or nothing where the repository was
     *  never set up. */
    loadSettingsText(): Promise<string | undefined>;
    /** These settings kept, the ceiling only where it is not the default. */
    saveSettings(workspaceSettings: WorkspaceSettings): Promise<void>;
    /** Version control told to ignore the log, once, every other line of the
     *  workspace's ignore file kept. */
    keepLogIgnored(): Promise<void>;
    /** The workspace's README written, where it has none: one already there is
     *  the repository's own. */
    keepReadme(workspaceReadme: WorkspaceReadme): Promise<void>;
}

/** The settings kept as JSON in `.cw/settings.json`, and the workspace's
 *  ignore file beside them, both read and written as files of the repository. */
declare class FileWorkspaceSettingsRepository implements ForStoringWorkspaceSettings {
    #private;
    constructor(fileReader: ForReadingFiles, fileWriter: ForWritingFiles);
    loadSettingsText(): Promise<string | undefined>;
    saveSettings({ agents, mainContextCeiling }: WorkspaceSettings): Promise<void>;
    keepLogIgnored(): Promise<void>;
    keepReadme(workspaceReadme: WorkspaceReadme): Promise<void>;
}

/**
 * Every adapter the engine reaches the outside through, each the engine's own
 * or one a tool writes: each agent's projection and command line, under the
 * agent it is for, the store that keeps the charter, the source fetcher that
 * store reaches vendors through, the sessions, the settings, the local output,
 * and the rest (CORE-FR-230, SDK-FR-020).
 */
interface EngineAdapters {
    readonly agentProvider: {
        readonly [provider: string]: {
            /** What the agent reads of a charter, and where (CORE-FR-221). */
            readonly projection: ForManagingLocalAgentOutput;
            /** The agent's own command line (EVAL-FR-004). */
            readonly cli: ForCheckingAgentCli;
        };
    };
    /** The charter — its primitives, its vendors, its test and eval cases —
     *  kept by one store (CORE-FR-228). */
    readonly charterRepository: ForManagingCharter;
    /** Where a vendor's source is fetched from, by the charter's store kept as
     *  files (CORE-FR-205). */
    readonly sourceFetcher: ForFetchingCharterSources;
    /** Where a repository's sessions are read from (EVAL-FR-009). */
    readonly sessionAnalysisRepository: ForLoadingSessionAnalysis;
    /** Where a repository keeps its settings (CORE-FR-231). */
    readonly workspaceSettingsRepository: ForStoringWorkspaceSettings;
    /** What lays a build's output onto the repository (CORE-FR-221). */
    readonly localOutput: ForManagingLocalOutput;
    readonly fileReader: ForReadingFiles;
    readonly fileWriter: ForWritingFiles;
    readonly worktrees: ForKeepingWorktrees;
    readonly authorizing: ForAuthorizingMcpOrigins;
    readonly mcpServers: ForCallingMcpServers;
    readonly tokenCounter: ForCountingTokens;
    readonly clock: ForTellingTime;
    readonly shell: ForRunningShellCommands;
    /** What the developer is told, internal faults among it (SDK-FR-017). */
    readonly progressReporter: ForReportingProgress;
    readonly promptfooRunner: ForRunningPromptfoo;
    readonly credentialsRepository: ForStoringCredentials;
}
/** The engine's two modules' applications, as the drivers reach them
 *  (CORE-FR-222): the charter's two, and runtime's. */
interface ComposedEngine {
    readonly charterAuthoringApp: ForAuthoringCharter;
    readonly charterBuildingApp: ForBuildingCharter;
    readonly charterRuntimeApp: ForRunningCharter;
}
/** The workspace module, which keeps a repository's settings, and the engine
 *  composed for the settings it holds when one of the engine's applications is
 *  first called. */
interface ComposedApplications {
    readonly workspaceApp: ForManagingWorkspace;
    readonly engineApp: ComposedEngine;
}
/**
 * The workspace module and the engine over the adapters handed, each one not
 * handed being the engine's own — Claude's and Codex's, the charter kept as
 * files, and every adapter over the repository's address and the developer's
 * home's (CORE-FR-217, CORE-FR-218, CORE-FR-230). The charter's store and the
 * agents' projections are set up over the file adapters handed, so files kept
 * anywhere keep the charter there too, unless a store of the tool's own is
 * handed (SDK-FR-020). The workspace first, then the engine for the settings
 * it reads, a repository being set up for exactly the agents a projection is
 * handed for (CORE-FR-221, CORE-FR-231). Settings that do not read yet, as
 * before setup, compose an engine for no agent. They are read when one of the
 * engine's applications is first called, so composing reaches no disk, at an
 * address of any scheme (SDK-FR-011).
 */
declare function composeApplications(repoFolder: URL, homeFolder: URL, engineAdapters?: Partial<EngineAdapters>): Promise<ComposedApplications>;

/**
 * What `cherry-works` lets a tool import, and nothing more (SDK-FR-002,
 * SDK-FR-005, SDK-FR-020): how to compose the engine and the applications it
 * answers through, with the DTOs they answer; the ports of every adapter a
 * tool may hand in place of the engine's own, with the values they cross; and
 * the engine's own adapters, for a tool to extend.
 */

declare const VERSION: string;

export { AdapterFault, AgentCli, AgentPrimitive, AgentProjection, AgentProvider, type Answer, BasePrimitive, BuiltSensors, Catalogue, CharterDTOs, CharterFolder, CharterMd, CharterOutput, CharterRoot, ClaudeCli, ClaudeProjection, CodexCli, CodexProjection, type CompiledPart, CompiledPrimitive, type ComposedApplications, type ComposedEngine, ConsoleReporter, CopyPlan, DocumentBasedComponent, type EngineAdapters, EvalFolder, FaultDTOs, FileCharterRepository, FileOutput, FileReaders, FileSessionAnalysisRepository, FileWorkspaceSettingsRepository, type ForAuthoringCharter, type ForAuthorizingMcpOrigins, type ForBuildingCharter, type ForCallingMcpServers, type ForCheckingAgentCli, type ForCountingTokens, type ForFetchingCharterSources, type ForKeepingWorktrees, type ForLoadingSessionAnalysis, type ForManagingCharter, type ForManagingLocalAgentOutput, type ForManagingLocalOutput, type ForManagingWorkspace, type ForReadingFiles, type ForReportingProgress, type ForRunningAgentCli, type ForRunningCharter, type ForRunningPromptfoo, type ForRunningShellCommands, type ForStoringCredentials, type ForStoringWorkspaceSettings, type ForTellingTime, type ForWritingFiles, GitSources, GitWorktrees, GuidePrimitive, KeychainCredentialsRepository, type ListedFile, LocalRepoManipulator, type MainContextText, McpClientRegistration, McpClients, McpCredential, McpOrigins, McpPrimitive, type McpServerAddress, type McpServerConnection, ModelHelper, OAuth, type OAuthGrant, OutputPart, PlaybookPrimitive, PosturePrimitive, type Primitive, PrimitiveLayer, Primitives, PrimitivesFolder, ProjectionPlan, type PromptUsage, Promptfoo, type PromptfooAssertion, type PromptfooLog, type PromptfooTest, type PromptfooTestResult, ProviderComponent, RawEvalSuite, RawPrimitive, RawSourceSkill, RawTestSuite, RawVendorSource, type ReadFile, RuntimeDTOs, SensorPrimitive, SessionLogs, SettingBasedComponent, SettingsFile, Shell, type ShellCommandResult, SkillPrimitive, SourceCharter, SourceSkill, StampedDocument, SystemClock, TestFolder, TestSuite, Tiktoken, type ToolAnswer, UnauthorizedMcpFault, type UpstreamTool, VERSION, VendorRoot, VendorRootFactory, VendorSource, VendorSourceOrigin, VendorsFolder, WorkspaceDTOs, WorkspaceReadme, WorkspaceSettings, WritePlan, composeApplications, mergedTomlText };
