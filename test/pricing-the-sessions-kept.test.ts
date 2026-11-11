import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * The `cw-session-cost` skill used by the real `claude`, headless, over a log
 * of known sessions (EVAL Story 8). Each run spends the developer's own
 * sign-in, and the published prices are read live, so these run only when
 * asked: `CW_REAL_AGENT=1 pnpm test`, or this file alone with `CW_REAL_AGENT=1`.
 * What the skill answers is held to amounts this file works out itself.
 */
const isRealAgentAsked = process.env.CW_REAL_AGENT === "1";
const skipReason = !isRealAgentAsked && "the real agent is not asked for: set CW_REAL_AGENT=1";

/** How long one headless run of the skill may take. */
const RUN_TIMEOUT_MS = 10 * 60 * 1000;

/** This engine as built, which the skill reaches as `cw`. */
const builtCwFile = fileURLToPath(new URL("../dist/cw.js", import.meta.url));

type TokensByKind = { input: number; output: number; cacheWrite: number; cacheRead: number };
type PriceByKind = TokensByKind;

const DAY_MS = 24 * 60 * 60 * 1000;
/** The day before yesterday and yesterday, at noon UTC: inside the last 31
 *  days the summary sums when no span is named, and the same day wherever
 *  this runs. */
const firstDay = new Date(Date.now() - 2 * DAY_MS).toISOString().slice(0, 10);
const secondDay = new Date(Date.now() - DAY_MS).toISOString().slice(0, 10);

const UNKNOWN_MODEL = "acme-large-2";

/** Four sessions over two days, of two priced models and one no provider
 *  prices, each at its last stop. */
const keptSessions: readonly { sessionId: string; day: string; model: string; tokens: TokensByKind }[] = [
  {
    sessionId: "session-alpha",
    day: firstDay,
    model: "claude-opus-5-5",
    tokens: { input: 1_200_000, output: 300_000, cacheWrite: 500_000, cacheRead: 4_000_000 },
  },
  {
    sessionId: "session-beta",
    day: firstDay,
    model: "claude-haiku-5-5",
    tokens: { input: 800_000, output: 150_000, cacheWrite: 0, cacheRead: 2_500_000 },
  },
  {
    sessionId: "session-gamma",
    day: secondDay,
    model: "claude-opus-5-5",
    tokens: { input: 400_000, output: 90_000, cacheWrite: 120_000, cacheRead: 1_600_000 },
  },
  {
    sessionId: "session-delta",
    day: secondDay,
    model: UNKNOWN_MODEL,
    tokens: { input: 300_000, output: 60_000, cacheWrite: 0, cacheRead: 900_000 },
  },
];

