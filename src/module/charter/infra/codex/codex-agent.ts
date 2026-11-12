import { ProviderComponent } from "../../app/port/out/managing-local-agent-output.port.js";

/** TOML basic strings use the same escapes as JSON for these string values. */
export class CodexAgent extends ProviderComponent {
  readonly kind = "agent";
}
