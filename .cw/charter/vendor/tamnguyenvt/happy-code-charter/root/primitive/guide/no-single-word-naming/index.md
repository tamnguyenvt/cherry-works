---
kind: guide
id: no-single-word-naming
description: Name a variable as its context plus the type it holds — mcpPrimitive, rationaleId, primitiveById — never a vague word or a past participle.
rationale: why-no-single-word-naming
---

A variable's name is **context + type**: the type of the value it holds, as
the last word, led by what that value is in this place.

| Holds | Name | Not |
|---|---|---|
| a `PlanSummary` from `previewPlan()` | `planSummary` | `done`, `result` |
| a `Primitive` known to be an mcp | `mcpPrimitive` | `named`, `mcp` |
| a `Primitive` an `[[<id>]]` points to | `referencedPrimitive` | `mentioned`, `found` |
| the id written in `rationale` | `rationaleId` | `cited` |
| a `Map` of primitives keyed by id | `primitiveById` | `byIdentity`, `map` |
| a `Set` of ids | `referencedIds` | `ids2`, `seen` |
| one id while looping over `mixins` | `mixinId` | `namedMixin`, `usedMixins` |
| a yes/no | `isStale`, `hasGlobs` | `stale`, `check` |

- **Type, last.** The noun of the type in camelCase: `Primitive` is
  `…Primitive`, a string id is `…Id`, a list or set is the plural of its
  element, a map is `<value>By<key>`.
- **Context, first.** Add the word that says what this value is *here* —
  which kind, which header, which side — whenever the type alone could mean
  more than one thing in the function. Leave it off when the type is
  unambiguous: `const primitive = …` in a loop over primitives.
- **One element, singular.** A loop variable names one element, never the
  collection.
- **Never** a single vague word (`it`, `one`, `data`, `item`, `result`,
  `known`), or a past participle on its own (`named`, `mentioned`, `cited`,
  `found`, `written`, `merged`, `done`): those say how the value was reached,
  not what it is.
- **Functions** follow the same rule for what they return:
  `primitiveIdOf()` returns a primitive's id, `catalogueOf()` a `Catalogue`.

Only rename code you are already touching.
