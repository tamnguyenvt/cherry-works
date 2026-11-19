/** `vendor-release-action.script.mjs` as the engine takes it: its text, to be put down as the
 *  script's asset `vendor-release-action.mjs`, never run here. A build reads it as text (tsup's `loader`),
 *  and so does `pnpm test` and `pnpm cw` (scripts/module-loader.mjs). */
declare const vendorReleaseActionMjs: string;
export default vendorReleaseActionMjs;
