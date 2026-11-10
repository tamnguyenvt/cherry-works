import { Catalogue, CharterFolder, CharterMd, StampedDocument, type CharterOutput, type CharterRoot } from "#module/charter/module.js";
import { laidTextOf } from "#module/charter/module.js";
import { type CodexComponent, CodexComponents } from "./codex-component.js";
import { CodexEntryFile } from "./codex-entry-file.js";
import { CodexSkill } from "./codex-skill.js";
import { CodexSkillPolicy } from "./codex-skill-policy.js";
import { CodexAgent } from "./codex-agent.js";
import { CodexConfig, type CodexHook } from "./codex-config.js";
import { CodexRules, type CodexCommandRule } from "./codex-rules.js";

/** Makes every file this engine puts down for Codex. */
export class CodexComponentFactory {
  /** Translate charter activation, execution permissions and sensors into the
   * host's native surfaces. Claude permission syntax is translated only where
   * a literal command prefix has the same scope as a Codex execution rule. */
  static create(charter: CharterRoot, charterOutput: CharterOutput): readonly CodexComponent[] {
    const codexAgent = CodexComponents.agentProvider;
    const compiledPrimitiveById = new Map(charterOutput.compiledPrimitives.map((compiledPrimitive) => [compiledPrimitive.id, compiledPrimitive]));
    const entryLines = [
      "## Charter",
      `Read and follow [${laidTextOf(CharterMd.outputPart.linkOf())}](${CharterMd.outputPart.linkOf()}) before working here. Edit the primitives under \`${CharterFolder.path}/\`, then run \`cw build\`; generated files are not edited by hand.`,
      `Find primitives in [catalogue.json](${Catalogue.outputPartOf().linkOf()}) and [catalogue.codex.json](${Catalogue.outputPartOf(codexAgent).linkOf()}).`,
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
      const compiledDocumentLink = laidTextOf(compiledPrimitive.outputPart.linkOf());
      const pointerText = `Read and follow ${compiledDocumentLink}.`;
      switch (primitive.kind) {
        case "guide": {
          const { globs = [] } = primitive.headers;
          const guideFolders = new Set<string>();
          if (globs.length > 0) {
            entryLines.push(`- When touching a file matching ${globs.map((glob) => JSON.stringify(glob)).join(", ")}: ${pointerText}`);
            for (const glob of globs) {
              const segments = glob.replace(/^\.\//, "").split("/");
              const folderSegments: string[] = [];
              for (const segment of segments.slice(0, -1)) {
                if (/[*?{}[\]!]/.test(segment)) break;
                if (segment === "" || segment === "." || segment === "..") break;
                folderSegments.push(segment);
              }
              const folder = folderSegments.join("/");
              if (folder === ".git" || folder.startsWith(".git/") || folder === ".cw" || folder.startsWith(".cw/")) {
                warnings.push(`Codex guide ${primitive.headers.id}: cannot generate an AGENTS.md inside ${folder}; kept the root instruction.`);
                continue;
              }
              guideFolders.add(folder);
            }
          } else guideFolders.add("");
          for (const folder of guideFolders) {
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
                return markdown.replace(`(${linkTarget})`, `(${compiledPrimitive.outputPart.linkOf(linkTarget)})`);
              },
            );
            const section = `#### ${primitive.headers.id}${globs.length === 0 ? " — every turn" : ""}\n\n${globs.length === 0 ? "" : `Applies only to repository paths matching: ${globs.map((glob) => JSON.stringify(glob)).join(", ")}.\n\n`}Source: [${compiledDocumentLink}](${compiledPrimitive.outputPart.linkOf()}).\n\n${rootGuideBody.trimEnd()}`;
            if (folder === "") entryLines.push(section);
            else guideSectionsByFolder.set(folder, [...(guideSectionsByFolder.get(folder) ?? []), section]);
          }
          break;
        }
        case "posture": {
          entryLines.push(`- Always: ${pointerText} Command prefix rules apply outside the sandbox; sandbox and approval settings are configured separately.`);
          for (const decision of ["allow", "deny"] as const) {
            for (const permission of primitive.headers[decision]) {
              const filePermission = permission.match(/^(Read|Write|Edit)\(([^)]+)\)$/);
              const barePath = !/[()\s]/.test(permission) && /[./*?]/.test(permission) ? permission : undefined;
              if (filePermission !== null || barePath !== undefined) {
                const tool = filePermission?.[1];
                const path = (filePermission?.[2] ?? barePath)!.replace(/^\.\//, "");
                if (path !== "" && (barePath !== undefined || (!path.startsWith("/") && !path.startsWith("~"))) && !path.split("/").includes("..")) {
                  if (decision === "deny") (tool === "Read" || barePath !== undefined ? deniedReadPaths : deniedWritePaths).add(path);
                  else if (filesystem[path] !== "write") filesystem[path] = tool === "Read" ? "read" : "write";
                  continue;
                }
              }
              // Exact commands cannot become prefixes without broadening access.
              // Reject shell syntax, quoting and globs rather than guessing how
              // a shell would tokenize them or granting a wider prefix.
              const commandPrefix = permission.match(/^Bash\(([A-Za-z0-9_./:@%+=,-]+(?: +[A-Za-z0-9_./:@%+=,-]+)*):\*\)$/)?.[1];
              if (commandPrefix === undefined) {
                entryLines.push(`- Permission ${JSON.stringify(permission)} (${decision}, posture ${primitive.headers.id}) has no native Codex translation and is guidance only.`);
                warnings.push(`Codex posture ${primitive.headers.id}: ${permission} (${decision}) has no native translation; guidance only.`);
                continue;
              }
              commandRules.push({ pattern: commandPrefix.split(/ +/), decision: decision === "deny" ? "forbidden" : "allow", justification: `Charter posture ${primitive.headers.id}: ${primitive.headers.description}` });
            }
          }
          break;
        }
        case "sensor": {
          const event = CodexConfig.hookEvents.find((event) => event === primitive.headers.signal);
          if (event === undefined) {
            entryLines.push(`- Sensor ${primitive.headers.id}: signal ${primitive.headers.signal} has no Codex hook; it is not installed.`);
            warnings.push(`Codex sensor ${primitive.headers.id}: signal ${primitive.headers.signal} is unsupported; no hook was installed.`);
            break;
          }
          if (!sensorHooks.some((hook) => hook.event === event))
            sensorHooks.push({ event, command: `cd -- "$(git rev-parse --show-toplevel)" && cw sensor run ${event} --agent codex`, description: `cw sensors: ${event}` });
          break;
        }
        case "skill":
        case "playbook":
          if (primitive.headers["disable-user-invocation"] === true) {
            // Codex has no native switch to hide only explicit invocation.
            // Leave this step in the catalogue, reachable by other playbooks.
            entryLines.push(`- ${primitive.headers.id}: ${primitive.description()} Open ${compiledDocumentLink} when its triggers match or another primitive calls it; do not offer it as a user command.`);
          } else {
            documentComponents.push(CodexSkill.of(primitive.kind, primitive.normId, primitive.description(), `${pointerText}\n`));
            if (primitive.headers["disable-model-invocation"] === true)
              documentComponents.push(CodexSkillPolicy.of(primitive.kind, primitive.normId));
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
            ...(!tools.some((tool) => ["RequestPermissions", "request_permissions"].includes(tool)) ? ["request_permissions_tool"] : []),
          ];
          warnings.push(`Codex agent ${primitive.headers.id}: feature flags reduce capabilities, but individual tools and MCP servers still inherit the parent scope; the tool whitelist is not fully enforceable.`);
          documentComponents.push(CodexAgent.of(primitive.normId, primitive.description(), `${pointerText}\nUse only the tools declared in that document. Native feature flags disable capability groups; remaining tools and MCP servers inherit the parent session's permissions.`, primitive.modelOf(codexAgent), disabledFeatures, !hasSkills));
          break;
        }
      }
    }
    for (const path of deniedWritePaths) filesystem[path] = "read";
    for (const path of deniedReadPaths) filesystem[path] = "deny";
    if (Object.keys(filesystem).length > 0)
      warnings.push('Codex permissions: profile "cw" is selected by default_permissions. Remove legacy sandbox_mode settings from all active layers; native deny blocks both reading and writing, and glob enforcement depends on the platform.');
    const scopedEntries = [...guideSectionsByFolder].sort(([first], [second]) => first.localeCompare(second)).map(([folder, sections]) => CodexEntryFile.of(`## Charter guides\n\nRepository paths below are relative to the git root.\n\n${sections.join("\n\n")}`, folder));
    entryLines.push("### Host support", `Skills and playbooks are invoked as \`$<name>\` or selected through \`/skills\`. Directory guides are embedded in nested AGENTS.md files, discovered along the root-to-cwd chain; when working from the root, follow the glob instructions above. Supported hooks call \`cw sensor run <signal> --agent codex\`; review and trust hooks with \`/hooks\`. Filesystem permissions use profile \`cw\` where generated; command prefixes use \`${CodexRules.path}\` outside the sandbox. Unsupported permissions remain guidance. Subagent feature flags disable unsupported capability groups, while remaining tools and MCP servers inherit the parent scope. Session token logging and \`cw eval\` currently require Claude Code.`);
    return [CodexEntryFile.of(entryLines.join("\n\n")), ...scopedEntries, CodexConfig.of(sensorHooks, filesystem, warnings), ...(commandRules.length === 0 ? [] : [CodexRules.of(commandRules)]), ...documentComponents];
  }

  private constructor() {}
}
