import { describe, expect, it } from "vitest";
import { buildPopupViewModel } from "../../src/extension/popup/popupViewModel.js";

describe("buildPopupViewModel", () => {
  it("renders a healthy state", () => {
    const vm = buildPopupViewModel({
      status: { success: true, data: { initialized: true, activeProfileId: "rodrigo-matos" } },
      profile: { success: true, data: { id: "rodrigo-matos", name: "Rodrigo Matos Silva" } },
      pageConnected: true,
    });

    expect(vm.statusLabel).toBe("Ready");
    expect(vm.profileLabel).toBe("Rodrigo Matos Silva");
    expect(vm.pageLabel).toBe("Connected");
    expect(vm.jobMatchLabel).toBe("Available in next phase");
  });

  it("renders missing/null responses as Unknown", () => {
    const vm = buildPopupViewModel({ status: null, profile: null, pageConnected: false });
    expect(vm.statusLabel).toBe("Unknown");
    expect(vm.profileLabel).toBe("Unknown");
    expect(vm.pageLabel).toBe("Unavailable on this page");
  });

  it("renders a PROFILE_NOT_LOADED error as 'Not loaded'", () => {
    const vm = buildPopupViewModel({
      status: { success: true, data: { initialized: false, activeProfileId: null } },
      profile: { success: false, error: { code: "PROFILE_NOT_LOADED", message: "No active profile loaded yet." } },
      pageConnected: false,
    });

    expect(vm.profileLabel).toBe("Not loaded");
  });

  it("renders an extension status error with its message", () => {
    const vm = buildPopupViewModel({
      status: { success: false, error: { code: "EXTENSION_INITIALIZATION_FAILED", message: "profile.json missing" } },
      profile: null,
      pageConnected: false,
    });

    expect(vm.statusLabel).toBe("Error: profile.json missing");
  });

  it("renders an unavailable content script as 'Unavailable on this page'", () => {
    const vm = buildPopupViewModel({ status: null, profile: null, pageConnected: false });
    expect(vm.pageLabel).toBe("Unavailable on this page");
  });
});
