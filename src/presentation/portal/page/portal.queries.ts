import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InferRequestType } from "hono/client";
import { client } from "./portal.client.js";

/**
 * Every route the page reads or writes through, one hook each (plan §12.5).
 * A view asks the hook for what it shows and holds none of it itself: what the
 * route answered is kept by the query client under the key below, and asked
 * again whenever a view showing it is mounted — the charter as it is on disk
 * now, never a copy kept since (FR-110).
 *
 * A write, once answered, marks what it changed as stale, so every view showing
 * it asks again: a primitive created, saved or deleted is in the listing at
 * once.
 */

/** Every kind there is, under the line saying when a primitive of it comes up
 *  (FR-113). */
export function useKinds() {
  return useQuery({
    queryKey: ["kinds"],
    queryFn: async () => (await client.definitions.kinds.$get()).json(),
  });
}

/** Every primitive of every layer, or those mentioning a word (FR-112, FR-114):
 *  the listing, the faults of a charter the engine will not read, or the fault
 *  it was raised with. */
export function usePrimitives(searchText?: string) {
  return useQuery({
    queryKey: ["primitives", searchText ?? ""],
    queryFn: async () =>
      (
        await client.charter.root.primitives.$get({ query: searchText === undefined ? {} : { matching: searchText } })
      ).json(),
  });
}

/** What the engine answered `usePrimitives`, or nothing yet. */
export type PrimitivesAnswer = ReturnType<typeof usePrimitives>["data"];

/** What the engine says of one primitive (FR-029, FR-116).
 *
 *  An id is sent encoded wherever it is part of a path, here and in the
 *  hooks below: the client puts a parameter in as it is, and an id may hold
 *  `/` (FR-141). */
export function useExplanation(id: string) {
  return useQuery({
    queryKey: ["explanation", id],
    queryFn: async () =>
      (await client.charter.root.primitives[":id"].explanation.$get({ param: { id: encodeURIComponent(id) } })).json(),
  });
}

/** One primitive as the charter read it, with the entity tag a save is sent
 *  back with (FR-075, FR-078); or the fault of an id the charter holds
 *  nothing of. Not asked where there is no id: a new primitive has none.
 *
 *  Asked once per opening and kept by nobody after: an entity tag asked for
 *  again while the form is open would move the revision the author is editing
 *  from, and the save would write over what changed on disk instead of being
 *  refused for it. */
export function usePrimitive(id: string | undefined) {
  return useQuery({
    queryKey: ["primitive", id],
    enabled: id !== undefined,
    gcTime: 0,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const httpResponse = await client.charter.root.primitives[":id"].$get({
        param: { id: encodeURIComponent(id ?? "") },
      });
      return { answer: await httpResponse.json(), entityTag: httpResponse.headers.get("ETag") ?? "" };
    },
  });
}

/** Every header one kind takes, in its shape, and its sample (FR-117, FR-118). */
export function usePrimitiveRequirements(kind: string) {
  return useQuery({
    queryKey: ["requirements", kind],
    enabled: kind !== "",
    queryFn: async () => (await client.definitions.kinds[":kind"].requirements.$get({ param: { kind } })).json(),
  });
}

/** Marks what a write changed as stale: every listing, and the primitive and
 *  explanation of the one written. The last test outcome is cleared rather
 *  than asked again: it says how the cases came out before the write, and only
 *  Run all tests asks for another (Story 9 scenarios 3, 7). */
function useMarkWrittenStale() {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.resetQueries({ queryKey: ["testOutcome"] });
    await queryClient.invalidateQueries({
      predicate: ({ queryKey }) =>
        queryKey[0] !== "kinds" && queryKey[0] !== "requirements" && queryKey[0] !== "testOutcome",
    });
  };
}

/** A new primitive written (FR-117): the primitive, or what refused it. */
export function useAddPrimitive() {
  const markWrittenStale = useMarkWrittenStale();
  return useMutation({
    mutationFn: async (request: InferRequestType<(typeof client.charter)[":charterName"]["primitives"]["$post"]>) =>
      (await client.charter[":charterName"].primitives.$post(request)).json(),
    onSuccess: markWrittenStale,
  });
}

/** A primitive written over at the entity tag it was opened at (FR-075,
 *  FR-078): the primitive, or what refused it — the file changed on disk
 *  among them. */
export function useRewritePrimitive() {
  const markWrittenStale = useMarkWrittenStale();
  return useMutation({
    mutationFn: async (request: InferRequestType<(typeof client.charter.root.primitives)[":id"]["$put"]>) =>
      (
        await client.charter.root.primitives[":id"].$put({
          ...request,
          param: { id: encodeURIComponent(request.param.id) },
        })
      ).json(),
    onSuccess: markWrittenStale,
  });
}

/** A repository primitive's file taken away (FR-076): nothing, or the fault
 *  that refused it. */
export function useRemovePrimitive() {
  const markWrittenStale = useMarkWrittenStale();
  return useMutation({
    mutationFn: async (id: string) => {
      // Sent as JSON though it carries none: every verb but GET is, so a page
      // of another origin cannot make it without a preflight (plan §12.4).
      const httpResponse = await client.charter.root.primitives[":id"].$delete(
        { param: { id: encodeURIComponent(id) } },
        { headers: { "Content-Type": "application/json" } },
      );
      return httpResponse.status === 422 ? httpResponse.json() : null;
    },
    onSuccess: markWrittenStale,
  });
}

/** What a build would do to every file, nothing written (FR-120); or the
 *  faults of a charter that does not hold. Asked again whenever the preview is
 *  opened, so it is the charter on disk now. */
