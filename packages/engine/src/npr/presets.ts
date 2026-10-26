/** Per-surface NPR parameters. Colours are hex strings so presets stay plain data. */
export interface ToonPreset {
  readonly base: string;
  readonly emissive?: string;
  readonly rim?: string;
  readonly rimStrength?: number;
  readonly gloss?: number;
  readonly windows?: boolean;
  /** Inverted-hull outline; reserved for characters (see ADR-0003). */
  readonly outline?: boolean;
}

const CHAR = { rim: "#9ff6ff", rimStrength: 0.55, outline: true } as const;

export const PRESETS = {
  // Environment.
  asphalt: { base: "#272a33", gloss: 0.85, rimStrength: 0 },
  concrete: { base: "#59606b", rimStrength: 0.08, rim: "#8fb3c9", windows: true },
  glass: { base: "#33495a", gloss: 0.4, rimStrength: 0.12, rim: "#7fe8ff", windows: true },
  metal: { base: "#474c55", gloss: 0.3, rimStrength: 0.1, rim: "#8fb3c9" },
  sidewalk: { base: "#4a4f58", gloss: 0.25, rimStrength: 0 },
  pole: { base: "#2e3138", gloss: 0.3, rimStrength: 0.1, rim: "#8fb3c9" },
  // Heroine.
  skin: { base: "#f2dccd", ...CHAR },
  heroineHair: { base: "#3a2552", ...CHAR, rim: "#ff8fd0" },
  heroineCoat: { base: "#2b3343", ...CHAR },
  heroineLegs: { base: "#1b1e29", ...CHAR },
  heroineVisor: { base: "#000000", emissive: "#5ff2ff", rimStrength: 0, outline: false },
  gun: { base: "#1d2026", gloss: 0.6, ...CHAR },
  // Fixer.
  fixerSkin: { base: "#b9825f", ...CHAR },
  fixerJacket: { base: "#8d4a26", ...CHAR },
  fixerPants: { base: "#2e2a26", ...CHAR },
  shades: { base: "#050507", gloss: 1, ...CHAR },
  gold: { base: "#e0b24a", gloss: 1, ...CHAR },
  // Ganger.
  gangerHood: { base: "#2f6b3a", ...CHAR, rim: "#b6ff9f" },
  gangerPants: { base: "#1f2420", ...CHAR },
  gangerMask: { base: "#000000", emissive: "#ff2b3a", rimStrength: 0, outline: false },
  // Civilian.
  umeCoat: { base: "#b9a68a", ...CHAR },
  umeHair: { base: "#c9c9cf", ...CHAR },
  umbrella: { base: "#c23b4f", ...CHAR },
} as const satisfies Record<string, ToonPreset>;

export type PresetName = keyof typeof PRESETS;
