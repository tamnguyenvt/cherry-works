import { AddCommand } from "./AddCommand.js";
import { BuildCommand } from "./BuildCommand.js";
import { DoctorCommand } from "./DoctorCommand.js";
import { EditCommand } from "./EditCommand.js";
import { ExplainCommand } from "./ExplainCommand.js";
import { InitCommand } from "./InitCommand.js";
import { KindsCommand } from "./KindsCommand.js";
import { ListCommand } from "./ListCommand.js";
import { PortalCommand } from "./PortalCommand.js";
import { RemoveCommand } from "./RemoveCommand.js";
import { TestCommand } from "./TestCommand.js";
import { VendorAddCommand } from "./VendorAddCommand.js";
import { VendorRemoveCommand } from "./VendorRemoveCommand.js";
import type { AnyCommand } from "./Command.js";

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
  new TestCommand(),
  new VendorAddCommand(),
  new VendorRemoveCommand(),
  new PortalCommand(),
];
