A test written before its code must be seen failing because of the rule it is
about, not because of another rule that happens to refuse the same input.

**Why:** twice in one session a new assertion passed before any code was
written. A list of refused `executionPath` values passed because the file was
missing from the folder, not because its name was refused; a listing assertion
matched a line of another primitive. Neither test proved the rule until its
fixture was narrowed so that only that rule could refuse it.

**How to apply:** when a new test passes at once, do not move on. Change the
fixture until the only thing standing between it and passing is the code about
to be written, and watch it fail once.
