import { ProfileError } from "./errors.js";
import { buildIndex } from "./chunker.js";
import type { ProfileLoader } from "./profileLoader.js";
import type { Profile, ProfileIndex } from "./types.js";

export interface ProfileManager {
  load(profileId: string): Promise<Profile>;
  getActiveProfile(): Profile | null;
  getActiveIndex(): ProfileIndex | null;
  reload(profileId: string): Promise<Profile>;
  clear(): void;
}

/**
 * Owns the single active profile for a session (SDD section 26: only one
 * profile may be active at a time; profiles must never be mixed).
 */
export class DefaultProfileManager implements ProfileManager {
  private activeProfile: Profile | null = null;
  private activeIndex: ProfileIndex | null = null;

  constructor(private readonly loader: ProfileLoader) {}

  async load(profileId: string): Promise<Profile> {
    const profile = await this.loader.loadProfile(profileId);
    this.activeProfile = profile;
    this.activeIndex = buildIndex(profile);
    return profile;
  }

  getActiveProfile(): Profile | null {
    return this.activeProfile;
  }

  getActiveIndex(): ProfileIndex | null {
    return this.activeIndex;
  }

  /**
   * Reloads the currently active profile. Per SDD section 24, this only
   * re-reads the already-vendored local copy — it never synchronizes
   * (network/GitHub access is out of scope here; see scripts/sync-profile.ts).
   */
  async reload(profileId: string): Promise<Profile> {
    if (!this.activeProfile || this.activeProfile.id !== profileId) {
      throw new ProfileError(
        "PROFILE_NOT_FOUND",
        `Cannot reload "${profileId}": it is not the currently active profile.`
      );
    }
    return this.load(profileId);
  }

  clear(): void {
    this.activeProfile = null;
    this.activeIndex = null;
  }
}
