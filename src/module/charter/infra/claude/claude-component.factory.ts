import {
  AgentPrimitive,
  BuiltSensors,
  type CharterOutput,
  type CharterRoot,
  CompiledPrimitive,
  GuidePrimitive,
  McpOrigins,
  McpPrimitive,
  outputPath,
  PlaybookPrimitive,
  PosturePrimitive,
  type Primitive,
  PrimitiveHelper,
  SensorPrimitive,
  SkillPrimitive,
} from "../../app/port/out/managing-local-agent-output.port.js";
import { resolveLaidText } from "../helper.js";
import { ClaudeAgent } from "./claude-agent.js";
import { type ClaudeComponent, ClaudeComponents } from "./claude-component.js";
import { ClaudeEntryFile } from "./claude-entry-file.js";
import { ClaudeMcpConfig } from "./claude-mcp-config.js";
import { ClaudeRule } from "./claude-rule.js";
import { type ClaudeHookEvent, ClaudeSettings, type ClaudeSettingsFields } from "./claude-settings.js";
import { ClaudeSkill } from "./claude-skill.js";

/** Makes every file this engine puts down for claude. */
export class ClaudeComponentFactory {
  /**
   * Every file claude reads of this charter (FR-018).
   *
   * Two passes, because this agent reads two kinds of file. What lands in its
   * settings lands in one file whatever asked for it, so every primitive that asks
   * is read together and compiles to one fragment; everything else is a document
   * of its own, one per primitive.
   *
   * Not one for one, either way. A `skill` and a `playbook` are two things in a
   * charter and one thing here, because this agent has one mechanism for a body
   * loaded when the request calls for it; a `guide` is a rule, brought up by the
   * files it names or carried on every turn where it names none. What the charter kept apart, the listing
   * keeps apart (FR-011); what the agent cannot tell apart, it is not told.
   *
   * Three kinds project nothing of their own. A `corpus` is cited rather than
   * loaded, a `mixin` has no life of its own — its body is written into each primitive
   * that pulls it in, which `writeMarkdown` does when `CompiledPrimitiveFactory.create` hands it the mixins — and an `mcp` is reached through
   * `cw mcp serve` rather than read: the one entry of the agent's MCP
   * configuration that starts it, written whether the charter holds an mcp origin yet or
   * not, since the server reads which mcp origins there are when it starts (FR-146).
   */
  static create(charterRoot: CharterRoot, charterOutput: CharterOutput): readonly ClaudeComponent[] {
    const claudeAgentProvider = ClaudeComponents.agentProvider;
    const compiledPrimitives = charterOutput.charterOutputItems.filter(
      (charterOutputItem): charterOutputItem is CompiledPrimitive => charterOutputItem instanceof CompiledPrimitive,
    );
    const compiledPrimitiveById = new Map(
      compiledPrimitives.map((compiledPrimitive) => [compiledPrimitive.id, compiledPrimitive]),
    );
    // The name each mcp is served under, as the build listed it (FR-145).
    const mcpOrigins = charterOutput.findCharterOutputItem(McpOrigins);
    const shortMcpIds: Readonly<Record<string, string>> = Object.fromEntries(
      mcpOrigins.origins.flatMap(({ names }) => Object.entries(names)),
    );
    const builtSensors = charterOutput.findCharterOutputItem(BuiltSensors).filterForAgent(claudeAgentProvider);
    // Does this primitive ask something of the settings this agent runs on, rather
    // than compile to a file of its own? A posture says what may be run, a sensor
    // what runs when an event fires, and this agent reads both out of one file.
    const isSettingComponent = (primitive: Primitive) =>
      primitive.kind === PosturePrimitive.kind || primitive.kind === SensorPrimitive.kind;
    const settingPrimitives = charterRoot.primitives.filter(
      (primitive) => primitive.supportsAgent(claudeAgentProvider) && isSettingComponent(primitive),
    );
    const documentPrimitives = charterRoot.primitives.filter((primitive) => !isSettingComponent(primitive));

    // A subagent holds the tools it lists and nothing else. An mcp origin it lists,
    // `[[<id>]]` whole or `[[<id>]]:<tool>` one tool, is written as this agent is
    // given each of its tools, `mcp__cw__<served name>__<tool>` (FR-156); the
    // charter has refused an mcp origin or tool it does not hold.
    const toolsByMcpId = new Map(
      charterRoot.primitives.flatMap((primitive) =>
        primitive instanceof McpPrimitive ? [[primitive.headers.id, primitive.headers.tools] as const] : [],
      ),
    );
    const listAgentTools = (agentPrimitive: AgentPrimitive) =>
      agentPrimitive.headers.tools.flatMap((tool) => {
        const { mcpId, toolName: mcpTool } = PrimitiveHelper.parseToolReference(tool) ?? {};
        if (mcpId === undefined) return [tool];
        return (mcpTool === undefined ? (toolsByMcpId.get(mcpId) ?? []) : [mcpTool]).map(
          (mcpToolName) => `mcp__${ClaudeMcpConfig.cwMcpName}__${shortMcpIds[mcpId]}__${mcpToolName}`,
        );
      });

    return [
      // The section of `CLAUDE.md` that sends this agent to the charter at all
      // (FR-051).
      new ClaudeEntryFile(
        claudeAgentProvider,
        ClaudeComponentFactory.#composeEntryFileSection(charterRoot.charterPlace),
      ),
      ...(settingPrimitives.length === 0 && toolsByMcpId.size === 0
        ? []
        : [
            new ClaudeSettings(
              claudeAgentProvider,
              ClaudeSettings.kind,
              ClaudeComponentFactory.#createClaudeSettings(charterRoot, builtSensors, settingPrimitives),
            ),
          ]),
      // The one entry the charter speaks for, under `mcpServers`, in the file
      // this agent starts a project's servers from. That file is the
      // repository's too, so the entry is written into it, and never taken
      // away (FR-146).
      new ClaudeMcpConfig(claudeAgentProvider, ClaudeMcpConfig.kind, {
        mcpServers: { [ClaudeMcpConfig.cwMcpName]: { command: "cw", args: ["mcp", "serve"] } },
      }),
      ...documentPrimitives.flatMap(
        (documentPrimitive) =>
          ClaudeComponentFactory.#createClaudeDocumentComponent(
            documentPrimitive,
            compiledPrimitiveById.get(documentPrimitive.headers.id)!,
            documentPrimitive instanceof AgentPrimitive ? listAgentTools(documentPrimitive) : undefined,
          ) ?? [],
      ),
    ];
  }

  /**
   * Everything this charter asks of the settings this agent runs on, read together
   * (FR-018).
   *
   * One fragment for the whole charter, because the agent keeps one such file: every
   * posture's permissions are the permissions, each thing once, and every event a
   * sensor fires on is one hook, `cw sensor run <event> --agent claude`, which runs
   * that event's sensors kept for Claude as the last build wrote them (FR-175). A charter reaching a mcp origin
   * turns the agent's own tool search on (EVAL-FR-016).
   *
   * What the repository set for itself is not here at all: that is on disk, and
   * reading it together with this is the projection's (FR-020).
   */
  static #createClaudeSettings(
    charterRoot: CharterRoot,
    builtSensors: BuiltSensors,
    settingPrimitives: readonly Primitive[],
  ): ClaudeSettingsFields {
    const allowedPermissions = new Set<string>();
    const deniedPermissions = new Set<string>();

    for (const settingPrimitive of settingPrimitives) {
      if (settingPrimitive.kind === PosturePrimitive.kind) {
        for (const permission of settingPrimitive.headers.allow) allowedPermissions.add(permission);
        for (const permission of settingPrimitive.headers.deny) deniedPermissions.add(permission);
      }
    }
    // A signal this agent raises nothing for compiles to nothing: writing it would
    // be a hook that never fires, and the charter still names the event for
    // whichever agent does raise it. In the order the events' names sort in, so the
    // same charter writes the same file (SC-007).
    const hookEvents = builtSensors.signals
      .filter((signal): signal is ClaudeHookEvent => (ClaudeSettings.hookEvents as readonly string[]).includes(signal))
      .sort();

    return {
      ...(allowedPermissions.size === 0 && deniedPermissions.size === 0
        ? {}
        : { permissions: { allow: [...allowedPermissions], deny: [...deniedPermissions] } }),
      ...(hookEvents.length === 0
        ? {}
        : {
            hooks: Object.fromEntries(
              hookEvents.map((hookEvent) => [
                hookEvent,
                [
                  {
                    hooks: [
                      {
                        type: "command",
                        command: builtSensors.getRunCommand(hookEvent, ClaudeComponents.agentProvider),
                      },
                    ],
                  },
                ],
              ]),
            ),
          }),
      // A charter reaching an mcp origin has its tools' schemas deferred by the agent
      // itself, the one server listing every tool (EVAL-FR-016).
      ...(charterRoot.primitives.some((primitive) => primitive instanceof McpPrimitive) && {
        env: ClaudeSettings.toolSearchEnv,
      }),
    };
  }

  /**
   * Which document of this agent a charter primitive becomes, or nothing where this
   * agent has no kind for it.
   *
   * What the primitive says is kept once, in its compiled document: this holds
   * what the agent reads before it opens a body, and one line pointing there
   * (FR-139). The link is from this document's own place, as claude resolves an
   * `@` import. A rule's `@` is expanded when the session opens; for the other kinds claude
   * documents no such expansion, so the line says to read the file. A subagent
   * is handed `agentTools`: its tools as this agent names them, each mcp origin it
   * holds written as that mcp origin's tools (FR-156).
   */
  static #createClaudeDocumentComponent(
    documentPrimitive: Primitive,
    compiledPrimitive: CompiledPrimitive,
    agentTools?: readonly string[],
  ): ClaudeComponent | undefined {
    // The id alone, so a skill is invoked as `/<id>` rather than
    // `/skill-<id>`; one id names one primitive whatever its kind, so no two
    // land on one name here (FR-015, FR-171).
    const primitiveId = documentPrimitive.normId;
    const compiledDocumentLink = outputPath.getLink(compiledPrimitive);
    const pointerText = `Read and follow @${compiledDocumentLink}.\n`;

    switch (documentPrimitive.kind) {
      // A guide is a rule this agent loads into context whole: when a file it names
      // is touched, which is what `paths` on a rule does, and at the start of every
      // session where it names none (FR-013). Under the id it is changed by,
      // so a reader who wants it changed is sent to the primitive rather than
      // editing what the next build overwrites (FR-017, FR-020).
      case GuidePrimitive.kind: {
        // An `@` is expanded when the session opens, paths or not, so a guide
        // naming files is pointed to from the repository's root instead, and
        // read only once one of them is touched.
        const { globs = [] } = documentPrimitive.headers;
        if (globs.length === 0)
          return new ClaudeRule(ClaudeComponents.agentProvider, "guide", primitiveId, {}, `@${compiledDocumentLink}\n`);
        return new ClaudeRule(
          ClaudeComponents.agentProvider,
          "guide",
          primitiveId,
          { paths: globs },
          `Read and follow ${resolveLaidText(outputPath.getLink(compiledPrimitive))}.\n`,
        );
      }
      case AgentPrimitive.kind: {
        const { tools } = documentPrimitive.headers;
        const claudeModel = documentPrimitive.modelOf(ClaudeComponents.agentProvider);
        return new ClaudeAgent(
          ClaudeComponents.agentProvider,
          "agent",
          primitiveId,
          {
            name: primitiveId,
            description: documentPrimitive.composeDescription(),
            tools: (agentTools ?? tools).join(", "),
            ...(claudeModel === undefined ? {} : { model: claudeModel }),
          },
          pointerText,
        );
      }
      // One kind of this agent for the two the charter loads when the request calls
      // for them: what decides that the body is worth opening is the description,
      // because that line is all this agent reads before deciding (FR-013), and
      // composing it is the primitive's. One that is a step of another is kept
      // out of the user's commands (CORE-FR-174), and one the user alone starts is
      // kept out of the agent's own reach (CORE-FR-182).
      case SkillPrimitive.kind:
      case PlaybookPrimitive.kind:
        return new ClaudeSkill(
          ClaudeComponents.agentProvider,
          documentPrimitive.kind,
          primitiveId,
          {
            name: primitiveId,
            description: documentPrimitive.composeDescription(),
            ...(documentPrimitive.headers["disable-user-invocation"] === true ? { "user-invocable": false } : {}),
            ...(documentPrimitive.headers["disable-model-invocation"] === true
              ? { "disable-model-invocation": true }
              : {}),
          },
          pointerText,
        );
      default:
        return undefined;
    }
  }

  /** The section of `CLAUDE.md`, said the same for every charter: where the
   *  orientation is, from where the file lands (FR-019), and where the charter
   *  is edited, as the store keeping it says (SDK-FR-020). */
  static #composeEntryFileSection(charterPlace: string): string {
    return `<!-- CHERRYWORKS START -->\n${[
      "## Charter",
      `This repository is governed by a charter. Read [CHARTER.md](${outputPath.getLinkTo(outputPath.charterMdFileName)}) before anything else here, and work under what it says.`,
      `Find primitives in [catalogue.json](${outputPath.getLinkTo(outputPath.getCatalogueFileName())}) and [catalogue.claude.json](${outputPath.getLinkTo(outputPath.getCatalogueFileName(ClaudeComponents.agentProvider.name))}).`,
      `It is generated from the charter under \`${charterPlace}/\`: do not edit it, edit the primitive behind it.`,
    ].join("\n\n")}\n<!-- CHERRYWORKS END -->\n`;
  }

  private constructor() {}
}
