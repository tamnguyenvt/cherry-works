import type { AgentProvider } from "../models/AgentProvider.js";
import { normalizedIdentityOf, PRIMITIVE_CLASSES } from "../models/charter/primitive/Primitive.js";
import { Catalogue, CharterMd, CompiledPrimitive, type CharterOutput, type McpOrigin } from "../models/output/CharterOutput.js";
import { OUT_DIRECTORY } from "../path.js";
import type { CharterRoot, ScopedPrimitive } from "../models/charter/CharterRoot.js";
import { AgentPrimitive } from "../models/charter/primitive/AgentPrimitive.js";
import { CommandPrimitive } from "../models/charter/primitive/CommandPrimitive.js";
import { GuidePrimitive } from "../models/charter/primitive/GuidePrimitive.js";
import { PlaybookPrimitive } from "../models/charter/primitive/PlaybookPrimitive.js";
import { PosturePrimitive } from "../models/charter/primitive/PosturePrimitive.js";
import { SensorPrimitive } from "../models/charter/primitive/SensorPrimitive.js";
import { SkillPrimitive } from "../models/charter/primitive/SkillPrimitive.js";
import { MCP_AUTHS, McpPrimitive } from "../models/charter/primitive/McpPrimitive.js";
import type { ClaudeComponent } from "../models/output/providers/claude/ClaudeComponent.js";
import {
  ClaudeSettingsComponent,
  isClaudeHookEvent,
  type ClaudeHookEvent,
  type ClaudeSettings,
} from "../models/output/providers/claude/ClaudeSettingsComponent.js";
import { ClaudeAgentComponent } from "../models/output/providers/claude/document-based-components/ClaudeAgentComponent.js";
import { ClaudeCommandComponent } from "../models/output/providers/claude/document-based-components/ClaudeCommandComponent.js";
import { ClaudeRuleComponent } from "../models/output/providers/claude/document-based-components/ClaudeRuleComponent.js";
import { ClaudeSkillComponent } from "../models/output/providers/claude/document-based-components/ClaudeSkillComponent.js";

/**
 * Everything one reading of a charter compiles to (FR-021).
 *
 * Models and nothing else. What every reader of the charter gets is in it
 * whether an agent is installed or not — the listing, and the file that orients
 * a reader to it (FR-019); what the agents this repository runs get is each
 * primitive in that host's own kinds (FR-018).
 *
 * The whole of what this does is reading primitives into the parameters those
 * models take — the neutral ones here, and each host's in `compile<Host>.ts`
 * beside this: a `guide` becomes a claude skill there and nowhere in the
 * charter, and the charter does not know any of these exist. A model holds what
 * its file says and answers for how it is written; putting it somewhere is the
 * projection's.
 *
 * There is no exported path that produces one of these without the rest, which
 * is the whole of SC-004 — a caller asks what the charter compiles to and gets
 * all of it or none.
 *
 * What is wrong with the charter is not asked here. A charter that has faults
 * still compiles to something, and whether that something may be written is
 * `everythingWrong` answered by whoever is about to write (FR-009).
 */
export function compile(charter: CharterRoot, agents: readonly AgentProvider[]): CharterOutput {
  return {
    // What an agent opens from the catalogue is the primitive as it compiled,
    // not the file its author wrote: the whole body in one place, under the
    // output folder whichever layer brought it (FR-140). The catalogue is where
    // this path is said; the projection reads it from there.
    catalogue: catalogueOf(charter, (one) => `${OUT_DIRECTORY}/${one.primitive.kind}/${one.primitive.headers.id}.md`),
    charterMd: CharterMd.of(PRIMITIVE_CLASSES),
    compiledPrimitives: charter.primitives.map((one) =>
      CompiledPrimitive.of(one.identity, one.primitive.toMarkdown(charter.bodyOf(one))),
    ),
    mcpOrigins: mcpOriginsOf(charter),
    providerComponents: agents.flatMap((agent) => forAgent(agent, charter)),
  };
}

/**
 * Every primitive of the charter, listed under the file a reader is sent to for
 * its body (FR-011).
 *
 * Two readers, two files. The catalogue a build writes sends an agent to the
 * compiled primitive; the listing a person asks for sends them to the file they
 * would edit, which is also what says which layer it came from (FR-140). Which
 * is the caller's to say, and everything else an entry holds is the same.
 *
 * A header nobody wrote is left out rather than listed as nothing: a listing
 * says what the author declared.
 */
