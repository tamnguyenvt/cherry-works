import { BuiltinPrimitives } from "../../domain/builtin/index.js";
import { CharterMetadataListFactory } from "../../domain/models/charter/charter-metadata-list.factory.js";
import type { CharterMetadataList } from "../../domain/models/charter/charter-metadata-list.js";
import { CharterRootFactory } from "../../domain/models/charter/charter-root.factory.js";
import type { CharterRoot } from "../../domain/models/charter/charter-root.js";
import type { ForManagingCharter } from "../port/out/managing-charter.port.js";

/** Reads a repository's charter, every use case the same way. */
export class LoadCharterService {
  /**
   * One repository's charter, read off its three layers (FR-008): each charter
   * it authored and each it installed, as the charter repository keeps them,
   * and what the engine brings. Each primitive comes by its layer, kind and
   * id; where it is kept is the repository's to know (FR-023, CORE-FR-213),
   * and so is where an author edits it (SDK-FR-020). A charter whose
   * `cw-vendor.json` does not read refuses the whole charter, naming the file
   * (VENDOR-FR-010).
   */
  async loadCharterRoot(
    charterRepository: Pick<ForManagingCharter, "loadCharter" | "loadCharterMetadata" | "describeCharterPlace">,
  ): Promise<CharterRoot> {
    const [rawPrimitives] = await Promise.all([
      charterRepository.loadCharter(),
      this.loadCharterMetadataList(charterRepository),
    ]);
    return CharterRootFactory.create(
      [...new BuiltinPrimitives().primitives, ...rawPrimitives],
      charterRepository.describeCharterPlace(),
    );
  }

  /** Every charter a repository's charter holds, authored or installed
   *  (VENDOR-FR-009, VENDOR-FR-010). */
  async loadCharterMetadataList(
    charterRepository: Pick<ForManagingCharter, "loadCharterMetadata">,
  ): Promise<CharterMetadataList> {
    return CharterMetadataListFactory.create(await charterRepository.loadCharterMetadata());
  }
}

/** The one LoadCharterService the composition root hands every use case that asks for it. */
export const loadCharterService = new LoadCharterService();