export function useBuildPreview() {
  return useQuery({
    queryKey: ["build"],
    gcTime: 0,
    queryFn: async () => (await client.charter.root.build.$get()).json(),
  });
}

/** The four answers `cw doctor` gives, and every fault (FR-121). */
export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    gcTime: 0,
    queryFn: async () => (await client.charter.root.health.$get()).json(),
  });
}

/** What the charter puts into each agent's main context, as `cw context`
 *  lists it (EVAL-FR-007): or the faults of a charter that does not hold. */
export function useMainContexts() {
  return useQuery({
    queryKey: ["mainContexts"],
    gcTime: 0,
    queryFn: async () => (await client.charter.root.context.$get()).json(),
  });
}

/** What this repository configured itself with, whole: the agents, and the
 *  ceiling a main context is held to. */
export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await client.settings.$get()).json(),
  });
}

/** The charter built (FR-120): what was written and deleted, or the faults
 *  that refused it with nothing written. */
export function useBuildCharter() {
  const markWrittenStale = useMarkWrittenStale();
  return useMutation({
    // Sent as JSON though it carries none, as a delete is (plan §12.4).
    mutationFn: async () =>
      (await client.charter.root.build.$post({}, { headers: { "Content-Type": "application/json" } })).json(),
    onSuccess: markWrittenStale,
  });
}

/** Every charter of the charter root, authored or installed (VENDOR-FR-016). */
export function useCharters() {
  return useQuery({
    queryKey: ["charters"],
    queryFn: async () => (await client.charter.root.charters.$get()).json(),
  });
}

/** Every charter installed, with its source and version (VENDOR-FR-021). */
export function useInstalledCharters() {
  return useQuery({
    queryKey: ["vendors"],
    queryFn: async () => (await client.vendors.$get()).json(),
  });
}

/** A source installed through the engine's vendoring (FR-123): nothing, or the
 *  fault that refused it with nothing installed. */
export function useAddVendor() {
  const markWrittenStale = useMarkWrittenStale();
  return useMutation({
    mutationFn: async (request: InferRequestType<typeof client.vendors.$post>["json"]) => {
      const httpResponse = await client.vendors.$post({ json: request });
      return httpResponse.status === 422 ? httpResponse.json() : null;
    },
    onSuccess: markWrittenStale,
  });
}

/** An installed source taken away by its folder name (FR-123): nothing, or the
 *  fault that refused it with nothing removed. */
export function useRemoveVendor() {
  const markWrittenStale = useMarkWrittenStale();
  return useMutation({
    mutationFn: async (vendorName: string) => {
      // Sent as JSON though it carries none, as a delete is (plan §12.4). The
      // client fills the path as it is given it, and an owner's `/` would end
      // the name there (FR-050).
      const httpResponse = await client.vendors[":name"].$delete(
        { param: { name: encodeURIComponent(vendorName) } },
        { headers: { "Content-Type": "application/json" } },
      );
      return httpResponse.status === 422 ? httpResponse.json() : null;
    },
    onSuccess: markWrittenStale,
  });
}

/** Every test file, its text, and its cases or why it does not read (FR-124). */
export function useTestSuites() {
  return useQuery({
    queryKey: ["testSuites"],
    queryFn: async () => (await client["test-suites"].$get()).json(),
  });
}

/** How every case came out, or the faults that stopped the run (FR-125). Asked
 *  only by Run all tests, and kept until a write clears it. */
export function useTestOutcome() {
  return useQuery({
    queryKey: ["testOutcome"],
    enabled: false,
    queryFn: async () => (await client["test-suites"].outcome.$get()).json(),
  });
}

/** A new test file written (FR-091): its name. */
export function useAddTestSuite() {
  const markWrittenStale = useMarkWrittenStale();
  return useMutation({
    // Sent as JSON though it carries none, as a delete is (plan §12.4).
    mutationFn: async (charterName: string) =>
      (await client["test-suites"].$post({ json: charterName === "" ? {} : { charterName } })).json(),
    onSuccess: markWrittenStale,
  });
}

/** One test file written over (FR-090): its name, or the fault that refused
 *  the text with nothing written. */
export function useWriteTestSuite() {
  const markWrittenStale = useMarkWrittenStale();
  return useMutation({
    mutationFn: async ({
      charterName,
      name: testSuiteName,
      text,
    }: {
      charterName: string;
      name: string;
      text: string;
    }) =>
      (
        await client["test-suites"][":charterName"][":name"].$put({
          param: { charterName, name: testSuiteName },
          json: { text },
        })
      ).json(),
    // A refused text wrote nothing, so the outcome still says how the cases
    // on disk come out.
    onSuccess: async (testSuiteNameDTO) => {
      if (testSuiteNameDTO.type === "TestSuiteName") await markWrittenStale();
    },
  });
}

/** One test file taken away (FR-092): nothing, or the fault that refused it. */
export function useRemoveTestSuite() {
  const markWrittenStale = useMarkWrittenStale();
  return useMutation({
    mutationFn: async ({ charterName, name: testSuiteName }: { charterName: string; name: string }) => {
      // Sent as JSON though it carries none, as a delete is (plan §12.4).
      const httpResponse = await client["test-suites"][":charterName"][":name"].$delete(
        { param: { charterName, name: testSuiteName } },
        { headers: { "Content-Type": "application/json" } },
      );
      return httpResponse.status === 422 ? httpResponse.json() : null;
    },
    onSuccess: markWrittenStale,
  });
}
