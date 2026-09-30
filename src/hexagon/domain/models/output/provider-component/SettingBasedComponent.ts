import { ProviderComponent } from "./ProviderComponent.js";

/**
 * One file a host reads as settings: JSON it shares with the repository, which
 * this engine writes its own fields into and never over (FR-018, FR-146).
 *
 * No frontmatter, no body and no stamp: JSON has nowhere to carry one, and the
 * file is the repository's as much as this engine's, so it is known by where it
 * is instead.
 */
export abstract class SettingBasedComponent<Settings extends object> extends ProviderComponent {
  protected constructor(
    path: string,
    /** The fields this engine speaks for in that file. */
    readonly settings: Settings,
  ) {
    // Written into what is there rather than in place of it: every other field
    // is the repository's (FR-018).
    super(path, `${JSON.stringify(settings, undefined, 2)}\n`, "mergeJSON");
  }
}
