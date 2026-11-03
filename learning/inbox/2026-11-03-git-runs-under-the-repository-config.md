Whatever git runs on the repository's behalf must run under that repository's own git config, never a stripped-down one.

**Why:** The user refused on 2026-11-03 a fetch that ignored `.git/config`: sources reached through `insteadOf`, `core.sshCommand` or credentials set there would stop working.

**How to apply:** When git runs outside the repository's own `.git`, such as in a temporary store, hand it the repository's effective config, as `GitSources.fetchCommit` does, and test it with a local setting.
