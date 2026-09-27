# Tasks, phase 005: Knowledge reached through MCP

Each story is one reviewable change, leaving the repository building and green ([SC-026](../spec.md#sc-026)). Its tasks are the steps inside that change, in the order listed. What each task settles is plan [§17.5](../plan.md#175-phase-005-knowledge-reached-through-mcp).

Task ids are `T5.<nnn>`. A story is cut from `005-mcp-knowledge` as `task/story-<n>-<slug>` and squash-merged back as one commit named after the story.

Legend: `[P]` = parallelisable with its siblings. "Depends on" names what must land first.

---

## Story 17 — Declare where knowledge lives once, and point any primitive at it

Independent test: see spec [Story 17](../spec.md#user-story-17---declare-where-knowledge-lives-once-and-point-any-primitive-at-it-priority-p1).

- [x] <a id="t5.001"></a>**T5.001** Identities joined by `/`: the schema, where a file is kept, every name made from an identity. *([FR-141](../spec.md#fr-141); [Story 17](../spec.md#user-story-17---declare-where-knowledge-lives-once-and-point-any-primitive-at-it-priority-p1) scenario 1; plan [§19.2](../plan.md#192-identities-joined-by--fr-141), [§17.5.1](../plan.md#1751-t5001--identities-joined-by-); data-model [§1.2](../data-model.md#12-common-headers-fr-002-fr-005-fr-006-fr-008))*
- [x] <a id="t5.002"></a>**T5.002** The `mcp` kind, the `mcps` header, the unresolved error and the unnamed warning. *([FR-001](../spec.md#fr-001), [FR-004](../spec.md#fr-004), [FR-014](../spec.md#fr-014), [FR-142](../spec.md#fr-142), [FR-143](../spec.md#fr-143), [FR-144](../spec.md#fr-144); [Story 17](../spec.md#user-story-17---declare-where-knowledge-lives-once-and-point-any-primitive-at-it-priority-p1) scenarios 1, 3, 4; plan [§19.1](../plan.md#191-the-kind-and-the-header-fr-142--fr-144), [§4.4](../plan.md#44-the-four-validation-warnings-fr-014), [§17.5.2](../plan.md#1752-t5002--the-mcp-kind-and-the-mcps-header); data-model [§1.3](../data-model.md#13-kinds-and-what-each-requires-fr-001-fr-004), [§6.1](../data-model.md#61-the-four-warnings-fr-014), [§17.1](../data-model.md#171-mcp-primitive-fr-142))* Depends on [T5.001](#t5.001).
- [x] <a id="t5.003"></a>**T5.003** The list of places, `.cw/out/mcp-origins.json`, and its two composite errors. *([FR-145](../spec.md#fr-145), [FR-157](../spec.md#fr-157), [SC-038](../spec.md#sc-038); [Story 17](../spec.md#user-story-17---declare-where-knowledge-lives-once-and-point-any-primitive-at-it-priority-p1) scenarios 5, 7; plan [§19.3](../plan.md#193-the-list-of-places-fr-145-fr-157), [§17.5.3](../plan.md#1753-t5003--the-list-of-places); data-model [§17.2](../data-model.md#172-place-fr-145))* Depends on [T5.002](#t5.002).
- [ ] <a id="t5.004"></a>**T5.004** What the host is given: the `cw` entry of `.mcp.json`, and each document naming its places. *([FR-146](../spec.md#fr-146), [FR-147](../spec.md#fr-147); [Story 17](../spec.md#user-story-17---declare-where-knowledge-lives-once-and-point-any-primitive-at-it-priority-p1) scenarios 2, 6; plan [§19.4](../plan.md#194-what-the-agents-host-is-given-fr-146-fr-147-fr-156), [§17.5.4](../plan.md#1754-t5004--what-the-host-is-given); data-model [§8](../data-model.md#8-compiled-output-fr-030--fr-040))* Depends on [T5.003](#t5.003).

---

## Story 18 — Sign in to every place as yourself

Independent test: see spec [Story 18](../spec.md#user-story-18---sign-in-to-every-place-as-yourself-priority-p1).

- [ ] <a id="t5.005"></a>**T5.005** [P] The credential store: the port, the macOS and Linux adapters, the in-memory one. *([FR-149](../spec.md#fr-149), [SC-036](../spec.md#sc-036); plan [§19.5](../plan.md#195-signing-in-fr-148--fr-151), [§17.5.5](../plan.md#1755-t5005--the-credential-store); data-model [§17.3](../data-model.md#173-credential-fr-148--fr-151))*
- [ ] <a id="t5.006"></a>**T5.006** `cw mcp auth` by token: status, one identity, no terminal. *([FR-148](../spec.md#fr-148), [FR-150](../spec.md#fr-150), [SC-034](../spec.md#sc-034), [SC-035](../spec.md#sc-035); [Story 18](../spec.md#user-story-18---sign-in-to-every-place-as-yourself-priority-p1) scenarios 1 – 6; plan [§19.5](../plan.md#195-signing-in-fr-148--fr-151), [§17.5.6](../plan.md#1756-t5006--cw-mcp-auth-by-token); data-model [§17.4](../data-model.md#174-sign-in-status-fr-150))* Depends on [T5.003](#t5.003), [T5.005](#t5.005).
- [ ] <a id="t5.007"></a>**T5.007** `cw mcp auth` by OAuth, and renewal. *([FR-148](../spec.md#fr-148), [FR-151](../spec.md#fr-151); [Story 18](../spec.md#user-story-18---sign-in-to-every-place-as-yourself-priority-p1) scenarios 1, 7; plan [§19.5](../plan.md#195-signing-in-fr-148--fr-151), [§17.5.7](../plan.md#1757-t5007--cw-mcp-auth-by-oauth-and-renewal))* Depends on [T5.006](#t5.006).

---

## Story 19 — Give the agent one server that reaches every place

Independent test: see spec [Story 19](../spec.md#user-story-19---give-the-agent-one-server-that-reaches-every-place-priority-p1).

- [ ] <a id="t5.008"></a>**T5.008** `cw mcp serve`: stdio, the declared tools under their prefixes, undeclared calls refused. *([FR-152](../spec.md#fr-152), [FR-153](../spec.md#fr-153), [SC-037](../spec.md#sc-037); [Story 19](../spec.md#user-story-19---give-the-agent-one-server-that-reaches-every-place-priority-p1) scenarios 1, 2, 6, 7; plan [§19.6](../plan.md#196-the-server-fr-152--fr-154), [§17.5.8](../plan.md#1758-t5008--cw-mcp-serve); data-model [§17.5](../data-model.md#175-what-a-run-serves-fr-152--fr-155))* Depends on [T5.007](#t5.007).
- [ ] <a id="t5.009"></a>**T5.009** Forwarding under the developer's credential, and one place failing alone. *([FR-151](../spec.md#fr-151), [FR-154](../spec.md#fr-154), [SC-035](../spec.md#sc-035), [SC-039](../spec.md#sc-039); [Story 19](../spec.md#user-story-19---give-the-agent-one-server-that-reaches-every-place-priority-p1) scenarios 3 – 5; plan [§19.6](../plan.md#196-the-server-fr-152--fr-154), [§17.5.9](../plan.md#1759-t5009--forwarding-and-one-place-failing-alone))* Depends on [T5.008](#t5.008).
- [ ] <a id="t5.010"></a>**T5.010** Places started as a local process, with their token in the variable named. *([FR-142](../spec.md#fr-142), [FR-152](../spec.md#fr-152); [Story 19](../spec.md#user-story-19---give-the-agent-one-server-that-reaches-every-place-priority-p1) scenarios 5, 8; plan [§19.6](../plan.md#196-the-server-fr-152--fr-154), [§17.5.10](../plan.md#17510-t5010--places-started-as-a-local-process))* Depends on [T5.009](#t5.009).

---

## Story 20 — Hold a run to the places it needs

Independent test: see spec [Story 20](../spec.md#user-story-20---hold-a-run-to-the-places-it-needs-priority-p2).

- [ ] <a id="t5.011"></a>**T5.011** `cw mcp serve --enable`. *([FR-155](../spec.md#fr-155), [SC-037](../spec.md#sc-037); [Story 20](../spec.md#user-story-20---hold-a-run-to-the-places-it-needs-priority-p2) scenarios 1 – 5; plan [§19.7](../plan.md#197-holding-a-run-fr-155-fr-156), [§17.5.11](../plan.md#17511-t5011----enable); data-model [§17.5](../data-model.md#175-what-a-run-serves-fr-152--fr-155))* Depends on [T5.009](#t5.009).
- [ ] <a id="t5.012"></a>**T5.012** [P] An agent held to the tools of its places. *([FR-156](../spec.md#fr-156); [Story 20](../spec.md#user-story-20---hold-a-run-to-the-places-it-needs-priority-p2) scenario 6; plan [§19.4](../plan.md#194-what-the-agents-host-is-given-fr-146-fr-147-fr-156), [§19.7](../plan.md#197-holding-a-run-fr-155-fr-156), [§17.5.12](../plan.md#17512-t5012--an-agent-held-to-its-places))* Depends on [T5.004](#t5.004).
- [ ] <a id="t5.013"></a>**T5.013** The README: declaring, signing in, serving, and a scheduled run. *([Story 17](../spec.md#user-story-17---declare-where-knowledge-lives-once-and-point-any-primitive-at-it-priority-p1), [Story 18](../spec.md#user-story-18---sign-in-to-every-place-as-yourself-priority-p1), [Story 19](../spec.md#user-story-19---give-the-agent-one-server-that-reaches-every-place-priority-p1), [Story 20](../spec.md#user-story-20---hold-a-run-to-the-places-it-needs-priority-p2); plan [§17.5.13](../plan.md#17513-t5013--the-readme))* Depends on [T5.011](#t5.011), [T5.012](#t5.012).