export function catalogueOf(charter: CharterRoot, fileOf: (one: ScopedPrimitive) => string): Catalogue {
  return Catalogue.of(
    charter.primitives.map((one) => {
      const { id, description, tags, globs, rationale, mixins, mcps } = one.primitive.headers;
      return {
        identity: one.identity,
        kind: one.primitive.kind,
        id,
        description,
        file: fileOf(one),
        ...(tags === undefined ? {} : { tags }),
        ...(globs === undefined ? {} : { globs }),
        ...(rationale === undefined ? {} : { rationale }),
        ...(mixins === undefined ? {} : { mixins }),
        ...(mcps === undefined ? {} : { mcps }),
      };
    }),
  );
}

/**
 * Every place the charter's mcps reach, each once, whichever layer declared it
 * (FR-145).
 *
 * One per address and `path`: the repository and a vendor may call one place
 * by two names, and it is one place under both. What is held is where it is and
 * how it is signed in to — every way any identity there allows — and nothing
 * an mcp's own file already says.
 */
function mcpOriginsOf(charter: CharterRoot): readonly McpOrigin[] {
  const mcpsByKey = new Map<string, { identity: string; primitive: McpPrimitive }[]>();
  for (const { identity, primitive } of [...charter.primitives].sort((one, another) => (one.identity < another.identity ? -1 : 1))) {
    if (primitive.kind !== McpPrimitive.kind) continue;
    // Joined by a character neither side can hold: a path is one line, and an
    // address is an endpoint or a command line.
    const key = `${primitive.address}\n${primitive.headers.path ?? ""}`;
    mcpsByKey.set(key, [...(mcpsByKey.get(key) ?? []), { identity, primitive }]);
  }

  return [...mcpsByKey.entries()]
    .sort(([oneKey], [anotherKey]) => (oneKey < anotherKey ? -1 : 1))
    .map(([, mcpsAtOrigin]) => {
      const [firstMcp] = mcpsAtOrigin as [(typeof mcpsAtOrigin)[number], ...typeof mcpsAtOrigin];
      const { endpoint, command, args = [], path } = firstMcp.primitive.headers;
      const tokenEnv = mcpsAtOrigin.find((one) => one.primitive.headers.tokenEnv !== undefined)?.primitive.headers.tokenEnv;
      const auths = new Set(mcpsAtOrigin.flatMap((one) => one.primitive.headers.auth ?? []));

      return {
        identities: mcpsAtOrigin.map((one) => one.identity),
        address: firstMcp.primitive.address,
        ...(endpoint === undefined ? {} : { endpoint }),
        ...(command === undefined ? {} : { command: { command, args, ...(tokenEnv === undefined ? {} : { tokenEnv }) } }),
        ...(path === undefined ? {} : { path }),
        auth: MCP_AUTHS.filter((auth) => auths.has(auth)),
      };
    });
}

/** Every file one agent this engine compiles for reads (FR-018). One arm per
 *  host, so a second host is a case here, a compiler beside this and a folder of
 *  its own under `output/providers/` (plan §2.6). */
function forAgent(agent: AgentProvider, charter: CharterRoot): readonly ClaudeComponent[] {
  switch (agent) {
    case "claude":
      return compileClaude(charter);
  }
}

/**
 * Every file claude reads of this charter (FR-018).
 *
 * Two passes, because this host reads two kinds of file. What lands in its
 * settings lands in one file whatever asked for it, so every primitive that asks
 * is read together and compiles to one fragment; everything else is a document
 * of its own, one per primitive.
 *
 * Not one for one, either way. A `skill` and a `playbook` are two things in a
 * charter and one thing here, because this host has one mechanism for a body
 * loaded when the request calls for it; a `guide` is a rule, brought up by the
 * files it names or carried on every turn where it names none. What the charter kept apart, the listing
 * keeps apart (FR-011); what the host cannot tell apart, it is not told.
 *
 * Three kinds project nothing. A `corpus` is cited rather than loaded, a
 * `mixin` has no life of its own — its body is written into each host that pulls it in, which
 * `bodyOf` does and this is the only caller of — and an `mcp` is reached through
 * `cw mcp serve` rather than read.
 */
