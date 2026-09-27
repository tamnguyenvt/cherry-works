# Tasks, phase 004: The compiled charter

Each story is one reviewable change, leaving the repository building and green ([SC-026](../spec.md#sc-026)). Its tasks are the steps inside that change, in the order listed. What each task settles is plan [§17.4](../plan.md#174-phase-004-the-compiled-charter).

Task ids are `T4.<nnn>`. The story is cut from `develop` as `task/story-20-compiled-charter` and squash-merged back as one commit named after the story.

---

## Story 16 — Open every primitive as it was compiled

Independent test: see spec [Story 16](../spec.md#user-story-16---open-every-primitive-as-it-was-compiled-priority-p1).

- [x] <a id="t4.001"></a>**T4.001** Listing reads the charter, not the catalogue. *([FR-140](../spec.md#fr-140); [Story 16](../spec.md#user-story-16---open-every-primitive-as-it-was-compiled-priority-p1) scenario 6; plan [§6.1](../plan.md#61-one-pass-produces-everything-fr-030--fr-034-sc-004), [§17.4.1](../plan.md#1741-t4001--listing-reads-the-charter); data-model [§7](../data-model.md#7-catalogues-fr-025--fr-028))*
- [x] <a id="t4.002"></a>**T4.002** Every primitive compiled into `.cw/out/<kind>/<id>.md`, and the catalogue naming it. *([FR-139](../spec.md#fr-139), [FR-140](../spec.md#fr-140), [SC-033](../spec.md#sc-033); [Story 16](../spec.md#user-story-16---open-every-primitive-as-it-was-compiled-priority-p1) scenarios 1 – 5; plan [§6.1](../plan.md#61-one-pass-produces-everything-fr-030--fr-034-sc-004), [§17.4.2](../plan.md#1742-t4002--every-primitive-compiled-into-the-output-folder); data-model [§8.1](../data-model.md#81-compiled-primitive-fr-139))* Depends on [T4.001](#t4.001).
