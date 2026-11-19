import type { CharterMetadataList } from "../models/charter/charter-metadata-list.js";
import { CharterRootFactory } from "../models/charter/charter-root.factory.js";
import type { CharterRoot } from "../models/charter/charter-root.js";
import { InstalledCharterRecord } from "../models/charter/installed-charter-record.value-object.js";
import { ValidCharterNameSpec } from "../models/charter/valid-charter-name.specification.js";
import {
  AmbiguousAsNameFault,
  ClaimedIdFault,
  HeldCharterNameFault,
  ReservedCharterNameFault,
  UnexpectedSourceShapeFault,
} from "../models/charter.fault.js";
import { CharterInstall, type CharterInstallRequest } from "../models/charter-source/charter-install.js";
import type { CharterSource } from "../models/charter-source/charter-source.js";

/** Plans what pulling or forking a source puts in the charter root. */
export class CharterInstallService {
  /**
   * Every charter one source's pull or fork puts in the repository,
   * every refusal raised before anything is written.
   *
   * A source is a charter source when it holds charters; a source holding none
   * is refused (CORE-FR-042). With none named, every charter it holds is
   * taken, authored or installed there alike; a charter named that it does not
   * hold is refused naming those it does (VENDOR-FR-017, VENDOR-FR-019). Every
   * other charter of the source a charter taken names an id of is taken with
   * it, and so on, each once (VENDOR-FR-018). Each is copied as it stands, its
   * `cw-package.json` written here, never the source's own (VENDOR-FR-019).
   * `--as` names one charter alone (VENDOR-FR-020).
   *
   * Installed, a charter whose name a charter installed from the same source
   * holds replaces it whole; one held otherwise is refused, suggesting `--as`
   * (VENDOR-FR-020). Forked, any name held is refused, and no
   * `cw-package.json` is kept (VENDOR-FR-022). Either way an id the charter
   * root would then hold twice is refused naming both files (VENDOR-FR-009).
   */
  static planCharterInstalls(
    charterSources: readonly CharterSource[],
    charterInstallRequest: CharterInstallRequest,
    charterMetadataList: CharterMetadataList,
    charterRoot: CharterRoot,
    /** The charters other plans of the same update replace, whose ids are
     *  claimed again by those plans alone (VENDOR-FR-030). */
    otherReplacedCharterNames: readonly string[] = [],
  ): readonly CharterInstall[] {
    const {
      charterSourceOrigin: { sourceUri },
      selectedCharterNames,
      asName,
      version,
      isForked,
    } = charterInstallRequest;

    const sourceCharterNames = charterSources.map(({ name }) => name);
    if (sourceCharterNames.length === 0)
      throw new UnexpectedSourceShapeFault(
        `${sourceUri} is no charter source: it holds no charter.`,
        "Check that the source keeps its charters as cw lays them out, at the version asked for.",
        { internal: false },
      );
    const unheldCharterNames = selectedCharterNames.filter((charterName) => !sourceCharterNames.includes(charterName));
    if (unheldCharterNames.length > 0)
      throw new UnexpectedSourceShapeFault(
        `${sourceUri} holds no charter ${unheldCharterNames.join(", ")}.`,
        `Name one it holds: ${sourceCharterNames.join(", ")}.`,
        { internal: false },
      );

    const pickedCharterNames = selectedCharterNames.length === 0 ? sourceCharterNames : selectedCharterNames;
    if (asName !== undefined && pickedCharterNames.length !== 1)
      throw new AmbiguousAsNameFault(
        "--as names one charter, and this would install more than one.",
        "Name the one charter with --charter, and run this again.",
        { internal: false },
      );

    // Every charter a charter taken names an id of, and so on (VENDOR-FR-018).
    const sourceCharterRoot = CharterRootFactory.create(
      charterSources.flatMap(({ rawPrimitives }) => rawPrimitives),
      "",
    );
    const charterNameById = new Map(
      charterSources.flatMap(({ name, rawPrimitives }) => rawPrimitives.map(({ id }) => [id, name] as const)),
    );
    const takenCharterNames = new Set<string>();
    const pendingCharterNames = [...pickedCharterNames];
    for (
      let charterName = pendingCharterNames.shift();
      charterName !== undefined;
      charterName = pendingCharterNames.shift()
    ) {
      if (takenCharterNames.has(charterName)) continue;
      takenCharterNames.add(charterName);
      for (const primitive of sourceCharterRoot.primitives.filter(({ layer }) => layer.charterName === charterName))
        for (const namedId of sourceCharterRoot.namedIdsOf(primitive)) {
          const includedCharterName = charterNameById.get(namedId);
          if (includedCharterName !== undefined && !takenCharterNames.has(includedCharterName))
            pendingCharterNames.push(includedCharterName);
        }
    }

    const charterInstalls = charterSources
      .filter(({ name }) => takenCharterNames.has(name))
      .map(
        (charterSource) =>
          new CharterInstall(
            asName !== undefined && pickedCharterNames.includes(charterSource.name) ? asName : charterSource.name,
            charterSource,
            // Written on this machine, naming the source asked, whoever installed
            // it in the source; where no version was asked for, the commit
            // fetched (VENDOR-FR-017, VENDOR-FR-019).
            isForked
              ? undefined
              : new InstalledCharterRecord(charterSource.name, sourceUri, version ?? charterSource.commitId),
          ),
      );
    // Each charter lands under a name of its own: two would write over each
    // other.
    const installedCharterNames = charterInstalls.map(({ charterName }) => charterName);
    const sharedCharterName = installedCharterNames.find(
      (charterName, charterIndex) => installedCharterNames.indexOf(charterName) !== charterIndex,
    );
    if (sharedCharterName !== undefined)
      throw new HeldCharterNameFault(
        `${sourceUri} would put two charters under the name "${sharedCharterName}".`,
        "Install the one named under another name with --as.",
        { internal: false },
      );

    // Each name is one a charter may have, and what holds it here is replaced
    // only where it was installed from the same source (VENDOR-FR-020,
    // VENDOR-FR-022).
    const replacedCharterNames: string[] = [];
    for (const { charterName, installedCharterRecord } of charterInstalls) {
      if (!new ValidCharterNameSpec().isSatisfiedBy(charterName))
        throw new ReservedCharterNameFault(
          `"${charterName}" cannot name a charter: a charter is named as an id is, and never as a kind is, as a folder an older layout kept, nor as root.`,
          "Install it under another name with --as.",
          { internal: false },
        );
      const heldCharter = charterMetadataList.findCharter(charterName);
      if (heldCharter === undefined) continue;
      const isFromTheSameSource =
        !isForked &&
        heldCharter.installedCharterRecord !== undefined &&
        installedCharterRecord !== undefined &&
        heldCharter.installedCharterRecord.source === installedCharterRecord.source;
      if (!isFromTheSameSource)
        throw new HeldCharterNameFault(
          heldCharter.installedCharterRecord === undefined
            ? `${charterName} is a charter this repository authored, at ${heldCharter.uri}.`
            : `${charterName} is held by a charter installed from ${heldCharter.installedCharterRecord.source}, at ${heldCharter.uri}.`,
          `Install it under another name with --as=<name>.`,
          { internal: false },
        );
      replacedCharterNames.push(charterName);
    }

    // One id names one primitive in the whole charter, once what is replaced
    // is gone (VENDOR-FR-009, VENDOR-FR-022).
    const uriById = new Map(
      charterRoot.primitives
        .filter(
          ({ layer }) =>
            layer.charterName === undefined ||
            (!replacedCharterNames.includes(layer.charterName) &&
              !otherReplacedCharterNames.includes(layer.charterName)),
        )
        .map((primitive) => [primitive.headers.id, primitive.uri] as const),
    );
    const installedRawPrimitives = charterSources
      .filter(({ name }) => takenCharterNames.has(name))
      .flatMap(({ rawPrimitives }) => rawPrimitives);
    for (const { id, uri } of installedRawPrimitives) {
      const claimingUri = uriById.get(id);
      if (claimingUri !== undefined)
        throw new ClaimedIdFault(
          `${claimingUri} and ${uri} claim id "${id}", and one id names one primitive in the whole charter.`,
          "Remove the one held here, or install a charter whose ids this charter does not hold.",
          { internal: false },
        );
      uriById.set(id, uri);
    }
    return charterInstalls;
  }

  /**
   * The installs several sources were planned into, each against the charter
   * as it is held, refused where two charters they fill would claim one id:
   * planned one by one, none of them sees what another brings (VENDOR-FR-020,
   * VENDOR-FR-030). A charter filled twice, as two charters update including
   * it, claims its ids once.
   */
  static assertDistinctIds(charterInstallLists: readonly (readonly CharterInstall[])[]): void {
    const claimById = new Map<string, { charterName: string; uri: string }>();
    for (const { charterName, charterSource } of charterInstallLists.flat())
      for (const { id, uri } of charterSource.rawPrimitives) {
        const heldClaim = claimById.get(id);
        if (heldClaim !== undefined && heldClaim.charterName !== charterName)
          throw new ClaimedIdFault(
            `${heldClaim.uri} and ${uri} claim id "${id}", and one id names one primitive in the whole charter.`,
            "Update these charters one at a time, once one of their sources gives the id up.",
            { internal: false },
          );
        claimById.set(id, { charterName, uri });
      }
  }

  private constructor() {}
}