/** The prices the developer types in, in dollars per million tokens. */
const typedPriceByModel: Readonly<Record<string, PriceByKind>> = {
  "claude-opus-5-5": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "claude-haiku-5-5": { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
};

/** What the skill is asked to end its answer with, so a test can read it. It
 *  says nothing of what a session of a model with no price is answered with:
 *  that is the skill's to say, in its prose. */
const ANSWER_SHAPE = `End your answer with one fenced \`json\` block, and nothing after it, of this shape:
{"prices": {"<model>": {"input": <dollars per million>, "output": <…>, "cacheWrite": <…>, "cacheRead": <…>}},
 "priceSource": "<where the prices were read, or null if typed in>", "pricesReadAt": "<ISO 8601 time they were read, or null if typed in>",
 "sessions": [{"sessionId": "<id>", "model": "<model>", "cost": <dollars>}],
 "days": [{"day": "<YYYY-MM-DD>", "cost": <dollars>}], "total": <dollars>}
Give every amount in dollars to four decimal places.`;

type SkillAnswer = {
  prices: Record<string, PriceByKind>;
  priceSource: string | null;
  pricesReadAt: string | null;
  sessions: { sessionId: string; model: string; cost: unknown }[];
  days: { day: string; cost: number }[];
  total: number;
};

/** A number as an answer may write it: `1200000`, `1,200,000`, `1.2M` or
 *  `1200K`, `0.50` for `0.5`, after a `$` where it must be dollars; never as
 *  part of a longer number. */
const writtenNumberPattern = (count: number, isDollars = false) => {
  const writtenCounts = [
    String(count),
    count.toLocaleString("en-US"),
    count.toFixed(2),
    `${count / 1_000_000}M`,
    `${count / 1_000}K`,
  ].map((writtenCount) => writtenCount.replaceAll(".", "\\."));
  return new RegExp(`(?<![\\d.,])${isDollars ? "\\$" : ""}(?:${writtenCounts.join("|")})(?![\\d]|[.,]\\d)`, "i");
};

/** The answer's words, its closing `json` block left out. */
const proseOf = (answerText: string) => answerText.replace(/```json[\s\S]*?```/g, "");

/** What the answer's words say of a session of a model with no price: its
 *  line saying the cost is unknown, its tokens, and that the totals leave it
 *  out, on that same line or the totals' (EVAL-FR-015). */
const assertUnpricedSessionSaid = (answerText: string) => {
  const unknownSession = keptSessions.find(({ model }) => model === UNKNOWN_MODEL)!;
  const answerLines = proseOf(answerText).split("\n");
  const namesUnknownSession = (line: string) => line.includes(unknownSession.sessionId) || line.includes(UNKNOWN_MODEL);
  assert.ok(
    answerLines.some((line) => namesUnknownSession(line) && /unknown/i.test(line)),
    `no line names ${unknownSession.sessionId} with its cost unknown`,
  );
  const unknownSessionTokenCounts = Object.values(unknownSession.tokens).filter((count) => count > 0);
  const unknownSessionTotal = Object.values(unknownSession.tokens).reduce((sum, count) => sum + count, 0);
  assert.ok(
    unknownSessionTokenCounts.every((count) => writtenNumberPattern(count).test(proseOf(answerText))) ||
      writtenNumberPattern(unknownSessionTotal).test(proseOf(answerText)),
    `the tokens of ${unknownSession.sessionId} are not given`,
  );
  assert.ok(
    answerLines.some(
      (line) => namesUnknownSession(line) && /left out|exclud|not (?:included|counted|in the total)/i.test(line),
    ),
    `no line says ${unknownSession.sessionId} is left out of the totals`,
  );
};

/** A session's cost at these prices, worked out here, apart from the skill;
 *  `undefined` for a model none of them names. */
const sessionCostOf = (tokens: TokensByKind, priceByModel: Readonly<Record<string, PriceByKind>>, model: string) => {
  const price = priceByModel[model];
  if (price === undefined || price === null) return undefined;
  return (
    (tokens.input * price.input +
      tokens.output * price.output +
      tokens.cacheWrite * price.cacheWrite +
      tokens.cacheRead * price.cacheRead) /
    1_000_000
  );
};

/** Each session's, each day's and the span's cost at these prices. */
const expectedCostsOf = (priceByModel: Readonly<Record<string, PriceByKind>>) => {
  const costBySessionId = new Map(
    keptSessions.map(({ sessionId, tokens, model }) => [sessionId, sessionCostOf(tokens, priceByModel, model)]),
  );
  const costByDay = new Map<string, number>();
  for (const { sessionId, day } of keptSessions)
    costByDay.set(day, (costByDay.get(day) ?? 0) + (costBySessionId.get(sessionId) ?? 0));
  return { costBySessionId, costByDay, totalCost: [...costByDay.values()].reduce((sum, dayCost) => sum + dayCost, 0) };
};

/** Within half a cent: the skill gives four places, and rounds. */
const assertSameAmount = (actualCost: unknown, expectedCost: number, label: string) =>
  assert.ok(
    typeof actualCost === "number" && Math.abs(actualCost - expectedCost) <= 0.005,
    `${label}: ${actualCost} is not ${expectedCost.toFixed(4)}`,
  );

/**
 * A repository whose agent holds the skill and whose sessions are the ones
 * above, kept where its settings say; `cw` first on the PATH is this engine as
 * built. The real `claude` is asked the prompt there, may run `cw sessions`
 * and `date`, call the skill and read the web, and nothing else; its last fenced `json`
 * block is the answer, with every page it fetched and the time the run began
 * and ended.
 */
const skillAnswerOf = async (prompt: string) => {
  const machineFolder = await realpath(await mkdtemp(join(tmpdir(), "cw-session-cost-")));
  try {
    const repoFolder = join(machineFolder, "repo");
    const sessionsFolder = join(machineFolder, "sessions");
    const binFolder = join(machineFolder, "bin");
    await mkdir(join(repoFolder, ".cw"), { recursive: true });
    await mkdir(binFolder, { recursive: true });
    await writeFile(
      join(repoFolder, ".cw/settings.json"),
      JSON.stringify({ agents: ["claude"], sessionAnalysisFolder: sessionsFolder }),
    );
    for (const { sessionId, day, model, tokens } of keptSessions) {
      const sessionAnalysisLineOf = (time: string, scale: number) => {
        const scaledTokens = {
          input: tokens.input * scale,
          output: tokens.output * scale,
          cacheWrite: tokens.cacheWrite * scale,
          cacheRead: tokens.cacheRead * scale,
        };
        return JSON.stringify({
          time,
          sessionId,
          repository: repoFolder,
          model,
          tokens: scaledTokens,
          total: Object.values(scaledTokens).reduce((sum, count) => sum + count, 0),
        });
      };
      await mkdir(join(sessionsFolder, sessionId), { recursive: true });
      // An earlier stop, which the summary counts the session past.
      await writeFile(
        join(sessionsFolder, sessionId, "session-analysis.jsonl"),
        `${sessionAnalysisLineOf(`${day}T11:00:00.000Z`, 0.5)}\n${sessionAnalysisLineOf(`${day}T12:00:00.000Z`, 1)}\n`,
      );
    }
    await writeFile(join(binFolder, "cw"), `#!/bin/sh\nexec "${process.execPath}" "${builtCwFile}" "$@"\n`);
    await chmod(join(binFolder, "cw"), 0o755);
    // The skill as a build puts it where claude reads it, and nothing by hand.
    const cwBuildRun = spawnSync(join(binFolder, "cw"), ["build"], { cwd: repoFolder, encoding: "utf8" });
    assert.equal(cwBuildRun.status, 0, `cw build failed:\n${cwBuildRun.stdout}${cwBuildRun.stderr}`);

    const runStartedAt = new Date();
    const printedEvents = await new Promise<string>((resolve, reject) => {
      const claudeProcess = spawn(
        "claude",
        [
          "-p",
          "--output-format",
          "stream-json",
          "--verbose",
          "--strict-mcp-config",
          "--setting-sources",
          "project",
          "--allowedTools",
          "Skill",
          "Bash(cw sessions:*)",
          "Bash(date:*)",
          "WebFetch",
        ],
        {
          cwd: repoFolder,
          env: { ...process.env, PATH: `${binFolder}:${process.env.PATH}` },
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
      let stdout = "";
      let stderr = "";
      claudeProcess.stdout.on("data", (chunk) => (stdout += chunk));
      claudeProcess.stderr.on("data", (chunk) => (stderr += chunk));
      claudeProcess.on("error", reject);
      claudeProcess.on("close", (code) =>
        code === 0 ? resolve(stdout) : reject(new Error(`claude -p stopped with status ${code}: ${stderr.trim()}`)),
      );
      claudeProcess.stdin.end(`${prompt}\n\n${ANSWER_SHAPE}`);
    });
    const runEndedAt = new Date();
    type StreamEvent = {
      type: string;
      result?: string;
      message?: { content?: { type: string; name?: string; input?: { url?: string } }[] };
    };
    const streamEvents = printedEvents
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => JSON.parse(line) as StreamEvent);
    const answerText = streamEvents.find(({ type }) => type === "result")?.result ?? "";
    const fetchedUrls = streamEvents.flatMap(({ type, message }) =>
      type === "assistant"
        ? (message?.content ?? []).flatMap(({ type: contentType, name, input }) =>
            contentType === "tool_use" && name === "WebFetch" && input?.url !== undefined ? [input.url] : [],
          )
        : [],
    );
    const answerJson = [...answerText.matchAll(/```json\s*([\s\S]*?)```/g)].at(-1)?.[1];
    assert.ok(answerJson !== undefined, `the skill ended on no json block:\n${answerText}`);
    console.log(
      `# the skill answered, ${runStartedAt.toISOString()} – ${runEndedAt.toISOString()}, having fetched ${JSON.stringify(fetchedUrls)}:\n${answerText.replace(/^/gm, "# ")}`,
    );
    return { answerText, skillAnswer: JSON.parse(answerJson) as SkillAnswer, fetchedUrls, runStartedAt, runEndedAt };
  } finally {
    await rm(machineFolder, { recursive: true, force: true });
  }
};

const typedPricesPrompt = `What did the sessions cost? Use these prices I type in, in US dollars per million tokens: ${Object.entries(
  typedPriceByModel,
)
  .map(
    ([model, { input, output, cacheWrite, cacheRead }]) =>
      `${model}: input ${input}, output ${output}, cacheWrite ${cacheWrite}, cacheRead ${cacheRead}`,
  )
  .join("; ")}.`;

/** Where Anthropic publishes its prices. */
const PUBLISHED_PRICE_SOURCE_PATTERN = /^https:\/\/(platform\.claude\.com|docs\.anthropic\.com|www\.anthropic\.com)\//;

/** One run with typed prices, which scenarios 1 and 3 both read. */
let typedPricesRun: ReturnType<typeof skillAnswerOf> | undefined;

test("at prices typed in, each session's and each day's cost is its tokens times those prices, and the prices are named (EVAL-FR-014)", {
  skip: skipReason,
  timeout: RUN_TIMEOUT_MS,
}, async () => {
  typedPricesRun ??= skillAnswerOf(typedPricesPrompt);
  const { answerText, skillAnswer } = await typedPricesRun;
  const { costBySessionId, costByDay, totalCost } = expectedCostsOf(typedPriceByModel);

  for (const [model, typedPrice] of Object.entries(typedPriceByModel)) {
    assert.deepEqual(skillAnswer.prices[model], typedPrice);
    for (const dollars of Object.values(typedPrice))
      assert.match(
        proseOf(answerText),
        writtenNumberPattern(dollars, true),
        `the price ${dollars} of ${model} is not named`,
      );
  }
  assert.equal(skillAnswer.priceSource, null);
  for (const [sessionId, sessionCost] of costBySessionId) {
    if (sessionCost === undefined) continue;
    assertSameAmount(
      skillAnswer.sessions.find((session) => session.sessionId === sessionId)?.cost,
      sessionCost,
      sessionId,
    );
  }
  for (const [day, dayCost] of costByDay)
    assertSameAmount(skillAnswer.days.find((answeredDay) => answeredDay.day === day)?.cost, dayCost, day);
  assertSameAmount(skillAnswer.total, totalCost, "total");
});

test("a session of a model no price is known for keeps its tokens, has its cost said to be unknown, and is left out of the totals, which say so (EVAL-FR-015)", {
  skip: skipReason,
  timeout: RUN_TIMEOUT_MS,
}, async () => {
  typedPricesRun ??= skillAnswerOf(typedPricesPrompt);
  const { answerText, skillAnswer } = await typedPricesRun;

  assertUnpricedSessionSaid(answerText);
  assertSameAmount(
    skillAnswer.total,
    expectedCostsOf(typedPriceByModel).totalCost,
    "total without the unpriced session",
  );
});

test("at published prices, the costs are at the prices the skill read, and it says where and when it read them (EVAL-FR-014)", {
  skip: skipReason,
  timeout: RUN_TIMEOUT_MS,
}, async () => {
  const { answerText, skillAnswer, fetchedUrls, runStartedAt, runEndedAt } = await skillAnswerOf(
    "What did the sessions cost? Use the model provider's published prices as they stand today.",
  );

  assert.match(skillAnswer.priceSource ?? "", PUBLISHED_PRICE_SOURCE_PATTERN);
  assert.ok(
    fetchedUrls.includes(skillAnswer.priceSource!),
    `${skillAnswer.priceSource} was never fetched: ${JSON.stringify(fetchedUrls)}`,
  );
  const pricesReadAtMs = Date.parse(skillAnswer.pricesReadAt ?? "");
  // Read during the run, to the minute.
  assert.ok(
    pricesReadAtMs >= runStartedAt.getTime() - 60_000 && pricesReadAtMs <= runEndedAt.getTime() + 60_000,
    `read at ${skillAnswer.pricesReadAt}, outside the run`,
  );
  for (const model of ["claude-opus-5-5", "claude-haiku-5-5"]) {
    const price = skillAnswer.prices[model];
    assert.ok(
      price !== undefined && Object.values(price).every((dollars) => typeof dollars === "number" && dollars > 0),
      `no published price of ${model}`,
    );
  }
  assert.ok(!skillAnswer.prices[UNKNOWN_MODEL], `${UNKNOWN_MODEL} was given a price`);
  const { costBySessionId, costByDay, totalCost } = expectedCostsOf(skillAnswer.prices);
  for (const [sessionId, sessionCost] of costBySessionId) {
    if (sessionCost === undefined) continue;
    assertSameAmount(
      skillAnswer.sessions.find((session) => session.sessionId === sessionId)?.cost,
      sessionCost,
      sessionId,
    );
  }
  for (const [day, dayCost] of costByDay)
    assertSameAmount(skillAnswer.days.find((answeredDay) => answeredDay.day === day)?.cost, dayCost, day);
  assertSameAmount(skillAnswer.total, totalCost, "total");
  assertUnpricedSessionSaid(answerText);
});
