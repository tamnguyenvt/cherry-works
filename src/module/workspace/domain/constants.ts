/**
 * The workspace module's constants: the layout of the store `cw` keeps a
 * repository's settings in, one value (CORE-FR-215, CORE-FR-231).
 */

import { SettingsPath } from "./models/settings/settings-path.js";

/** The settings store's layout, made once: every file of it is asked of this
 *  (CORE-FR-225, CORE-FR-231). */
export const settingsPath = new SettingsPath();
