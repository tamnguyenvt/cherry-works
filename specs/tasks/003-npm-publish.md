# Tasks, phase 003: Publishing to npm

Each story is one reviewable change, leaving the repository building and green ([SC-026](../spec.md#sc-026)). Its tasks are the steps inside that change, in the order listed. What each task settles is plan [§17.3](../plan.md#173-phase-003-publishing-to-npm).

Task ids are `T3.<nnn>`. A story is cut from `003-npm-publish` as `task/story-<n>-<slug>` and squash-merged back as one commit named after the story.

Legend: `[P]` = parallelisable with its siblings. "Depends on" names what must land first.

---

## Story 13 — Install `cw` with one command and use it in any repository

Independent test: see spec [Story 13](../spec.md#user-story-13---install-cw-with-one-command-and-use-it-in-any-repository-priority-p1).

- [x] <a id="t3.001"></a>**T3.001** Runtime dependencies only, checked against what the engine imports. *([FR-127](../spec.md#fr-127), [FR-129](../spec.md#fr-129), [SC-029](../spec.md#sc-029); plan [§18.1](../plan.md#181-what-the-package-holds-fr-126-fr-127-fr-129-fr-130-fr-133), [§17.3.1](../plan.md#1731-t3001--runtime-dependencies-only))*
- [x] <a id="t3.002"></a>**T3.002** [P] The runtime guard before anything loads. *([FR-128](../spec.md#fr-128); [Story 13](../spec.md#user-story-13---install-cw-with-one-command-and-use-it-in-any-repository-priority-p1) scenario 4; plan [§18.2](../plan.md#182-the-runtime-it-needs-fr-128), [§17.3.2](../plan.md#1732-t3002--the-runtime-guard))*
- [x] <a id="t3.003"></a>**T3.003** [P] What the package holds: metadata, the MIT license, the file list. *([FR-126](../spec.md#fr-126), [FR-130](../spec.md#fr-130), [FR-133](../spec.md#fr-133); plan [§18.1](../plan.md#181-what-the-package-holds-fr-126-fr-127-fr-129-fr-130-fr-133), [§17.3.3](../plan.md#1733-t3003--what-the-package-holds); data-model [§16.1](../data-model.md#161-package))*

---

## Story 14 — Know which `cw` is running, and move to another

Independent test: see spec [Story 14](../spec.md#user-story-14---know-which-cw-is-running-and-move-to-another-priority-p2).

- [x] <a id="t3.004"></a>**T3.004** `cw --version`. *([FR-131](../spec.md#fr-131); [Story 14](../spec.md#user-story-14---know-which-cw-is-running-and-move-to-another-priority-p2) scenario 1; plan [§18.3](../plan.md#183-the-version-it-names-fr-131-fr-132), [§17.3.4](../plan.md#1734-t3004--cw---version))*
- [x] <a id="t3.005"></a>**T3.005** The health check names its version, on the command line and in the portal. *([FR-132](../spec.md#fr-132), [FR-121](../spec.md#fr-121); [Story 14](../spec.md#user-story-14---know-which-cw-is-running-and-move-to-another-priority-p2) scenario 4; plan [§18.3](../plan.md#183-the-version-it-names-fr-131-fr-132), [§17.3.5](../plan.md#1735-t3005--the-health-check-names-its-version))* Depends on [T3.004](#t3.004).

---

## Story 15 — Publish a release that users can trust

Independent test: see spec [Story 15](../spec.md#user-story-15---publish-a-release-that-users-can-trust-priority-p3).

- [x] <a id="t3.006"></a>**T3.006** The release's refusals and the full suite. *([FR-134](../spec.md#fr-134), [FR-137](../spec.md#fr-137); [Story 15](../spec.md#user-story-15---publish-a-release-that-users-can-trust-priority-p3) scenarios 2, 3; plan [§18.4](../plan.md#184-releasing-fr-134--fr-137), [§17.3.6](../plan.md#1736-t3006--the-releases-checks))* Depends on [T3.001](#t3.001) – [T3.005](#t3.005).
- [x] <a id="t3.007"></a>**T3.007** The install check of the exact tarball. *([FR-135](../spec.md#fr-135), [SC-029](../spec.md#sc-029), [SC-030](../spec.md#sc-030); [Story 15](../spec.md#user-story-15---publish-a-release-that-users-can-trust-priority-p3) scenario 4; plan [§18.4](../plan.md#184-releasing-fr-134--fr-137), [§17.3.7](../plan.md#1737-t3007--the-install-check); data-model [§16.2](../data-model.md#162-release))* Depends on [T3.006](#t3.006).
- [x] <a id="t3.008"></a>**T3.008** Commit, tag, publish, push, and undo a failed publish. *([FR-136](../spec.md#fr-136), [SC-031](../spec.md#sc-031), [SC-032](../spec.md#sc-032); [Story 15](../spec.md#user-story-15---publish-a-release-that-users-can-trust-priority-p3) scenario 1; plan [§18.4](../plan.md#184-releasing-fr-134--fr-137), [§17.3.8](../plan.md#1738-t3008--commit-tag-publish-push))* Depends on [T3.007](#t3.007).
- [ ] <a id="t3.009"></a>**T3.009** The README installs from the registry, then release 0.1.0. *([FR-138](../spec.md#fr-138), [SC-027](../spec.md#sc-027), [SC-028](../spec.md#sc-028); [Story 13](../spec.md#user-story-13---install-cw-with-one-command-and-use-it-in-any-repository-priority-p1) scenarios 1 – 3, 5; [Story 15](../spec.md#user-story-15---publish-a-release-that-users-can-trust-priority-p3) scenario 5; plan [§18.5](../plan.md#185-the-readme-fr-138), [§17.3.9](../plan.md#1739-t3009--the-readme-then-010))* Depends on [T3.008](#t3.008).
