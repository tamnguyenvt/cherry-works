/*
 * A repository holding a primitive of every kind, built for both hosts, with
 * files of its own in what a build shares with it and files an earlier build
 * left: what CORE-SC-063 compares, file by file, with what a build wrote before
 * the charter was laid by a projection.
 */

const repo = new URL("file:///repo/");
const at = (path: string) => new URL(path, repo).href;
const primitiveText = (headers: readonly string[], body: string) => ["---", ...headers, "---", "", body, ""].join("\n");

export const charterOfEveryKind: Readonly<Record<string, string | Uint8Array>> = {
  [at(".cw/settings.json")]: '{"agents":["claude","codex"]}',
  [at(".cw/charter/primitive/guide/general/index.md")]: primitiveText(
    ["kind: guide", "id: general", "description: Applies on every turn."],
    "Follow [[ship]] and `reviewer`, and see [the diagram](./diagram.md#top), [the photo](./ảnh mới.md) and [a mark](./a⦄b.md).",
  ),
  [at(".cw/charter/primitive/guide/general/diagram.md")]: "A diagram.\n",
  [at(".cw/charter/primitive/guide/general/ảnh mới.md")]: "A photo.\n",
  [at(".cw/charter/primitive/guide/types/index.md")]: primitiveText(
    ["kind: guide", "id: types", "description: Types in the source.", 'globs: ["src/**/*.ts"]', 'mixins: ["voice"]'],
    "Type everything; ask [[team/review]].",
  ),
  [at(".cw/charter/primitive/guide/acme/style/index.md")]: primitiveText(
    ["kind: guide", "id: acme/style", "description: How guides read.", 'globs: ["docs/guides/*.md"]'],
    "Write short lines, as [the voice](../../../mixin/voice/index.md) says.",
  ),
  [at(".cw/charter/primitive/mixin/voice/index.md")]: primitiveText(
    ["kind: mixin", "id: voice", "description: How to speak."],
    "Speak plainly.",
  ),
  [at(".cw/charter/primitive/skill/team/review/index.md")]: primitiveText(
    [
      "kind: skill",
      "id: team/review",
      "description: Review a change.",
      'triggers: ["review"]',
      "disable-model-invocation: true",
    ],
    "Review it, then run [[check]].",
  ),
  [at(".cw/charter/primitive/playbook/ship/index.md")]: primitiveText(
    ["kind: playbook", "id: ship", "description: Ship a release.", 'triggers: ["ship"]', 'mixins: ["voice"]'],
    "Run [[check]], fill [[pr]], then [[team/review]].",
  ),
  [at(".cw/charter/primitive/skill/step/index.md")]: primitiveText(
    [
      "kind: skill",
      "id: step",
      "description: A step of shipping.",
      'triggers: ["step"]',
      "disable-user-invocation: true",
    ],
    "One step.",
  ),
  [at(".cw/charter/primitive/agent/reviewer/index.md")]: primitiveText(
    [
      "kind: agent",
      "id: reviewer",
      "description: Reviews a change.",
      'tools: ["Read", "[[local]]"]',
      "model: claude:sonnet",
    ],
    "Read the change and say what is wrong.",
  ),
  [at(".cw/charter/primitive/mcp/local/index.md")]: primitiveText(
    ["kind: mcp", "id: local", "description: A local mcp origin.", "command: node", "tools: [echo]"],
    "Echo what it is given.",
  ),
  [at(".cw/charter/primitive/posture/safe/index.md")]: primitiveText(
    [
      "kind: posture",
      "id: safe",
      "description: What may run.",
      'allow: ["Bash(pnpm test:*)", "Read(src/**)"]',
      'deny: ["Bash(rm:*)", "Write(.env)"]',
    ],
    "Run tests, never remove.",
  ),
  [at(".cw/charter/primitive/sensor/lint/index.md")]: primitiveText(
    ["kind: sensor", "id: lint", "description: Lint on stop.", "signal: Stop", 'run: "node [[check]]"'],
    "Lint what changed.",
  ),
  [at(".cw/charter/primitive/script/check/index.md")]: primitiveText(
    ["kind: script", "id: check", "description: Checks a release.", "executionPath: ./run.sh"],
    "Run ./run.sh.",
  ),
  [at(".cw/charter/primitive/script/check/run.sh")]: "#!/bin/sh\necho checked\n",
  [at(".cw/charter/primitive/script/check/logo.png")]: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x10]),
  [at(".cw/charter/primitive/template/pr/index.md")]: primitiveText(
    ["kind: template", "id: pr", "description: A pull request."],
    "## What\n\n  - indented, as the author wrote it",
  ),
  [at(".cw/charter/primitive/corpus/terms/index.md")]: primitiveText(
    ["kind: corpus", "id: terms", "description: The terms."],
    "A term is a word.",
  ),
  // What the repository wrote itself, in the files a build shares with it.
  [at("CLAUDE.md")]: "# The repository's own\n\nKeep this.\n",
  [at("AGENTS.md")]: "# The repository's own\n\nKeep this too.\n",
  [at(".claude/settings.json")]: '{\n  "model": "opus",\n  "permissions": {\n    "allow": ["Bash(ls)"]\n  }\n}\n',
  [at(".mcp.json")]: '{\n  "mcpServers": {\n    "own": { "command": "own" }\n  }\n}\n',
  [at(".codex/config.toml")]: 'model = "gpt-5"\n\n[mcp_servers.own]\ncommand = "own"\n',
  [at(".claude/skills/handmade/SKILL.md")]: "A skill of the repository's own.\n",
  // What an earlier build left that this one no longer writes.
  [at(".cw/out/guide/gone/index.md")]: "Gone.\n",
  [at(".claude/rules/gone.md")]:
    "Gone.\n\n<!-- Generated by cherry-works. Do not edit; edit the charter and build again. -->\n",
  [at("old/AGENTS.md")]:
    "<!-- CHERRYWORKS START -->\nGone.\n\n<!-- Generated by cherry-works. Do not edit; edit the charter and build again. -->\n<!-- CHERRYWORKS END -->\n",
};
