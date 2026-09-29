import type { CharterOutput } from "../models/output/CharterOutput.js";
import type { Projection } from "../models/output/ProjectionPolicy.js";
import { claudeComponentProjection } from "./providers/claude.js";
import type { ClaudeComponent } from "../models/output/providers/claude/ClaudeComponent.js";

import type { AgentProvider } from "../models/AgentProvider.js";
import { CLAUDE_ENTRY_FILE, OUT_DIRECTORY } from "../path.js";

/**
 * Every file one reading of a charter is put down as (FR-020, FR-021).
 *
 * The one place an output becomes a path and the text of a file. The listing is
 * two files, because it is read twice over by different readers for different
 * reasons (FR-011, FR-012); everything else is one. The three that every reader
 * shares land in the workspace's own output folder, beside one another — which
 * is why `CHARTER.md` can send a reader to the listings by name.
 *
 * The agents are asked of the caller rather than read off the output, because one
 * file is a host's own and no primitive of the charter's: the file that host reads
 * unasked (FR-051). What compiling produces is the charter's, so which hosts this
 * repository answers for stays out of it (FR-033).
 */
export function charterOutputProjection(
  output: CharterOutput,
  agentProviders: readonly AgentProvider[],
): readonly Projection[] {
  return [
    // Indented: this one is committed and read in diffs, and a listing whose
    // entries land one per line says what changed in the charter rather than
    // that the listing changed.
    {
      path: `${OUT_DIRECTORY}/catalog.json`,
      contents: `${JSON.stringify(output.catalogue.full, undefined, 2)}\n`,
      projectionPolicy: output.catalogue.projection,
    },
    // Not indented: this one is read to be surveyed cheaply, and the whitespace
    // is bytes an agent pays for and no one reads (SC-005).
    {
      path: `${OUT_DIRECTORY}/catalog.min.json`,
      contents: `${JSON.stringify(output.catalogue.compact)}\n`,
      projectionPolicy: output.catalogue.projection,
    },
    // Indented for the reason the full listing is: committed, and read in
    // diffs when a place moves (SC-038).
    {
      path: `${OUT_DIRECTORY}/mcp-origins.json`,
      contents: `${JSON.stringify({ origins: output.mcpOrigins }, undefined, 2)}\n`,
      projectionPolicy: "replace",
    },
    {
      path: `${OUT_DIRECTORY}/CHARTER.md`,
      contents: output.charterMd.toStampedDocument(),
      projectionPolicy: output.charterMd.projection,
    },
    // Each primitive lands where the catalogue sends an agent for it, so the
    // file named and the file written are one (FR-140).
    ...output.catalogue.full.flatMap(({ identity, file }) => {
      const compiledPrimitive = output.compiledPrimitives.find((one) => one.identity === identity);
      return compiledPrimitive === undefined
        ? []
        : [{ path: file, contents: compiledPrimitive.toStampedDocument(), projectionPolicy: compiledPrimitive.projection }];
    }),
    ...agentProviders.map(entryFileProjection),
    ...output.providerComponents.map(claudeComponentProjection),
  ];
}

/**
 * The one line that gets the charter read at all: the section this charter keeps
 * in the file one host reads before it is asked to read anything (FR-051).
 *
 * Everything else a host reads is under a folder of its own, and it opens none of
 * it until something has sent it there — so a charter could be compiled, written
 * and never read. This is that something: where the orientation is, and nothing
 * else. It says the same thing for every charter, so it costs the same on every
 * turn however much the charter grows (SC-005). No primitive's body is in it, not
 * one line: what every turn is to carry is a rule of the host's, which is where a
 * guide already lands.
 *
 * That file is the repository's and not this charter's — somebody wrote it, and
 * another tool may keep a section of its own in it — so this is the one output
 * written into a file by section, and everything outside that section is left as
 * it was. Which is also why it carries no stamp: a stamp says the whole file is
 * generated, and this file is not.
 *
 * What the section says is one text for every host; which file it lands in is
 * that host's own.
 */
function entryFileProjection(provider: AgentProvider): Projection {
  // One text and not one per host, because there is one thing to say: where the
  // orientation is. Which file it lands in is the whole of what differs, and the
  // orientation is the same file for all of them (FR-019).
  //
  // The first line and the last are the marker the next build finds this section
  // by; between them is one blank line to a paragraph, the way the rest of such a
  // file is written. Where the orientation is is written from the repository,
  // which is where the file holding this section sits: `.cw/out/` is under the
  // repository and so is every entry file named here, so the one path reads the
  // same in all of them.
  const contents = `<!-- CHERRYWORKS START -->\n${[
    "## Charter",
    `This repository is governed by a charter. Read [CHARTER.md](./${OUT_DIRECTORY}/CHARTER.md) before anything else here, and work under what it says.`,
    "It is generated from the charter under `.cw/charter/`: do not edit it, edit the primitive behind it.",
  ].join("\n\n")}\n<!-- CHERRYWORKS END -->\n`;

  // One arm per host, and the set is closed: a host whose entry file is not named
  // here is one the charter would never reach.
  let path: string;
  switch (provider) {
    case "claude":
      path = CLAUDE_ENTRY_FILE;
      break;
  }

  return { path, contents, projectionPolicy: "upsertWithMarker" };
}
