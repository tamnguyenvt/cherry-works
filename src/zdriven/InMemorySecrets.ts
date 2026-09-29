import type { ForKeepingSecrets } from "#hexagon/port/zdriven/ForKeepingSecrets.js";

/** Secrets held in memory: a test looks into `secrets` to see what was kept,
 *  and nothing reaches the machine's credential store. The second
 *  implementation that earns `ForKeepingSecrets` its place (plan §2.4). */
export class InMemorySecrets implements ForKeepingSecrets {
  readonly secrets = new Map<string, string>();

  async readSecret(key: string): Promise<string | undefined> {
    return this.secrets.get(key);
  }

  async writeSecret(key: string, secret: string): Promise<void> {
    this.secrets.set(key, secret);
  }

  async removeSecret(key: string): Promise<void> {
    this.secrets.delete(key);
  }
}
