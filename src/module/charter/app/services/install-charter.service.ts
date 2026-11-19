import type { CharterMetadataList } from "../../domain/models/charter/charter-metadata-list.js";
import { CharterRootFactory } from "../../domain/models/charter/charter-root.factory.js";
import type { CharterRoot } from "../../domain/models/charter/charter-root.js";
import { ValidCharterNameSpec } from "../../domain/models/charter/valid-charter-name.specification.js";
import { VendorRecord } from "../../domain/models/charter/vendor-record.value-object.js";
import {
  AmbiguousAsNameFault,
  ClaimedIdFault,
  HeldCharterNameFault,
  ReservedCharterNameFault,
  UnexpectedSourceShapeFault,
} from "../../domain/models/charter.fault.js";
import { CharterInstall, type CharterInstallRequest } from "../../domain/models/vendor/charter-install.js";
import type { VendorSource } from "../../domain/models/vendor/vendor-source.js";

export class InstallCharterService {
  /**
   * Every charter one source's install or injection puts in the repository,
   * every refusal raised before anything is written.
   *
   * A source is a vendor when it authors charters; a source authoring none is
   * refused (FR-042). With none named, every charter it authored is taken; a
   * charter named that it did not author is refused naming those it did
   * (VENDOR-FR-017). Every other charter of the source a charter taken names
   * an id of is taken with it, and so on, each once; one the source installed
   * itself is copied as it stands, its `cw-vendor.json` with it, and is never
   * taken unless one taken includes it (VENDOR-FR-018, VENDOR-FR-019). `--as`
   * names one charter alone (VENDOR-FR-020).
   *
   * Installed, a charter whose name a charter installed from the same source
   * holds replaces it whole; one held otherwise is refused, suggesting `--as`
   * (VENDOR-FR-020). Injected, any name held is refused, and no
   * `cw-vendor.json` is kept (VENDOR-FR-022). Either way an id the charter
   * root would then hold twice is refused naming both files (VENDOR-FR-009).
   */
  planCharterInstalls(
    vendorSource: VendorSource,
    charterInstallRequest: CharterInstallRequest,
    charterMetadataList: CharterMetadataList,
    charterRoot: CharterRoot,
  ): readonly CharterInstall[] {
    const {
      origin: { sourceUri },
    } = vendorSource;
    const { selectedCharterNames, asName, version, isInjected } = charterInstallRequest;

    const authoredCharterNames = vendorSource.charters
      .filter((sourceCharter) => !sourceCharter.isInstalled)
      .map(({ name }) => name);
    if (authoredCharterNames.length === 0)
      throw new UnexpectedSourceShapeFault(
        `${sourceUri} is no vendor: it authors no charter.`,
        "Check that the source authors its charters as cw lays them out, at the version asked for.",
        { internal: false },
      );
    const unauthoredCharterNames = selectedCharterNames.filter(
      (charterName) => !authoredCharterNames.includes(charterName),
    );
    if (unauthoredCharterNames.length > 0)
      throw new UnexpectedSourceShapeFault(
        `${sourceUri} authors no charter ${unauthoredCharterNames.join(", ")}.`,
        `Name one it authors: ${authoredCharterNames.join(", ")}.`,
        { internal: false },
      );

    const pickedCharterNames = selectedCharterNames.length === 0 ? authoredCharterNames : selectedCharterNames;
    if (asName !== undefined && pickedCharterNames.length !== 1)
      throw new AmbiguousAsNameFault(
        "--as names one charter, and this would install more than one.",
        "Name the one charter with --charter, and run this again.",
        { internal: false },
      );

    // Every charter a charter taken names an id of, and so on (VENDOR-FR-018).
    const sourceCharterRoot = CharterRootFactory.create(
      vendorSource.charters.flatMap(({ rawPrimitives }) => rawPrimitives),
      "",
    );
    const charterNameById = new Map(
      vendorSource.charters.flatMap(({ name, rawPrimitives }) => rawPrimitives.map(({ id }) => [id, name] as const)),
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

    // Where no version was asked for, the commit fetched (VENDOR-FR-017).
    const installedVersion = version ?? vendorSource.commitId;
    const charterInstalls = vendorSource.charters
      .filter(({ name }) => takenCharterNames.has(name))
      .map(
        (sourceCharter) =>
          new CharterInstall(
            asName !== undefined && pickedCharterNames.includes(sourceCharter.name) ? asName : sourceCharter.name,
            sourceCharter,
            // Written on this machine, naming the source asked, whoever installed
            // it in the source (VENDOR-FR-019).
            isInjected ? undefined : new VendorRecord(sourceCharter.name, sourceUri, installedVersion),
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
    for (const { charterName, vendorRecord } of charterInstalls) {
      if (!new ValidCharterNameSpec().isSatisfiedBy(charterName))
        throw new ReservedCharterNameFault(
          `"${charterName}" cannot name a charter: a charter is named as an id is, and never as a kind is, as a folder an older layout kept, nor as root.`,
          "Install it under another name with --as.",
          { internal: false },
        );
      const heldCharter = charterMetadataList.findCharter(charterName);
      if (heldCharter === undefined) continue;
      const isFromTheSameSource =
        !isInjected &&
        heldCharter.vendorRecord !== undefined &&
        vendorRecord !== undefined &&
        heldCharter.vendorRecord.source === vendorRecord.source;
      if (!isFromTheSameSource)
        throw new HeldCharterNameFault(
          heldCharter.vendorRecord === undefined
            ? `${charterName} is a charter this repository authored, at ${heldCharter.uri}.`
            : `${charterName} is held by a charter installed from ${heldCharter.vendorRecord.source}, at ${heldCharter.uri}.`,
          `Install it under another name with --as=<name>.`,
          { internal: false },
        );
      replacedCharterNames.push(charterName);
    }

    // One id names one primitive in the whole charter, once what is replaced
    // is gone (VENDOR-FR-009, VENDOR-FR-022).
    const uriById = new Map(
      charterRoot.primitives
        .filter(({ layer }) => layer.charterName === undefined || !replacedCharterNames.includes(layer.charterName))
        .map((primitive) => [primitive.headers.id, primitive.uri] as const),
    );
    const installedRawPrimitives = vendorSource.charters
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
}

/** The one InstallCharterService the composition root hands every use case that asks for it. */
export const installCharterService = new InstallCharterService();
