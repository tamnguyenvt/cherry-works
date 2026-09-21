import type { Page } from "playwright";

/** What a tab's listing shows, read the way a reader reads it: each kind's chip
 *  with its count, the chip that is on, and the rows of the table under it. */

/** Every kind's chip, as [kind, count]. */
export const chipsOf = (page: Page) =>
  page
    .getByRole("radio")
    .evaluateAll((chips) => chips.map((chip) => [chip.getAttribute("aria-label"), chip.querySelector('[data-slot="badge"]')?.textContent]));

/** The kind whose chip is on. */
export const shownKindOf = (page: Page) => page.getByRole("radio", { checked: true }).getAttribute("aria-label");

/** The rows of the listing's table, header left out. */
export const rowsOf = (page: Page) => page.getByRole("table").locator("tbody tr");

/** The text of one column of those rows, by the column's place. */
export const columnOf = (page: Page, column: number) => rowsOf(page).locator(`td:nth-child(${column})`);
