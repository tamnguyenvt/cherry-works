# T5.001: what surprised us (2026-09-27)

## The Hono client does not encode path parameters

`hono/client` (v4.13.7, `replaceUrlParam`) puts a `param` into the URL exactly
as it is given. Once an identity can hold `/` (`guide:mfbs/no-any`), sending it
as `:identity` unencoded splits it into two path segments. The route then
matches nothing, and the portal page waits forever.

The fix is on the sending side. Every hook in
`src/driver/portal/page/queries.ts` wraps the identity in
`encodeURIComponent`, and so does the `Location` header in `routes.ts`. The
server needs nothing: Hono routes on the raw path, where `%2F` stays inside the
segment, and `c.req.valid("param")` hands back the decoded value.

`:` is encoded too (`guide%3Ano-any`). The one test asserting the old
`Location` was updated to expect the encoded form.

How to apply: any new route that takes an identity or id in its path gets
`encodeURIComponent` at the call site in `queries.ts`. A browser test with a
`/` in the identity is what catches a missed one: without the encoding it
hangs until it times out rather than failing.

## Grouped ids: what was already in place

- `claudeNameOf` in `compileService.ts` already replaced `[:/]`. It is now
  `normalizedIdentityOf` in `Primitive.ts`, so the collision check in `CharterRoot` and
  the compiler spell a host name the same way.
- `FileOutput.write` already runs `mkdir(..., { recursive: true })`, and
  reading the charter is already recursive. Nested folders needed no work in
  the file adapters.
- A command's file name is its bare id, so it goes through `normalizedIdentityOf` as
  well: `command:release/ship` becomes `.claude/commands/release-ship.md`.

## Running `cw` against a scratch repository

The binary is `dist/cw.js`. There is no `dist/bin.js`. Pipe `</dev/null` into
the command so that `cw add` does not think a terminal is there, and pass each
answer with `--header field=value`.
