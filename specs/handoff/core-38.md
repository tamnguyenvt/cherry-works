# CORE Story 38 — handoff

**Updated**: 2026-11-03

## Done

- The baseline: passed on 2026-11-03, typecheck clean, 753 tests pass, 0 fail.
- The spec gate: passed on 2026-11-03.
- Scenarios 1 to 5 built, tested in `test/keeping-a-binary-asset-whole.test.ts`.
- /sdd-verify, last run on 2026-11-03: typecheck clean, dependency rules clean, 763 tests pass 0 fail; by hand with cw, a random-bytes asset built identical, previewed unchanged then updated after a one-byte edit, installed identical, and an `index.md` holding a non-UTF-8 byte injected identical with its asset; specs check passes.
- Seven reviews run. The first six failed on what is now fixed: names that broke the naming guides; `InMemoryWorktrees` copying through `readFilesRecursively`, now `readBytesRecursively`; and the `..` path inject resolved, now refused with a `VendorFault` before anything is written (CORE-FR-044, CORE Story 37 scenario 5). Each fix of behaviour has a test that fails without it. The seventh passed.
- Settled as `learning/inbox/2026-11-03-nits-are-agents-to-decide.md` says: `decodeContents` keeps a leading BOM, as `FileReaders` does; inject writes an unconverted `index.md` as its bytes; `InMemorySources.readBytesAt` hands back a copy; the test's `source` is `sourceFolder`; the `..` test cites CORE Story 37 scenario 5; this note keeps what is done under Done.

## Remaining

- Nothing: accepted by the user on 2026-11-03.
- Left to handle later: inject lists `.cw/charter/` through `readFilesRecursively`, decoding every file only for its path; `readBytesRecursively` would skip the decode.

## Decisions

- The user chose on 2026-11-03: bytes cross the ports beside text, never in its place — `write` takes `string | Uint8Array`, `ForReadingFiles` gains `readBytesRecursively` and `readBytesIfThere`, `ForFetchingSources` gains `readBytesAt`; every text reader stays as it was.
- The charter is read as bytes and only an `index.md` decoded, keeping a leading BOM as `readFile(…, "utf8")` did; `AssetFile.contents` is `Uint8Array`, an asset compiles to a `BytesProjection`, and the preview compares a copy byte for byte.
- Installing already kept bytes, through `checkoutFolderAt`; only inject read them as text.
- `readBytesAt` reads with `git cat-file blob`, plumbing that never converts a blob. `git show` applies no textconv without `--textconv`, as tried by hand, so no test can tell the two apart and none is kept.
- Three tests named the read the charter is loaded by, and now name `readBytesRecursively`.
- The user said on 2026-11-03 that a `nit` whose fix is correct and harmless is fixed without asking, and that the inbox is read before any `nit` or `q` is put to them: the note above.

## Blockers

- None.
