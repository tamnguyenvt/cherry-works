/**
 * The charter module's constants: each folder of the workspace by its path
 * from the repository's root, and nothing of where the repository is
 * (CORE-FR-217).
 */

import { OutputPath } from "./models/charter-output/output-path.js";

/**
 * Where a repository keeps everything this engine reads and writes (plan §3).
 *
 * One directory holds all three: what the repository configured itself with,
 * the charter it authored, and what the charter compiles to. Named here and
 * nowhere else, so the directory the settings are read from, the one a charter
 * is loaded from and the one a build owns are the same string rather than three
 * that drift.
 */
export const WORKSPACE_FOLDER_PATH = ".cw";

/** The charter itself, the only part of the workspace a person authors: its
 *  primitives, its tests, its eval cases and its vendors, each in a folder of
 *  its own under it (CORE-FR-224). */
export const CHARTER_FOLDER_PATH = `${WORKSPACE_FOLDER_PATH}/charter`;

/** The repository's own primitives, a folder per kind, under the charter
 *  (CORE-FR-224). */
export const PRIMITIVES_FOLDER_PATH = `${CHARTER_FOLDER_PATH}/primitive`;

/** The situations this repository pins its charter down with, one file of cases
 *  each (FR-047), under the charter (CORE-FR-224). Apart from the primitives: a
 *  test is not a primitive, nothing compiles it and no agent is instructed by
 *  it, so it is read only when tests run. */
export const TEST_FOLDER_PATH = `${CHARTER_FOLDER_PATH}/test`;

/** The cases this repository evaluates its charter by against the real agent,
 *  one file of cases each (EVAL-FR-020), under the charter (CORE-FR-224).
 *  Beside the tests rather than inside them: a test is resolved offline, and
 *  an evaluation spends a key. */
export const EVAL_FOLDER_PATH = `${CHARTER_FOLDER_PATH}/eval`;

/** What this repository installed from someone else, one folder per vendor,
 *  `<owner>/<repository>` (FR-023, FR-024, FR-050), under the charter
 *  (CORE-FR-224). Apart from the primitives: what a vendor published is
 *  read-only, and what this repository authored is not. */
export const VENDORS_FOLDER_PATH = `${CHARTER_FOLDER_PATH}/vendor`;

/** The output's layout, made once: every path into a build's output, and
 *  every link from one of its items to another, is asked of it (CORE-FR-220,
 *  CORE-FR-221). */
export const outputPath = new OutputPath();
