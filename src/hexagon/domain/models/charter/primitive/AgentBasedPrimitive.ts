import { z } from "zod";
import { AGENT_PROVIDERS, type AgentProvider } from "../../AgentProvider.js";
import { BasePrimitive } from "./BasePrimitive.js";

export type AgentBasedHeaders = Readonly<z.infer<ReturnType<typeof AgentBasedPrimitive.headersSchema>>>;

/** Shared provider selection for posture and sensor primitives. */
export abstract class AgentBasedPrimitive<Headers extends AgentBasedHeaders = AgentBasedHeaders> extends BasePrimitive<Headers> {
  static override headersSchema() {
    return super.headersSchema().extend({
      "agent-provider": z.array(z.enum(AGENT_PROVIDERS)).readonly().optional(),
    });
  }

  static override readonly schema = this.headersSchema();

  override supportsAgent(agent: AgentProvider): boolean {
    const agentProviders = this.headers["agent-provider"];
    return !agentProviders?.length || agentProviders.includes(agent);
  }
}
