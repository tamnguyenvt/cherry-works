import { spawn } from "node:child_process";
import { DrivenFault, type ForKeepingSecrets } from "#hexagon/port/zdriven/ForKeepingSecrets.js";

/** Every secret `cw` keeps is under this service, one account per key
 *  (data-model §17.3). */
const SERVICE = "cherry-works";

/** `security` exits with this when the keychain has no such item. */
const MACOS_NOT_FOUND = 44;

type CommandOutput = { code: number; stdout: string; stderr: string };

/** A command run with this text on its standard input, never in its
 *  arguments: what a process listing shows is the arguments. A command that is
 *  not there is a failure like any other, said in `stderr`. */
function commandOutput(command: string, args: readonly string[], stdin = ""): Promise<CommandOutput> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (raised) => resolve({ code: -1, stdout, stderr: `${raised.message}` }));
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
    child.stdin.on("error", () => {});
    child.stdin.end(stdin);
  });
}

/**
 * DRIVEN ADAPTER: the operating system's own credential store, reached by the
 * command each system ships — `security` on macOS, `secret-tool` on Linux
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
export class OsSecrets implements ForKeepingSecrets {
  /** Which system's store to use: this process's, unless a test names
   *  another. */
  constructor(private readonly platform: NodeJS.Platform = process.platform) {}

  async readSecret(key: string): Promise<string | undefined> {
    this.refuseUnsupportedPlatform();
    const commandOutputOfRead =
      this.platform === "darwin"
        ? await commandOutput("security", ["find-generic-password", "-s", SERVICE, "-a", key, "-w"])
        : await commandOutput("secret-tool", ["lookup", "service", SERVICE, "account", key]);
    if (commandOutputOfRead.code === 0) return commandOutputOfRead.stdout.replace(/\n$/, "");
    const nothingThere =
      this.platform === "darwin" ? commandOutputOfRead.code === MACOS_NOT_FOUND : commandOutputOfRead.stderr.trim() === "";
    if (nothingThere) return undefined;
    this.throwFault("read", key, commandOutputOfRead.stderr);
  }

  async writeSecret(key: string, secret: string): Promise<void> {
    this.refuseUnsupportedPlatform();
    // `security -i` reads the key between double quotes, which it cannot
    // escape out of. An address never holds one.
    if (this.platform === "darwin" && /["\\\n]/.test(key)) {
      throw new DrivenFault(`The key "${key}" cannot be kept in the keychain.`, "Name the place by an address without quotes, backslashes or line breaks.");
    }
    const commandOutputOfWrite =
      this.platform === "darwin"
        ? await commandOutput(
            "security",
            ["-i"],
            `add-generic-password -U -s ${SERVICE} -a "${key}" -X ${Buffer.from(secret).toString("hex")}\n`,
          )
        : await commandOutput(
            "secret-tool",
            ["store", `--label=${SERVICE} ${key}`, "service", SERVICE, "account", key],
            secret,
          );
    if (commandOutputOfWrite.code !== 0) this.throwFault("write", key);
  }

  async removeSecret(key: string): Promise<void> {
    this.refuseUnsupportedPlatform();
    const commandOutputOfRemove =
      this.platform === "darwin"
        ? await commandOutput("security", ["delete-generic-password", "-s", SERVICE, "-a", key])
        : await commandOutput("secret-tool", ["clear", "service", SERVICE, "account", key]);
    if (commandOutputOfRemove.code === 0) return;
    const nothingThere =
      this.platform === "darwin" ? commandOutputOfRemove.code === MACOS_NOT_FOUND : commandOutputOfRemove.stderr.trim() === "";
    if (!nothingThere) this.throwFault("remove", key, commandOutputOfRemove.stderr);
  }

  /** macOS and Linux have a store this knows; anything else is refused
   *  before a command runs. */
  private refuseUnsupportedPlatform(): void {
    if (this.platform !== "darwin" && this.platform !== "linux") {
      throw new DrivenFault(
        `Keeping a secret is not supported on "${this.platform}".`,
        "Sign in from macOS or Linux, whose credential stores cw uses.",
      );
    }
  }

  private throwFault(operation: "read" | "write" | "remove", key: string, stderr = ""): never {
    const storeName = this.platform === "darwin" ? "The keychain" : "The secret service";
    throw new DrivenFault(
      `${storeName} refused to ${operation} the secret for "${key}".${stderr.trim() === "" ? "" : ` It said: ${stderr.trim()}`}`,
      this.platform === "darwin"
        ? "Check that the login keychain is unlocked."
        : "Check that secret-tool is installed and a secret service is running.",
    );
  }
}
