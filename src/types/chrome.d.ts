// WXT 0.20 stopped wiring @types/chrome into its generated tsconfig, and TS no
// longer auto-includes the `chrome` global ambient namespace on its own, so the
// type-checker loses `chrome.*` (used for the offscreen API). This reference
// pulls @types/chrome back in for the whole project.
/// <reference types="chrome" />
