/**
 * The runtime module's constants: the layout of the log, one value, and
 * nothing of where the repository is (CORE-FR-215, CORE-FR-217).
 */

import { LogPath } from "./models/log/log-path.js";

/** The log's layout, made once: every folder of it is asked of this
 *  (CORE-FR-225, EVAL-FR-021). */
export const logPath = new LogPath();
