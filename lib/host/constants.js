// Shared host constants. Kept separate so every domain module imports the
// same values instead of re-declaring them.
export const STUDIO_DIR = "temp_design_folder";
export const KEY_REF = "OPENROUTER_API_KEY";
export const VISION_COOLDOWN_MS = 10 * 60 * 1000;
export const READ_CAP = 400 * 1024;
export const IMAGE_CAP = 12 * 1024 * 1024;
export const LOGO_CAP = 2 * 1024 * 1024;
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const VERIFY_DEBOUNCE_MS = 4000;
export const VERIFY_MAX_ARM_MS = 15 * 60 * 1000;
