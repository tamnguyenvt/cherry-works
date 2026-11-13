import { z } from "./libs/validator.lib.js";

/** The schemas every module's values are written with. */

/** One line of text with something on it: a header written down and left
 *  blank is one nothing can read. */
export const GoodLineSchema = z.string().regex(/\S/);

/** A list of names, paths or globs with at least one in it: a kind that
 *  requires a list reads it entry by entry, and an empty one gives it nothing
 *  to read. */
export const GoodArraySchema = z.array(GoodLineSchema).min(1).readonly();

/** A yes or a no: `true` or `false`, read as YAML reads it off a file, or as
 *  the line an author typed at `cw add` or in the portal. */
export const FlagSchema = z
  .unknown()
  .refine((yesNoValue) => [true, false, "true", "false"].includes(yesNoValue as never), {
    message: "A yes or no header is written true or false.",
  })
  .transform((yesNoValue) => yesNoValue === true || yesNoValue === "true");
