import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { type AnswersOfEveryCommand, answersOfEveryCommand } from "./every-command-in-turn.js";

/** What every command and the portal answered when this was recorded, by the
 *  `cw` `pnpm test` builds first. A change meant to alter an answer records it
 *  again: `CW_RECORD_ANSWERS=1` writes what this run answered in its place. */
const recordedAnswersUrl = new URL("answered-by-every-command.json", import.meta.url);

/** Clear of the default port, and of the other tests' portals. */
const PORT = 47392;

test("every cw command and the portal answer as they did when recorded (CORE Story 44 scenario 3, CORE Story 46 scenario 4, CORE Story 49 scenario 3, CORE Story 52 scenario 6, CORE Story 56 scenario 7, CORE Story 55 scenarios 10, 19)", async () => {
  const currentAnswers = await answersOfEveryCommand(fileURLToPath(new URL("../dist/cw.js", import.meta.url)), PORT);
  if (process.env.CW_RECORD_ANSWERS === "1") {
    await writeFile(recordedAnswersUrl, `${JSON.stringify(currentAnswers, null, 2)}\n`);
  }
  const recordedAnswers: AnswersOfEveryCommand = JSON.parse(await readFile(recordedAnswersUrl, "utf8"));

  assert.deepEqual(currentAnswers, recordedAnswers);
});