export function compileClaude(charter: CharterRoot): readonly ClaudeComponent[] {
  const asSettings = charter.primitives.filter(isSettingComponent);
  const asDocuments = charter.primitives.filter((one) => !isSettingComponent(one));

  return [
    ...(asSettings.length === 0 ? [] : [ClaudeSettingsComponent.of(claudeSettingsOf(asSettings))]),
    ...asDocuments.flatMap((one) => claudeDocumentComponentOf(charter, one) ?? []),
  ];
}

/** Does this primitive ask something of the settings this host runs on, rather
 *  than compile to a file of its own? A posture says what may be run, a sensor
 *  what runs when an event fires, and this host reads both out of one file. */
function isSettingComponent(one: ScopedPrimitive): boolean {
  return one.primitive.kind === PosturePrimitive.kind || one.primitive.kind === SensorPrimitive.kind;
}

/**
 * Everything this charter asks of the settings this host runs on, read together
 * (FR-018).
 *
 * One fragment for the whole charter, because the host keeps one such file: every
 * posture's permissions are the permissions, each thing once, and every sensor's
 * command is a hook under the event that fires it. Two sensors on one event are
 * two commands under it, in the order their files sort in (SC-007).
 *
 * What the repository set for itself is not here at all: that is on disk, and
 * reading it together with this is the projection's (FR-020).
 */
function claudeSettingsOf(ones: readonly ScopedPrimitive[]): ClaudeSettings {
  const allow = new Set<string>();
  const deny = new Set<string>();
  const hooks: Partial<Record<ClaudeHookEvent, { hooks: { type: "command"; command: string }[] }[]>> = {};

  for (const one of ones) {
    if (one.primitive.kind === PosturePrimitive.kind) {
      const headers = one.primitive.headers;
      for (const permission of headers.allow) allow.add(permission);
      for (const permission of headers.deny) deny.add(permission);
    }
    if (one.primitive.kind === SensorPrimitive.kind) {
      const { signal, run } = one.primitive.headers;
      // A signal this host raises nothing for compiles to nothing: writing it
      // would be a hook that never fires, and the charter still names the event
      // for whichever host does raise it.
      if (isClaudeHookEvent(signal))
        hooks[signal] = [...(hooks[signal] ?? []), { hooks: [{ type: "command", command: run }] }];
    }
  }

  return {
    ...(allow.size === 0 && deny.size === 0 ? {} : { permissions: { allow: [...allow], deny: [...deny] } }),
    ...(Object.keys(hooks).length === 0 ? {} : { hooks }),
  };
}

/**
 * Which document of this host a charter primitive becomes, or nothing where this
 * host has no kind for it.
 */
function claudeDocumentComponentOf(charter: CharterRoot, sc: ScopedPrimitive): ClaudeComponent | undefined {
  // The kind stays in the name, because two charter kinds can land in one
  // directory there — `guide:no-any` and `skill:no-any` are two primitives and
  // must stay two files (FR-014).
  const name = normalizedIdentityOf(sc.identity);
  const body = charter.bodyOf(sc);

  switch (sc.primitive.kind) {
    // A guide is a rule this host loads into context whole: when a file it names
    // is touched, which is what `paths` on a rule does, and at the start of every
    // session where it names none (FR-013). Under the identity it is changed by,
    // so a reader who wants it changed is sent to the primitive rather than
    // editing what the next build overwrites (FR-017, FR-020).
    case GuidePrimitive.kind: {
      const { globs = [] } = sc.primitive.headers;
      return ClaudeRuleComponent.of(
        name,
        globs.length === 0 ? {} : { paths: globs },
        `${[`## ${sc.identity}`, body].join("\n\n")}\n`,
      );
    }
    // for command, remove kind prefix so user just types /do-something instead of /command-do-something
    case CommandPrimitive.kind:
      return ClaudeCommandComponent.of(name.replace(`${CommandPrimitive.kind}-`, ""), { description: sc.primitive.description() }, body);
    case AgentPrimitive.kind: {
      const { tools } = sc.primitive.headers;
      return ClaudeAgentComponent.of(name, { description: sc.primitive.description(), tools: tools.join(", ") }, body);
    }
    // One kind of this host for the two the charter loads when the request calls
    // for them: what decides that the body is worth opening is the description,
    // because that line is all this host reads before deciding (FR-013), and
    // composing it is the primitive's.
    case SkillPrimitive.kind:
    case PlaybookPrimitive.kind:
      return ClaudeSkillComponent.of(name, { description: sc.primitive.description() }, body);
    default:
      return undefined;
  }
}

