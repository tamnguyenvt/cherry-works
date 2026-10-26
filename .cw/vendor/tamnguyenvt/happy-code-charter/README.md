# Happy Code Charter

A [Cherry Works](https://github.com/tamnguyenvt/cherry-works) charter of
lessons learned writing code with an agent: how to name things, when not to
split a function, how to follow the files already there, and how to write a
changelog.

## Install

```bash
cw vendor add https://github.com/tamnguyenvt/happy-code-charter
cw build
```

## What it holds

| Guide | Comes up | What it asks |
|---|---|---|
| `no-single-word-naming` | every turn | Name a variable as its context plus the type it holds — `mcpPrimitive`, `rationaleId`, `primitiveById` — never `data`, `result` or a past participle. |
| `no-arbitrary-function-split` | every turn | No function named by a bare verb, no splitting into small functions nothing reuses; keep it inline or in the closest `helper.ts`. |
| `name-like-the-files-before-it` | every turn | A new file of a pattern the repository already has follows the files before it, their shape and their names, rather than inventing its own. |
| `write-changelog` | on `CHANGELOG.md` | One short plain sentence per entry, for users; **Breaking:** only when they must edit what they wrote. |

The reasoning behind `no-single-word-naming` and `write-changelog` is kept in
the corpora `why-no-single-word-naming` and `why-write-changelog`.
