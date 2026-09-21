# Tasks, phase 002: Charter Portal

Each task is one reviewable change of ≤ 500 changed lines where the work divides on a seam of its own, and ≤ 1000 where it does not ([SC-026](../spec.md#sc-026)), leaving the repository building and green.

Increments need not be user-visible; the independently-testable unit is the
story. Within a story the engine half lands before the page half. What each task
settles — modules, tests, how it lands — is plan [§17.2](../plan.md#172-phase-002-the-charter-portal).

Task ids are `T2.<nnn>`. Each is cut from `002-charter-portal` as
`task/<id>-<slug>`.

Legend: `[P]` = parallelisable with its siblings. "Depends on" names what must land first.

---

## Story 5 — See what the charter holds and why each rule comes up

Independent test: see spec [Story 5](../spec.md#user-story-5---see-what-the-charter-holds-and-why-each-rule-comes-up-priority-p1).

### Engine
- [x] <a id="t2.001"></a>**T2.001** Explain names the test cases that name the identity, on both surfaces. *([FR-029](../spec.md#fr-029), [FR-109](../spec.md#fr-109); plan [§10.2](../plan.md#102-explain-fr-029-fr-116), [§17.2.1](../plan.md#1721-t2001--the-test-cases-naming-an-identity); data-model [§13](../data-model.md#13-explanation-fr-029))*

### Portal
- [ ] <a id="t2.002"></a>**T2.002** The first routes: the charter's faults and its primitives. *([FR-112](../spec.md#fr-112), [FR-115](../spec.md#fr-115); plan [§12.2](../plan.md#122-the-route-table), [§17.2.2](../plan.md#1722-t2002--the-first-routes))*
- [ ] <a id="t2.003"></a>**T2.003** The page shell, with no data. *(plan [§12.5](../plan.md#125-the-page), [§17.2.3](../plan.md#1723-t2003--the-page-shell))*
- [ ] <a id="t2.004"></a>**T2.004** The repository view, with the kinds answered by the engine. *([FR-109](../spec.md#fr-109), [FR-110](../spec.md#fr-110), [FR-112](../spec.md#fr-112), [FR-113](../spec.md#fr-113); [Story 5](../spec.md#user-story-5---see-what-the-charter-holds-and-why-each-rule-comes-up-priority-p1) scenarios 1, 2, 6; plan [§9.4](../plan.md#94-opening-rewriting-and-deleting-a-primitive-fr-075--fr-079), [§17.2.4](../plan.md#1724-t2004--the-repository-view); data-model [§2.2](../data-model.md#22-primitive-kinds-fr-060-fr-113))* Depends on [T2.002](#t2.002), [T2.003](#t2.003).
- [ ] <a id="t2.005"></a>**T2.005** [P] The faults view in place of the listing. *([FR-115](../spec.md#fr-115); [Story 5](../spec.md#user-story-5---see-what-the-charter-holds-and-why-each-rule-comes-up-priority-p1) scenario 5; plan [§17.2.5](../plan.md#1725-t2005--the-faults-view))* Depends on [T2.002](#t2.002), [T2.003](#t2.003).
- [ ] <a id="t2.006"></a>**T2.006** [P] The vendor layer's primitives, read-only. *([FR-112](../spec.md#fr-112); plan [§17.2.6](../plan.md#1726-t2006--the-vendor-layers-primitives))* Depends on [T2.004](#t2.004).
- [ ] <a id="t2.007"></a>**T2.007** Search across both layers. *([FR-114](../spec.md#fr-114); [Story 5](../spec.md#user-story-5---see-what-the-charter-holds-and-why-each-rule-comes-up-priority-p1) scenarios 3, 7; plan [§17.2.7](../plan.md#1727-t2007--search))* Depends on [T2.004](#t2.004).
- [ ] <a id="t2.008"></a>**T2.008** The explanation route and the Explain modal. *([FR-029](../spec.md#fr-029), [FR-116](../spec.md#fr-116); [Story 5](../spec.md#user-story-5---see-what-the-charter-holds-and-why-each-rule-comes-up-priority-p1) scenario 4; plan [§17.2.8](../plan.md#1728-t2008--the-explanation-route-and-modal))* Depends on [T2.001](#t2.001), [T2.004](#t2.004).

---

## Story 6 — Author, edit and delete a primitive

Independent test: see spec [Story 6](../spec.md#user-story-6---author-edit-and-delete-a-primitive-without-looking-anything-up-priority-p2).

### Engine
- [ ] <a id="t2.009"></a>**T2.009** Adding a primitive carries a body. *([FR-117](../spec.md#fr-117); plan [§9.4](../plan.md#94-opening-rewriting-and-deleting-a-primitive-fr-075--fr-079), [§17.2.9](../plan.md#1729-t2009--adding-carries-a-body))*
- [ ] <a id="t2.010"></a>**T2.010** Opening an existing primitive, with its revision. *([FR-075](../spec.md#fr-075); plan [§9.4](../plan.md#94-opening-rewriting-and-deleting-a-primitive-fr-075--fr-079), [§17.2.10](../plan.md#17210-t2010--opening-a-primitive); data-model [§15.1](../data-model.md#151-opened-primitive-fr-075-fr-078))*
- [ ] <a id="t2.011"></a>**T2.011** Rewriting a repository primitive, refused as the spec says. *([FR-075](../spec.md#fr-075), [FR-077](../spec.md#fr-077), [FR-078](../spec.md#fr-078); plan [§9.4](../plan.md#94-opening-rewriting-and-deleting-a-primitive-fr-075--fr-079), [§17.2.11](../plan.md#17211-t2011--rewriting-a-primitive))* Depends on [T2.010](#t2.010).
- [ ] <a id="t2.012"></a>**T2.012** Deleting a repository primitive, and `cw remove`. *([FR-076](../spec.md#fr-076), [FR-077](../spec.md#fr-077); plan [§9.4](../plan.md#94-opening-rewriting-and-deleting-a-primitive-fr-075--fr-079), [§13](../plan.md#13-the-command-line-fr-093--fr-095-fr-109), [§17.2.12](../plan.md#17212-t2012--deleting-a-primitive))*
- [ ] <a id="t2.013"></a>**T2.013** `cw edit` opens the author's editor on a primitive. *([FR-109](../spec.md#fr-109); plan [§13](../plan.md#13-the-command-line-fr-093--fr-095-fr-109), [§17.2.13](../plan.md#17213-t2013--cw-edit))* Depends on [T2.010](#t2.010).
- [ ] <a id="t2.014"></a>**T2.014** Requirements name a closed header's allowed values. *([FR-118](../spec.md#fr-118); plan [§12.5](../plan.md#125-the-page), [§17.2.14](../plan.md#17214-t2014--a-closed-headers-allowed-values); data-model [§2.1](../data-model.md#21-primitive-requirements-fr-059-fr-062))*

### Portal
- [ ] <a id="t2.015"></a>**T2.015** The primitive routes, with revisions over HTTP. *(plan [§12.2](../plan.md#122-the-route-table), [§17.2.15](../plan.md#17215-t2015--the-primitive-routes))* Depends on [T2.009](#t2.009), [T2.011](#t2.011), [T2.012](#t2.012), [T2.014](#t2.014).
- [ ] <a id="t2.016"></a>**T2.016** The form for a new or an existing primitive. *([FR-075](../spec.md#fr-075), [FR-117](../spec.md#fr-117), [FR-118](../spec.md#fr-118); [Story 6](../spec.md#user-story-6---author-edit-and-delete-a-primitive-without-looking-anything-up-priority-p2) scenarios 1, 4; plan [§12.5](../plan.md#125-the-page), [§17.2.16](../plan.md#17216-t2016--the-form); data-model [§15.2](../data-model.md#152-draft))* Depends on [T2.015](#t2.015).
- [ ] <a id="t2.017"></a>**T2.017** The body editor, with source and preview. *([FR-119](../spec.md#fr-119); plan [§1](../plan.md#1-technical-context), [§17.2.17](../plan.md#17217-t2017--the-body-editor))* Depends on [T2.016](#t2.016).
- [ ] <a id="t2.018"></a>**T2.018** Save, create and delete wired to the routes. *([FR-077](../spec.md#fr-077) – [FR-079](../spec.md#fr-079); [Story 6](../spec.md#user-story-6---author-edit-and-delete-a-primitive-without-looking-anything-up-priority-p2) scenarios 2, 3, 5 – 9; plan [§17.2.18](../plan.md#17218-t2018--save-create-and-delete))* Depends on [T2.016](#t2.016), [T2.017](#t2.017).

---

## Story 7 — Build, preview and check the repository's health

Independent test: see spec [Story 7](../spec.md#user-story-7---build-preview-and-check-the-repositorys-health-priority-p3).

### Engine
- [ ] <a id="t2.019"></a>**T2.019** The health check behind the port, `cw doctor` its reader. *([FR-121](../spec.md#fr-121); [SC-014](../spec.md#sc-014); plan [§12.2](../plan.md#122-the-route-table), [§17.2.19](../plan.md#17219-t2019--the-health-check-behind-the-port); data-model [§14](../data-model.md#14-doctor-outcome-fr-080-fr-081))*
- [ ] <a id="t2.020"></a>**T2.020** [P] The two warnings the charter alone answers. *([FR-014](../spec.md#fr-014); plan [§4.4](../plan.md#44-the-three-validation-warnings-fr-014), [§17.2.20](../plan.md#17220-t2020--the-two-warnings-the-charter-alone-answers); data-model [§6.1](../data-model.md#61-the-three-warnings-fr-014))*
- [ ] <a id="t2.021"></a>**T2.021** The warning for a primitive no test case names. *([FR-014](../spec.md#fr-014); plan [§4.4](../plan.md#44-the-three-validation-warnings-fr-014), [§17.2.21](../plan.md#17221-t2021--the-warning-for-a-primitive-no-case-names); data-model [§6.1](../data-model.md#61-the-three-warnings-fr-014))* Depends on [T2.020](#t2.020).

### Portal
- [ ] <a id="t2.022"></a>**T2.022** Preview and build from the header. *([FR-120](../spec.md#fr-120); [Story 7](../spec.md#user-story-7---build-preview-and-check-the-repositorys-health-priority-p3) scenarios 1 – 3; plan [§12.2](../plan.md#122-the-route-table), [§17.2.22](../plan.md#17222-t2022--preview-and-build-from-the-header))* Depends on [T2.003](#t2.003).
- [ ] <a id="t2.023"></a>**T2.023** The health route and the Doctor modal. *([FR-121](../spec.md#fr-121); [Story 7](../spec.md#user-story-7---build-preview-and-check-the-repositorys-health-priority-p3) scenario 4; plan [§12.2](../plan.md#122-the-route-table), [§17.2.23](../plan.md#17223-t2023--the-health-route-and-the-doctor-modal))* Depends on [T2.019](#t2.019), [T2.022](#t2.022).

---

## Story 8 — Install, see and remove vendor sources

Independent test: see spec [Story 8](../spec.md#user-story-8---install-see-and-remove-vendor-sources-priority-p4).

### Engine
- [ ] <a id="t2.024"></a>**T2.024** The install commit records its source and version. *([FR-053](../spec.md#fr-053); plan [§7.2](../plan.md#72-what-an-install-records-fr-053-fr-122), [§17.2.24](../plan.md#17224-t2024--the-install-commit-records-its-source-and-version); data-model [§10.2](../data-model.md#102-vendor-install-fr-053-fr-122))*
- [ ] <a id="t2.025"></a>**T2.025** Listing the installed vendor sources, and `cw vendor list`. *([FR-053](../spec.md#fr-053), [FR-122](../spec.md#fr-122); [Story 8](../spec.md#user-story-8---install-see-and-remove-vendor-sources-priority-p4) scenario 7; plan [§7.2](../plan.md#72-what-an-install-records-fr-053-fr-122), [§13](../plan.md#13-the-command-line-fr-093--fr-095-fr-109), [§17.2.25](../plan.md#17225-t2025--listing-the-installed-vendors); data-model [§10.2](../data-model.md#102-vendor-install-fr-053-fr-122))* Depends on [T2.024](#t2.024).

### Portal
- [ ] <a id="t2.026"></a>**T2.026** The vendor routes and the sources panel. *([FR-122](../spec.md#fr-122), [FR-123](../spec.md#fr-123); [Story 8](../spec.md#user-story-8---install-see-and-remove-vendor-sources-priority-p4) scenarios 1 – 7; plan [§12.2](../plan.md#122-the-route-table), [§17.2.26](../plan.md#17226-t2026--the-vendor-routes-and-the-sources-panel))* Depends on [T2.025](#t2.025), [T2.006](#t2.006).

---

## Story 9 — Write, run and correct the self-regression tests

Independent test: see spec [Story 9](../spec.md#user-story-9---write-run-and-correct-the-self-regression-tests-priority-p5).

### Engine
- [ ] <a id="t2.027"></a>**T2.027** Listing the test files, running nothing. *([FR-124](../spec.md#fr-124); plan [§11.3](../plan.md#113-managing-test-files), [§17.2.27](../plan.md#17227-t2027--listing-the-test-files); data-model [§11.2](../data-model.md#112-test-suites-listed))*
- [ ] <a id="t2.028"></a>**T2.028** Creating and deleting a test file, and `cw suite add` and `cw suite remove`. *([FR-091](../spec.md#fr-091), [FR-092](../spec.md#fr-092); plan [§11.3](../plan.md#113-managing-test-files), [§13](../plan.md#13-the-command-line-fr-093--fr-095-fr-109), [§17.2.28](../plan.md#17228-t2028--creating-and-deleting-a-test-file); data-model [§11.2](../data-model.md#112-test-suites-listed))*
- [ ] <a id="t2.029"></a>**T2.029** [P] Rewriting a test file, and `cw suite edit`. *([FR-090](../spec.md#fr-090), [FR-109](../spec.md#fr-109); plan [§11.3](../plan.md#113-managing-test-files), [§13](../plan.md#13-the-command-line-fr-093--fr-095-fr-109), [§17.2.29](../plan.md#17229-t2029--rewriting-a-test-file))* Depends on [T2.013](#t2.013).

### Portal
- [ ] <a id="t2.030"></a>**T2.030** The test view, and running all tests. *([FR-124](../spec.md#fr-124), [FR-125](../spec.md#fr-125); [Story 9](../spec.md#user-story-9---write-run-and-correct-the-self-regression-tests-priority-p5) scenarios 1, 2, 5, 8; plan [§12.2](../plan.md#122-the-route-table), [§17.2.30](../plan.md#17230-t2030--the-test-view))* Depends on [T2.027](#t2.027), [T2.003](#t2.003).
- [ ] <a id="t2.031"></a>**T2.031** Create, save and delete a test file from the portal. *([FR-090](../spec.md#fr-090) – [FR-092](../spec.md#fr-092); [Story 9](../spec.md#user-story-9---write-run-and-correct-the-self-regression-tests-priority-p5) scenarios 3, 4, 6, 7; plan [§12.2](../plan.md#122-the-route-table), [§17.2.31](../plan.md#17231-t2031--create-save-and-delete-a-test-file-from-the-portal))* Depends on [T2.028](#t2.028), [T2.029](#t2.029), [T2.030](#t2.030).

---

## Done when

- Every story's independent test passes against a real repository (spec Stories 5 – 9).
- [SC-014](../spec.md#sc-014) and [SC-017](../spec.md#sc-017) hold.
