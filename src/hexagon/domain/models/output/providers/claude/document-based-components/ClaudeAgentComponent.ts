import { DocumentBasedComponent } from "./DocumentBasedComponent.js";

/** A subagent's frontmatter: the name this host spawns it by, the line it is
 *  described by, and the tools it holds — comma-separated, the way this host
 *  reads them. */
export interface ClaudeAgentHeaders {
  readonly name: string;
  readonly description: string;
  readonly tools: string;
}

/** What a subagent is compiled with, its name aside: that is what the component
 *  is called, and this host reads it out of the frontmatter as well. */
export type ClaudeAgentDeclared = Omit<ClaudeAgentHeaders, "name">;

/**
 * A subagent: a role claude spawns by name, holding the tools its
 * frontmatter lists and nothing else.
 *
 * A charter `agent` compiles to one. The tools are written comma-separated on
 * one line, which is how this host reads them — the one place a charter list
 * stops being a list.
 */
export class ClaudeAgentComponent extends DocumentBasedComponent<ClaudeAgentHeaders> {
  static readonly kind = "agent" as const;
  readonly kind = ClaudeAgentComponent.kind;

  static of(name: string, declared: ClaudeAgentDeclared, body: string): ClaudeAgentComponent {
    return new ClaudeAgentComponent(name, { name, ...declared }, body);
  }
}
