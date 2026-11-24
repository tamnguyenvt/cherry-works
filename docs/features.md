# Features

## Core — the engine, command line and portal

- Author a charter of primitives — guide, sensor, skill, playbook, agent, posture, corpus, mixin, mcp, script and template — each a folder with its `index.md` and its assets
- Create, edit and delete a primitive from the command line or the portal, asking each kind what it requires
- Build the charter into what Claude Code and Codex read, with a preview, and check the repository's health
- List, search and explain the charter's primitives, grouped by kind
- Set a repository up for the agents it chooses, with or without git
- Write and run self-regression tests of the charter, in CI too
- Fire every sensor of a signal through one `cw run sensor` command
- Keep a skill out of the user's commands, or out of the agent's own reach
- Declare where knowledge lives once as an mcp origin, sign in to it as yourself, and reach every one through one `cw run mcp` server
- Hold a subagent to the mcp origins it lists
- Point any primitive at another, a script or a template by its id
- Read every answer of `cw` laid out at a terminal, or as data with `--json`
- Mention another primitive by typing `[[` in the portal
- Install `cw` with one command, know which one runs, and publish releases users can trust

## Eval — what a charter costs and whether it works

- See what the charter loads into the agent's main context, estimated and counted
- Be told what a session used when the agent stops, and read the sessions back
- Evaluate the charter against the real agent under promptfoo

## SDK — the engine as a package integrators build on

- Import the engine as a library, composed from `cw`'s own adapters and one's own, every failure answered as a DTO

## Charters — authoring, pulling and releasing them

- Install, pull, fork, update and remove charters from a charter source
- Release charters from any repository with `/charter-release`
