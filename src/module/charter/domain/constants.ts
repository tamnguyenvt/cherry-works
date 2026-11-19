/**
 * The charter module's constants: the layout of the store `cw` keeps the
 * charter root in, which a source keeps its charters in too, and of the output, each
 * one value, and nothing of
 * where the repository is (CORE-FR-215, CORE-FR-217).
 */

import { CharterPath } from "./models/charter/charter-path.js";
import { OutputPath } from "./models/charter-output/output-path.js";

/** The layout of the store `cw` keeps the charter in, made once: every folder
 *  of it is asked of this (CORE-FR-224, SDK-FR-020). */
export const charterPath = new CharterPath();

/** The output's layout, made once: every path into the compiled output, and
 *  every link from one of its items to another, is asked of it (CORE-FR-220,
 *  CORE-FR-221). */
export const outputPath = new OutputPath();
