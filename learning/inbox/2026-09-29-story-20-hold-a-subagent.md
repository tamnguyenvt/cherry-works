# Story 20: what surprised us (2026-09-29)

## An author writes only the charter's names, never a host's

Tam: users know the charter and nothing of what it compiles to. Do not make an
author write `mcp__cw__mfbs_1f3c__list_payments`, or any other host name,
anywhere in a primitive. They write the charter's own name, for example
`mcp:mfbs/payments:list_payments`, and the build turns it into the host's name.
An example that shows a host name to an author is a design smell, even inside
an explanation.

## A narrowing flag that has to be explained is cut

`cw mcp serve --enable` was specified (FR-155), built and tested, then dropped
on review. It was not natural, and it needed an explanation before anyone
understood it. Tam's reasoning: a headless job that is never signed in to a
place cannot call that place, so the job is already safe with no flag at all.
Before building a knob, ask whether an existing boundary (here, sign-in)
already gives the safety it promises.

## An agent holds what its `tools` lists, and nothing else

The first cut added a place's tools to a subagent whenever its body mentioned
`mcp:<id>`. Tam chose instead to let only the header decide, which matches the
kind's own `activatesWhen`. A mention in the body is only text. A listed place
the charter does not hold, or a tool that place does not declare, is an error
that stops the build, the same as a mixin nobody answers to.

## When a feature changes, the spec changes with it

The playbook says a story does not rewrite the spec. When the user reverses a
requirement, ask whether to update the spec and then do it: the story, the FR,
the clarification, the edge case and the SC together, with `pnpm specs:check`
passing afterwards.

## Tooling

- Under zsh, `$flags` in `cmd $flags` is not split into words, so
  `--enable x` arrives as one argument. Write manual test scripts for bash.
- `--import tsx` fails outside the repository. Resolve its absolute URL with
  `import.meta.resolve("tsx")` from inside the repository, and pass that URL.
