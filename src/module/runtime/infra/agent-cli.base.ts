import type { ForCheckingAgentCli } from "../app/port/out/running-agent-cli.port.js";

/**
 * What every agent's own command line is to the engine: one it can ask
 * whether it is installed. An agent that runs evaluations headless answers
 * prompts as well (`ForRunningAgentCli`); what it runs and how is the agent's
 * own.
 */
export abstract class AgentCli implements ForCheckingAgentCli {
  abstract isInstalled(): Promise<boolean>;
}
