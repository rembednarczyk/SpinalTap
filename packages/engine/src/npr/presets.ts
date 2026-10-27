/** Per-surface NPR parameters. Colours are hex strings so presets stay plain data. */
export interface ToonPreset {
  readonly base: string;
  readonly emissive?: string;
  readonly rim?: string;
  readonly rimStrength?: number;
  readonly gloss?: number;
  readonly windows?: boolean;
  /** Character fill light strength (0 = environment, no fill). */
  readonly fill?: number;
  /** Inverted-hull outline; reserved for characters (see ADR-0003). */
  readonly outline?: boolean;
}

const CHAR = { rim: "#9ff6ff", rimStrength: 0.55, outline: true, fill: 0.55 } as const;

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
  // Tessen security (ADR-0024): navy uniform, grey plates, a cyan visor strip.
  corpoUniform: { base: "#22324a", ...CHAR, rim: "#8fd8ff" },
  corpoPlate: { base: "#4a505c", gloss: 0.5, ...CHAR },
  corpoVisor: { base: "#000000", emissive: "#39d0ff", rimStrength: 0, outline: false },
  // Civilian.
  umeCoat: { base: "#b9a68a", ...CHAR },
  umeHair: { base: "#c9c9cf", ...CHAR },
  umbrella: { base: "#c23b4f", ...CHAR },
  // Ripperdoc.
  docCoat: { base: "#aeb8bd", ...CHAR },
  docGoggles: { base: "#000000", emissive: "#39ffd0", rimStrength: 0, outline: false },
  // Anime cast (reference: 1990s cyberpunk cel animation).
  sekiHair: { base: "#151a2e", ...CHAR, rim: "#7fa6ff", rimStrength: 0.5 },
  sekiTop: { base: "#1c1d22", ...CHAR },
  sekiPants: { base: "#6d6f6c", ...CHAR },
  sekiShoes: { base: "#7a3a22", ...CHAR },
  cyberIvory: { base: "#e2d8bb", gloss: 0.35, ...CHAR },
  cyberCopper: { base: "#b8733c", gloss: 0.8, ...CHAR, rim: "#ffd29a" },
  cyberDark: { base: "#2b2f36", gloss: 0.5, ...CHAR },
  eyes: { base: "#10131b", rimStrength: 0, outline: false, fill: 0.3 },
  lips: { base: "#a2383f", rimStrength: 0, outline: false, fill: 0.55 },
  moriCoat: { base: "#ddd3b4", ...CHAR },
  moriHair: { base: "#e8e6dc", ...CHAR },
  // Merged procedural characters: colour per vertex, baked from the part presets above.
  charVertexColor: { base: "#ffffff", ...CHAR },
  charVertexColorFlat: { base: "#ffffff", rimStrength: 0, outline: false, fill: 0.45 },
  // District dressing: merged props coloured per vertex.
  dressing: { base: "#ffffff", gloss: 0.15, rimStrength: 0.1, rim: "#8fb3c9" },
  puddle: { base: "#16181f", gloss: 1.8, rimStrength: 0 },
  // Harbour water (ADR-0024): near black, glossy, so the quay lights streak across it.
  water: { base: "#0a1620", gloss: 1.6, rimStrength: 0.06, rim: "#5ab0ff" },
  vendingGlow: { base: "#000000", emissive: "#9fe8ff", rimStrength: 0, outline: false },
  // Imported glTF characters: colour comes from the model.
  importedCharacter: { base: "#ffffff", ...CHAR },
  importedProp: { base: "#ffffff", rimStrength: 0.12, rim: "#8fb3c9" },
} as const satisfies Record<string, ToonPreset>;

export type PresetName = keyof typeof PRESETS;
