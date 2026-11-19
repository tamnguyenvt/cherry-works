/** `charter-release-action.script.mjs` as the engine takes it: its text, to be put down as the
 *  script's asset `charter-release-action.mjs`, never run here. A build reads it as text (tsup's `loader`),
 *  and so does `pnpm test` and `pnpm cw` (scripts/module-loader.mjs). */
declare const charterReleaseActionMjs: string;
export default charterReleaseActionMjs;
