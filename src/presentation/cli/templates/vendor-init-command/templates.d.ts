/** A file of `cw vendor init`'s template as the command takes it: its text, written into the charter
 *  repository it sets up, never run here. A build reads it as text (tsup's `loader`), and so does
 *  `pnpm test` and `pnpm cw` (scripts/module-loader.mjs). */
declare module "*.md" {
  const templateText: string;
  export default templateText;
}

declare module "*.txt" {
  const templateText: string;
  export default templateText;
}
