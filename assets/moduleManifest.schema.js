const ModuleManifest = {

  validate(manifest) {
    if (!manifest?.id || !manifest?.type) return false;

    if (!["page", "feature", "plugin"].includes(manifest.type)) {
      console.warn("[Manifest] Invalid type:", manifest.type);
      return false;
    }

    return true;
  }

};

window.ModuleManifest = ModuleManifest;