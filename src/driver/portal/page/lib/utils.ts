import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Class names joined, with a later Tailwind class winning over one it
 *  conflicts with: what every shadcn component styles itself by. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
