import {
  CHARTER_FOLDER_PATH,
  type CharterOutput,
  type CharterRoot,
  CompiledPrimitive,
  outputPath,
  StampedDocument,
} from "../../app/port/out/managing-local-agent-output.port.js";
import { resolveLaidText } from "../helper.js";
import { CodexAgent } from "./codex-agent.js";
import { type CodexComponent, CodexComponents } from "./codex-component.js";
import { CodexConfig, type CodexHook } from "./codex-config.js";
import { CodexEntryFile } from "./codex-entry-file.js";
import { type CodexCommandRule, CodexRules } from "./codex-rules.js";
import { CodexSkill } from "./codex-skill.js";
import { CodexSkillPolicy } from "./codex-skill-policy.js";

/** Makes every file this engine puts down for Codex. */
export class CodexComponentFactory {
  /** Translate charter activation, execution permissions and sensors into the
   * host's native surfaces. Claude permission syntax is translated only where
   * a literal command prefix has the same scope as a Codex execution rule. */
  static create(charter: CharterRoot, charterOutput: CharterOutput): readonly CodexComponent[] {
    const codexAgent = CodexComponents.agentProvider;
    const compiledPrimitives = charterOutput.charterOutputItems.filter(
      (charterOutputItem): charterOutputItem is CompiledPrimitive => charterOutputItem instanceof CompiledPrimitive,
    );
    const compiledPrimitiveById = new Map(
      compiledPrimitives.map((compiledPrimitive) => [compiledPrimitive.id, compiledPrimitive]),
    );
    const entryLines = [
      "## Charter",
      `Read and follow [${resolveLaidText(outputPath.getLinkTo(outputPath.charterMdFileName))}](${outputPath.getLinkTo(outputPath.charterMdFileName)}) before working here. Edit the primitives under \`${CHARTER_FOLDER_PATH}/\`, then run \`cw build\`; generated files are not edited by hand.`,
      `Find primitives in [catalogue.json](${outputPath.getLinkTo(outputPath.getCatalogueFileName())}) and [catalogue.codex.json](${outputPath.getLinkTo(outputPath.getCatalogueFileName(codexAgent.name))}).`,
      "### Guides",
    ];
    const documentComponents: CodexComponent[] = [];
    const commandRules: CodexCommandRule[] = [];
    const sensorHooks: CodexHook[] = [];
    const warnings: string[] = [];
    const guideSectionsByFolder = new Map<string, string[]>();
    const filesystem: Record<string, "read" | "write" | "deny"> = {};
    const deniedReadPaths = new Set<string>();
    const deniedWritePaths = new Set<string>();
    for (const primitive of charter.primitives) {
      if (!primitive.supportsAgent(codexAgent)) continue;
      const compiledPrimitive = compiledPrimitiveById.get(primitive.headers.id)!;
      // From the repository's root, which is where every pointer is read from.
      const compiledDocumentLink = resolveLaidText(outputPath.getLink(compiledPrimitive));
      const pointerText = `Read and follow ${compiledDocumentLink}.`;
      switch (primitive.kind) {
        case "guide": {
          const { globs = [] } = primitive.headers;
          const guideFolders = new Set<string>();
          if (globs.length > 0) {
            entryLines.push(
              `- When touching a file matching ${globs.map((glob) => JSON.stringify(glob)).join(", ")}: ${pointerText}`,
            );
            for (const glob of globs) {
              const segments = glob.replace(/^\.\//, "").split("/");
              const folderSegments: string[] = [];
              for (const segment of segments.slice(0, -1)) {
                if (/[*?{}[\]!]/.test(segment)) break;
                if (segment === "" || segment === "." || segment === "..") break;
                folderSegments.push(segment);
              }
              const folderPath = folderSegments.join("/");
              if (
                folderPath === ".git" ||
                folderPath.startsWith(".git/") ||
                folderPath === ".cw" ||
                folderPath.startsWith(".cw/")
              ) {
                warnings.push(
                  `Codex guide ${primitive.headers.id}: cannot generate an AGENTS.md inside ${folderPath}; kept the root instruction.`,
                );
                continue;
              }
              guideFolders.add(folderPath);
            }
          } else guideFolders.add("");
          for (const folderPath of guideFolders) {
            // Embed the compiled body, including mixins. A link an author wrote
            // is from the compiled document, so it is linked on from there; a
            // link to a primitive is from wherever the text lands already.
            // The stamp alone is the generated footer; only the compiled document
            // keeps it, not the body embedded in the managed entry section.
            const guideBody = compiledPrimitive.text
              .slice(0, -StampedDocument.footer.length)
              .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n+/, "");
            const rootGuideBody = guideBody.replace(
              /^ {0,3}(`{3,}|~{3,})[\s\S]*?(?:^ {0,3}\1[^\n]*$|(?![\s\S]))|`[^`\n]*`|!?\[[^\]\n]*\]\(([^)\n]*)\)/gm,
              (markdown, _fence, linkTarget: string | undefined) => {
                if (linkTarget === undefined || !/^\.{1,2}\//.test(linkTarget)) return markdown;
                return markdown.replace(`(${linkTarget})`, `(${outputPath.getLink(compiledPrimitive, linkTarget)})`);
              },
            );
            const section = `#### ${primitive.headers.id}${globs.length === 0 ? " — every turn" : ""}\n\n${globs.length === 0 ? "" : `Applies only to repository paths matching: ${globs.map((glob) => JSON.stringify(glob)).join(", ")}.\n\n`}Source: [${compiledDocumentLink}](${outputPath.getLink(compiledPrimitive)}).\n\n${rootGuideBody.trimEnd()}`;
            if (folderPath === "") entryLines.push(section);
            else guideSectionsByFolder.set(folderPath, [...(guideSectionsByFolder.get(folderPath) ?? []), section]);
          }
          break;
        }
        case "posture": {
          entryLines.push(
            `- Always: ${pointerText} Command prefix rules apply outside the sandbox; sandbox and approval settings are configured separately.`,
          );
          for (const decision of ["allow", "deny"] as const) {
            for (const permission of primitive.headers[decision]) {
              const filePermission = permission.match(/^(Read|Write|Edit)\(([^)]+)\)$/);
              const barePath = !/[()\s]/.test(permission) && /[./*?]/.test(permission) ? permission : undefined;
              if (filePermission !== null || barePath !== undefined) {
                const tool = filePermission?.[1];
                const path = (filePermission?.[2] ?? barePath)!.replace(/^\.\//, "");
                if (
                  path !== "" &&
                  (barePath !== undefined || (!path.startsWith("/") && !path.startsWith("~"))) &&
                  !path.split("/").includes("..")
                ) {
                  if (decision === "deny")
                    (tool === "Read" || barePath !== undefined ? deniedReadPaths : deniedWritePaths).add(path);
                  else if (filesystem[path] !== "write") filesystem[path] = tool === "Read" ? "read" : "write";
                  continue;
                }
              }
              // Exact commands cannot become prefixes without broadening access.
              // Reject shell syntax, quoting and globs rather than guessing how
              // a shell would tokenize them or granting a wider prefix.
              const commandPrefix = permission.match(
                /^Bash\(([A-Za-z0-9_./:@%+=,-]+(?: +[A-Za-z0-9_./:@%+=,-]+)*):\*\)$/,
              )?.[1];
              if (commandPrefix === undefined) {
                entryLines.push(
                  `- Permission ${JSON.stringify(permission)} (${decision}, posture ${primitive.headers.id}) has no native Codex translation and is guidance only.`,
                );
                warnings.push(
                  `Codex posture ${primitive.headers.id}: ${permission} (${decision}) has no native translation; guidance only.`,
                );
                continue;
              }
              commandRules.push({
                pattern: commandPrefix.split(/ +/),
                decision: decision === "deny" ? "forbidden" : "allow",
                justification: `Charter posture ${primitive.headers.id}: ${primitive.headers.description}`,
              });
            }
          }
          break;
        }
        case "sensor": {
          const event = CodexConfig.hookEvents.find((event) => event === primitive.headers.signal);
          if (event === undefined) {
            entryLines.push(
              `- Sensor ${primitive.headers.id}: signal ${primitive.headers.signal} has no Codex hook; it is not installed.`,
            );
            warnings.push(
              `Codex sensor ${primitive.headers.id}: signal ${primitive.headers.signal} is unsupported; no hook was installed.`,
            );
            break;
          }
          if (!sensorHooks.some((hook) => hook.event === event))
            sensorHooks.push({
              event,
              command: `cd -- "$(git rev-parse --show-toplevel)" && cw sensor run ${event} --agent codex`,
              description: `cw sensors: ${event}`,
            });
          break;
        }
        case "skill":
        case "playbook":
          if (primitive.headers["disable-user-invocation"] === true) {
            // Codex has no native switch to hide only explicit invocation.
            // Leave this step in the catalogue, reachable by other playbooks.
            entryLines.push(
              `- ${primitive.headers.id}: ${primitive.composeDescription()} Open ${compiledDocumentLink} when its triggers match or another primitive calls it; do not offer it as a user command.`,
            );
          } else {
            documentComponents.push(
              new CodexSkill(
                "codex",
                primitive.kind,
                primitive.normId,
                { name: primitive.normId, description: primitive.composeDescription() },
                `${pointerText}\n`,
              ),
            );
            if (primitive.headers["disable-model-invocation"] === true)
              documentComponents.push(
                new CodexSkillPolicy(
                  "codex",
                  primitive.kind,
                  primitive.normId,
                  `# ${StampedDocument.stampText}. Do not edit; edit the charter and build again.\npolicy:\n  allow_implicit_invocation: false\n`,
                ),
              );
          }
          break;
        case "agent": {
          const tools = primitive.headers.tools;
          const hasSkills = tools.includes("Skill");
          const hasMcp = tools.some((tool) => tool.startsWith("[[") || tool.startsWith("mcp__"));
          const disabledFeatures = [
            ...(!tools.some((tool) => ["Bash", "exec_command", "shell"].includes(tool)) ? ["shell_tool"] : []),
            ...(!hasMcp ? ["apps"] : []),
            ...(!hasSkills ? ["plugins"] : []),
            ...(!tools.includes("Memory") ? ["memories"] : []),
            ...(!tools.some((tool) => ["RequestPermissions", "request_permissions"].includes(tool))
              ? ["request_permissions_tool"]
              : []),
          ];
          warnings.push(
            `Codex agent ${primitive.headers.id}: feature flags reduce capabilities, but individual tools and MCP servers still inherit the parent scope; the tool whitelist is not fully enforceable.`,
          );
          documentComponents.push(
            new CodexAgent(
              "codex",
              "agent",
              primitive.normId,
              CodexComponentFactory.#composeAgentText(
                primitive.normId,
                primitive.composeDescription(),
                `${pointerText}\nUse only the tools declared in that document. Native feature flags disable capability groups; remaining tools and MCP servers inherit the parent session's permissions.`,
                primitive.modelOf(codexAgent),
                disabledFeatures,
                !hasSkills,
              ),
            ),
          );
          break;
        }
      }
    }
    for (const path of deniedWritePaths) filesystem[path] = "read";
    for (const path of deniedReadPaths) filesystem[path] = "deny";
    if (Object.keys(filesystem).length > 0)
      warnings.push(
        'Codex permissions: profile "cw" is selected by default_permissions. Remove legacy sandbox_mode settings from all active layers; native deny blocks both reading and writing, and glob enforcement depends on the platform.',
      );
    const scopedEntries = [...guideSectionsByFolder]
      .sort(([leftFolder], [rightFolder]) => leftFolder.localeCompare(rightFolder))
      .map(([folderPath, sections]) =>
        CodexComponentFactory.#createEntryFile(
          `## Charter guides\n\nRepository paths below are relative to the git root.\n\n${sections.join("\n\n")}`,
          folderPath,
        ),
      );
    entryLines.push(
      "### Host support",
      `Skills and playbooks are invoked as \`$<name>\` or selected through \`/skills\`. Directory guides are embedded in nested AGENTS.md files, discovered along the root-to-cwd chain; when working from the root, follow the glob instructions above. Supported hooks call \`cw sensor run <signal> --agent codex\`; review and trust hooks with \`/hooks\`. Filesystem permissions use profile \`cw\` where generated; command prefixes use \`${CodexRules.path}\` outside the sandbox. Unsupported permissions remain guidance. Subagent feature flags disable unsupported capability groups, while remaining tools and MCP servers inherit the parent scope. Session token logging and \`cw eval\` currently require Claude Code.`,
    );
    return [
      CodexComponentFactory.#createEntryFile(entryLines.join("\n\n")),
      ...scopedEntries,
      new CodexConfig(CodexComponentFactory.#composeConfigText(sensorHooks, filesystem), warnings),
      ...(commandRules.length === 0
        ? []
        : [
            new CodexRules(
              "codex",
              "charter",
              CodexRules.kind,
              [
                `# ${StampedDocument.stampText}. Do not edit; edit the charter and build again.`,
                ...commandRules.map(
                  (commandRule) =>
                    `prefix_rule(pattern = ${JSON.stringify(commandRule.pattern)}, decision = ${JSON.stringify(commandRule.decision)}, justification = ${JSON.stringify(commandRule.justification)})`,
                ),
                "",
              ].join("\n"),
            ),
          ]),
      ...documentComponents,
    ];
  }

  /** The section for `folderPath`, from the repository's root; the root's is
   *  `""`. One in a folder is the build's alone, and stamped so. */
  static #createEntryFile(document: string, folderPath = ""): CodexEntryFile {
    const sectionText = folderPath === "" ? document : new StampedDocument(document).text.trimEnd();
    return new CodexEntryFile(
      "codex",
      "charter",
      folderPath,
      `<!-- CHERRYWORKS START -->\n${sectionText}\n<!-- CHERRYWORKS END -->\n`,
    );
  }

  /** One subagent's TOML: TOML basic strings take the same escapes as JSON
   *  for these values. */
  static #composeAgentText(
    name: string,
    description: string,
    instructions: string,
    model: string | undefined,
    disabledFeatures: readonly string[],
    isSkillsDisabled: boolean,
  ): string {
    return [
      `# ${StampedDocument.stampText}. Do not edit; edit the charter and build again.`,
      `name = ${JSON.stringify(name)}`,
      `description = ${JSON.stringify(description)}`,
      `developer_instructions = ${JSON.stringify(instructions)}`,
      ...(model === undefined ? [] : [`model = ${JSON.stringify(model)}`]),
      ...(disabledFeatures.length === 0
        ? []
        : ["[features]", ...disabledFeatures.map((feature) => `${feature} = false`)]),
      ...(isSkillsDisabled ? ["[skills]", "include_instructions = false", "[skills.bundled]", "enabled = false"] : []),
      "",
    ].join("\n");
  }

  /** The desired `.codex/config.toml` settings: the mcp server, the
   *  permissions profile where any path is ruled, and the hooks. */
  static #composeConfigText(
    hooks: readonly CodexHook[],
    filesystem: Readonly<Record<string, "read" | "write" | "deny">>,
  ): string {
    const hasPermissions = Object.keys(filesystem).length > 0;
    const absolutePaths = Object.entries(filesystem).filter(([path]) => path.startsWith("/") || path.startsWith("~/"));
    const workspacePaths = Object.fromEntries(
      Object.entries(filesystem).filter(([path]) => !path.startsWith("/") && !path.startsWith("~/")),
    );
    return [
      "project_doc_max_bytes = 1048576", // 1 MiB of project instructions.
      "",
      ...(hasPermissions ? ['default_permissions = "cw"', ""] : []),
      "[mcp_servers.cw]",
      'command = "cw"',
      'args = ["mcp", "serve"]',
      ...(hasPermissions
        ? [
            "",
            "[permissions.cw]",
            'extends = ":workspace"',
            ...(absolutePaths.length === 0
              ? []
              : [
                  "[permissions.cw.filesystem]",
                  ...absolutePaths
                    .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
                    .map(([path, access]) => `${JSON.stringify(path)} = ${JSON.stringify(access)}`),
                ]),
            '[permissions.cw.filesystem.":workspace_roots"]',
            ...Object.entries({ ".": "write", ...workspacePaths })
              .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
              .map(([path, access]) => `${JSON.stringify(path)} = ${JSON.stringify(access)}`),
          ]
        : []),
      ...hooks.flatMap((hook) => [
        "",
        `[[hooks.${hook.event}]]`,
        `[[hooks.${hook.event}.hooks]]`,
        'type = "command"',
        `command = ${JSON.stringify(hook.command)}`,
        `statusMessage = ${JSON.stringify(hook.description)}`,
      ]),
      "",
    ].join("\n");
  }

  private constructor() {}
}
