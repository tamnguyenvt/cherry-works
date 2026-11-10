import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Class names joined, with a later Tailwind class winning over one it
 *  conflicts with: what every shadcn component styles itself by. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** The row of buttons a dialog ends on, drawn across the dialog's foot under a
 *  rule, as the mockup draws a dialog's footer: it undoes the padding the
 *  dialog's body is drawn in (`Dialogs.tsx`), and stays in sight while what is
 *  above it scrolls. */
export const DIALOG_FOOTER =
  "sticky -bottom-[18px] -mx-5 -mb-[18px] mt-[18px] flex items-center gap-2 border-t border-[#f0f0f0] bg-background px-[18px] py-[13px]";
