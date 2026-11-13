import { spawn } from "node:child_process";
import {
  type ForStoringCredentials,
  type McpCredential,
  RefusedSecretStoreFault,
  UnkeepableSecretKeyFault,
  UnsupportedPlatformFault,
} from "../app/port/out/storing-credentials.port.js";
import { parseCredentialSecret } from "./helper.js";

/** Every secret `cw` keeps is under this service, one account per key
 *  (data-model §17.3). */
const SERVICE = "cherry-works";

/** `security` exits with this when the keychain has no such item. */
const MACOS_NOT_FOUND = 44;

type CommandOutput = { exitCode: number; stdout: string; stderr: string };

/** A command run with this text on its standard input, never in its
 *  arguments: what a process listing shows is the arguments. A command that is
 *  not there is a failure like any other, said in `stderr`. */
function runSecretCommand(command: string, commandArguments: readonly string[], stdin = ""): Promise<CommandOutput> {
  return new Promise((resolve) => {
    const child = spawn(command, commandArguments, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (spawnError) => resolve({ exitCode: -1, stdout, stderr: `${spawnError.message}` }));
    child.on("close", (exitCode) => resolve({ exitCode: exitCode ?? -1, stdout, stderr }));
    child.stdin.on("error", () => {});
    child.stdin.end(stdin);
  });
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
export class KeychainCredentialsRepository implements ForStoringCredentials {
  /** Which system's store to use: this process's, unless a test names
   *  another. Named as `process.platform` names it, and typed as a plain
   *  string so a tool importing it type-checks without Node's own types. */
  constructor(private readonly platform: string = process.platform) {}

  async readCredential(address: string): Promise<McpCredential | undefined> {
    this.refuseUnsupportedPlatform();
    const commandOutputOfRead =
      this.platform === "darwin"
        ? await runSecretCommand("security", ["find-generic-password", "-s", SERVICE, "-a", address, "-w"])
        : await runSecretCommand("secret-tool", ["lookup", "service", SERVICE, "account", address]);
    if (commandOutputOfRead.exitCode === 0) return parseCredentialSecret(commandOutputOfRead.stdout.replace(/\n$/, ""));
    const isNothingThere =
      this.platform === "darwin"
        ? commandOutputOfRead.exitCode === MACOS_NOT_FOUND
        : commandOutputOfRead.stderr.trim() === "";
    if (isNothingThere) return undefined;
    this.throwFault("read", address, commandOutputOfRead.stderr);
  }

  async writeCredential(credential: McpCredential): Promise<void> {
    const secret = JSON.stringify(credential);
    this.refuseUnsupportedPlatform();
    // `security -i` reads the key between double quotes, which it cannot
    // escape out of. An address never holds one.
    if (this.platform === "darwin" && /["\\\n]/.test(credential.address)) {
      throw new UnkeepableSecretKeyFault(
        `The key "${credential.address}" cannot be kept in the keychain.`,
        "Name the mcp origin by an address without quotes, backslashes or line breaks.",
        { internal: false },
      );
    }
    const commandOutputOfWrite =
      this.platform === "darwin"
        ? await runSecretCommand(
            "security",
            ["-i"],
            `add-generic-password -U -s ${SERVICE} -a "${credential.address}" -X ${Buffer.from(secret).toString("hex")}\n`,
          )
        : await runSecretCommand(
            "secret-tool",
            ["store", `--label=${SERVICE} ${credential.address}`, "service", SERVICE, "account", credential.address],
            secret,
          );
    if (commandOutputOfWrite.exitCode !== 0) this.throwFault("write", credential.address);
  }

  /** macOS and Linux have a store this knows; anything else is refused
   *  before a command runs. */
  private refuseUnsupportedPlatform(): void {
    if (this.platform !== "darwin" && this.platform !== "linux") {
      throw new UnsupportedPlatformFault(
        `Keeping a secret is not supported on "${this.platform}".`,
        "Sign in from macOS or Linux, whose credential stores cw uses.",
        { internal: false },
      );
    }
  }

  private throwFault(operation: "read" | "write" | "remove", secretKey: string, stderr = ""): never {
    const storeName = this.platform === "darwin" ? "The keychain" : "The secret service";
    const storeStderr = stderr.trim();
    throw new RefusedSecretStoreFault(
      `${storeName} refused to ${operation} the secret for "${secretKey}".`,
      this.platform === "darwin"
        ? "Check that the login keychain is unlocked."
        : "Check that secret-tool is installed and a secret service is running.",
      { internal: false, ...(storeStderr === "" ? {} : { cause: storeStderr }) },
    );
  }
}
