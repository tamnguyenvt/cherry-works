/** `sessionTokensCounter.mjs` as the engine takes it: its text, to be put down as the
 *  script's asset, never run here. A build reads it as text (tsup's `loader`),
 *  and so does `pnpm test` and `pnpm cw` (scripts/moduleLoader.mjs). */
declare const sessionTokensCounterMjs: string;
export default sessionTokensCounterMjs;
