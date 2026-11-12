import { ProviderComponent } from "./provider-component.js";

/**
 * One file a host reads as settings: JSON it shares with the repository, which
 * this engine writes its own fields into and never over (FR-018, FR-146).
 *
 * No frontmatter, no body and no stamp: JSON has nowhere to carry one, and the
 * file is the repository's as much as this engine's, so it is known by the
 * part it plays instead.
 */
export abstract class SettingBasedComponent<Settings extends object> extends ProviderComponent {
  constructor(
    host: string,
    /** The part it plays, which is its id there: one such file to a host. */
    part: string,
    /** The fields this engine speaks for in that file. */
    readonly settings: Settings,
  ) {
    // Written into what is there rather than in place of it, by the projection:
    // every other field is the repository's (FR-018).
    super(host, "charter", part, `${JSON.stringify(settings, undefined, 2)}\n`);
  }
}
