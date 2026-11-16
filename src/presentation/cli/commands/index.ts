import { AddCommand } from "./add.command.js";
import { BuildCommand } from "./build.command.js";
import type { AnyCommand } from "./command.interface.js";
import { ContextCommand } from "./context.command.js";
import { DoctorCommand } from "./doctor.command.js";
import { EditCommand } from "./edit.command.js";
import { EvalCommand } from "./eval.command.js";
import { EvalAnalyzeCommand } from "./eval-analyze.command.js";
import { ExplainCommand } from "./explain.command.js";
import { InitCommand } from "./init.command.js";
import { KindsCommand } from "./kinds.command.js";
import { ListCommand } from "./list.command.js";
import { McpAuthCommand } from "./mcp-auth.command.js";
import { RemoveCommand } from "./remove.command.js";
import { RunMcpCommand } from "./run-mcp.command.js";
import { RunPortalCommand } from "./run-portal.command.js";
import { RunSensorCommand } from "./run-sensor.command.js";
import { SessionsCommand } from "./sessions.command.js";
import { SuiteAddCommand } from "./suite-add.command.js";
import { SuiteEditCommand } from "./suite-edit.command.js";
import { SuiteRemoveCommand } from "./suite-remove.command.js";
import { TestCommand } from "./test.command.js";
import { VendorAddCommand } from "./vendor-add.command.js";
import { VendorInitCommand } from "./vendor-init.command.js";
import { VendorInjectCommand } from "./vendor-inject.command.js";
import { VendorListCommand } from "./vendor-list.command.js";
import { VendorRemoveCommand } from "./vendor-remove.command.js";

/** The command surface: what the command line offers, declared and nothing
 *  more. Each command is added here as it is built, and is given what it needs
 *  when it runs. */
export const COMMANDS: readonly AnyCommand[] = [
  new InitCommand(),
  new BuildCommand(),
  new ListCommand(),
  new KindsCommand(),
  new AddCommand(),
  new EditCommand(),
  new RemoveCommand(),
  new ExplainCommand(),
  new DoctorCommand(),
  new ContextCommand(),
  new SessionsCommand(),
  new TestCommand(),
  new EvalCommand(),
  new EvalAnalyzeCommand(),
  new SuiteAddCommand(),
  new SuiteEditCommand(),
  new SuiteRemoveCommand(),
  new VendorInitCommand(),
  new VendorAddCommand(),
  new VendorInjectCommand(),
  new VendorRemoveCommand(),
  new VendorListCommand(),
  new McpAuthCommand(),
  new RunMcpCommand(),
  new RunSensorCommand(),
  new RunPortalCommand(),
];
