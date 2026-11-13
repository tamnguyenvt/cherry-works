import { BuiltinPrimitives } from "../../domain/builtin/index.js";
import { CharterRootFactory } from "../../domain/models/charter/charter-root.factory.js";
import type { CharterRoot } from "../../domain/models/charter/charter-root.js";
import type { ForManagingCharter } from "../port/out/managing-charter.port.js";

/** Reads a repository's charter, every use case the same way. */
export class LoadCharterService {
  /**
   * One repository's charter, read off its three layers (FR-008): its own and its
   * vendors', as the charter repository keeps them, and what the engine
   * brings. Each primitive comes by its layer, kind and id; where it is kept
   * is the repository's to know (FR-023, CORE-FR-213), and so is where an
   * author edits it (SDK-FR-020).
   */
  async loadCharterRoot(
    charterRepository: Pick<ForManagingCharter, "loadCharter" | "describeCharterPlace">,
  ): Promise<CharterRoot> {
    return CharterRootFactory.create(
      [...new BuiltinPrimitives().primitives, ...(await charterRepository.loadCharter())],
      charterRepository.describeCharterPlace(),
    );
  }
}

/** The one LoadCharterService the composition root hands every use case that asks for it. */
export const loadCharterService = new LoadCharterService();
