import type { ItemIconKey } from "@seki/core";
import { GAME_ICON_PATHS } from "./game-icon-paths";
import type { IconDrawing } from "./icon-drawing";

export type { IconDrawing } from "./icon-drawing";

/**
 * Item icons drawn for this game (ADR-0073): one 32 × 32 grid, weapons with the muzzle to the
 * right, ammo upright; garments, mods and junk front on (stage 2). Implants and consumables come
 * after game-icons.net (`game-icon-paths.ts`, CC BY 3.0). Data table: the size budget in
 * `item-icons.test.tsx` counts these strings.
 */
export const ICON_VIEWBOX = "0 0 32 32";

export const ICON_PATHS: Readonly<Record<ItemIconKey, IconDrawing>> = {
  pistol: {
    body: ["M6 9.5h21v5H6z", "M8 14.5h14l-1 2.5h-6.3l-1.8 8.5H7.5l1.6-8.5z"],
    line: ["M14.7 17v2.6h4.4l1.2-2.6", "M23 12h2.5"],
  },
  revolver: {
    body: ["M15.5 10h14v3.4h-14z", "M9.5 9h6v7.5h-6z", "M6.5 9h3v7.5h-3z", "M6.5 16.5h4.5l-1.8 2.2-2 7H3.6l1.8-7.5z", "M6.5 9l-2.2-2h2.6l1.4 2z"],
    line: ["M9.5 16.5v2.8h3.6l1-2.8", "M16.5 15h9", "M12.5 10.5v4.5"],
  },
  smg: {
    body: ["M6 10.5h18v5.5H6z", "M24 12h5.5v2.2H24z", "M15.5 16h3.2l-.6 9h-3.2z", "M8.5 16h3.5l-1.8 6.5H6.8z"],
    line: ["M6 12H2.5v4.5H6", "M10 10.5V8.5h4v2"],
  },
  shotgun: {
    body: ["M11 10h19.5v2.6H11z", "M18 12.6h8.5v3.2H18z", "M5.5 10h6v6h-6z", "M5.5 10.5L1.5 12v5.5l4-1.5z", "M8 16h3l-1.6 6H6.6z"],
    line: ["M11.5 14.2H18", "M11 16v2.2h3.2"],
  },
  rifle: {
    body: ["M7.5 11h14v4.5h-14z", "M21.5 11.5h6v3.5h-6z", "M27.5 12.6h3v1.4h-3z", "M14.5 15.5h3.4l1.4 7.5h-3.4z", "M9.5 15.5h3L11 21H8.2z", "M7.5 11.5l-6 1v5l6-1z"],
    line: ["M10 11V8.5h7V11"],
  },
  dmr: {
    body: ["M7 12.5h15v4H7z", "M10 8h10v3H10z", "M20 7.3h2.2v4.4H20z", "M22 13.6h9v1.6h-9z", "M15 16.5h3v4h-3z", "M9.5 16.5h3L11 22H8.2z", "M7 12.5L1.5 13v5.5l5.5-2z"],
    line: ["M12 11v1.5M18 11v1.5", "M25.5 15.2l-2 6M25.5 15.2l2 6"],
  },
  baton: {
    body: ["M3.7 25.7l7-7 2.6 2.6-7 7z", "M11.15 19.15l8-8 1.7 1.7-8 8z", "M19.43 11.43l7-7 1.14 1.14-7 7z"],
    line: ["M4.6 29.4q-2.4 1-2.4-1.6"],
  },
  blade: {
    body: ["M2.94 26.94l6-6 2.12 2.12-6 6z", "M9.15 21.15Q18 11.5 29.2 2.8Q21 14 10.85 22.85z"],
    line: ["M8.4 20.4l3.2 3.2", "M4.5 26.5l1 1M6.5 24.5l1 1"],
  },
  "ammo-9mm": {
    body: [
      "M7.2 15h4.6v11H7.2z",
      "M7.2 15v-1.5c0-2 1-3.5 2.3-3.5s2.3 1.5 2.3 3.5V15z",
      "M13.7 15h4.6v11h-4.6z",
      "M13.7 15v-1.5c0-2 1-3.5 2.3-3.5s2.3 1.5 2.3 3.5V15z",
      "M20.2 15h4.6v11h-4.6z",
      "M20.2 15v-1.5c0-2 1-3.5 2.3-3.5s2.3 1.5 2.3 3.5V15z",
    ],
    line: ["M7.2 24h4.6M13.7 24h4.6M20.2 24h4.6"],
  },
  "ammo-44": {
    body: ["M8 14h6v12H8z", "M8 14v-2.2c0-1.5 1.3-2.8 3-2.8s3 1.3 3 2.8V14z", "M18 14h6v12h-6z", "M18 14v-2.2c0-1.5 1.3-2.8 3-2.8s3 1.3 3 2.8V14z"],
    line: ["M7.4 26h7.2M17.4 26h7.2", "M8 23.5h6M18 23.5h6"],
  },
  "ammo-12g": {
    body: ["M7.8 6h6.4v15H7.8z", "M7.3 21h7.4v5H7.3z", "M17.8 6h6.4v15h-6.4z", "M17.3 21h7.4v5h-7.4z"],
    line: ["M9.3 6.5L11 8.2l1.7-1.7M19.3 6.5L21 8.2l1.7-1.7"],
  },
  "ammo-556": {
    body: [
      "M7.4 13h4.2v14H7.4z",
      "M7.4 13l1.1-2.2h2l1.1 2.2z",
      "M8.5 10.8l1-5.3 1 5.3z",
      "M13.9 13h4.2v14h-4.2z",
      "M13.9 13l1.1-2.2h2l1.1 2.2z",
      "M15 10.8l1-5.3 1 5.3z",
      "M20.4 13h4.2v14h-4.2z",
      "M20.4 13l1.1-2.2h2l1.1 2.2z",
      "M21.5 10.8l1-5.3 1 5.3z",
    ],
  },
  // Stage 2: garments by what they are (the rarity's colour tells the pieces apart).
  jacket: { body: ["M11.5 4.5L5 7.5 2.5 19l4 1 2-6V28h15V14l2 6 4-1L27 7.5l-6.5-3-2.5 3h-4z"], line: ["M13 5l3 4.5 3-4.5", "M16 9.5V28", "M10 20h3.5M18.5 20H22"] },
  pants: { body: ["M8 3.5h16l2 25h-7L16 12l-3 16.5H6z"], line: ["M8 7.5h16", "M9.5 15h3.5v5H9.5zM19 15h3.5v5H19z"] },
  helmet: { body: ["M4.5 23C4.5 13 10 6.5 17 6.5S28.5 12 28.5 19v5.5H4.5z"], line: ["M15 13.5h13.5v6H15z", "M8 24.5v3h7v-3"] },
  visor: { body: ["M3 12.5h26v7l-3.5 2.5h-6.5L16 19l-3 3H6.5L3 19.5z"], line: ["M1.5 15H3M29 15h1.5", "M6 15.5h7M19 15.5h7"] },
  vest: { body: ["M9 3.5h4l3 4 3-4h4l1 7 3 3V28H5V13.5l3-3z"], line: ["M9 16h14v7H9z", "M5 13.5h4M23 13.5h4"] },
  overalls: { body: ["M9 3h4v6h6V3h4v10.5l2 15h-7l-2-12-2 12H7l2-15z"], line: ["M9 13.5h14", "M13 9h6v4.5h-6z"] },
  // Mods, as they sit on the gun: muzzle, sight, magazine.
  suppressor: { body: ["M3.5 12h22v8h-22z", "M25.5 13.5h3.5v5h-3.5z"], line: ["M9 12v8M14.5 12v8M20 12v8"] },
  "holo-sight": { body: ["M4 22h24v4H4z", "M6 7h20v15H6z"], line: ["M9.5 10.5h13v8h-13z", "M16 12v5M13.5 14.5h5"] },
  magazine: { body: ["M11 3.5h9l2.5 13 1 11.5h-9.5l-.5-11.5z"], line: ["M11.5 7.5h8.5M12 11.5h9M13 15.5h9", "M13 24.5h10"] },
  // Junk: a broken board, a gear with a spring, a chip.
  scrap: { body: ["M3 8h19l-3 5.5 4.5 3.5-2 9H3z"], line: ["M7 12h5v4.5H7z", "M15 12v6.5h3.5", "M7 21.5h9", "M23.5 17l5-2M21.5 26l6 2"] },
  "weapon-parts": {
    body: ["M20 11.5L22.5 12 22.5 14 20 14.5 19 17 20.5 19 19 20.5 17 19 14.5 20 14 22.5 12 22.5 11.5 20 9 19 7 20.5 5.5 19 7 17 6 14.5 3.5 14 3.5 12 6 11.5 7 9 5.5 7 7 5.5 9 7 11.5 6 12 3.5 14 3.5 14.5 6 17 7 19 5.5 20.5 7 19 9z"],
    line: ["M13 10.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 1 0 0-5z", "M19 25l2-4 2 6 2-6 2 6 2-4"],
  },
  datachip: { body: ["M8 4.5h12l4 4v19H8z"], line: ["M11 8.5h10v8H11z", "M11.5 20.5v4M14.5 20.5v4M17.5 20.5v4M20.5 20.5v4"] },
  // The cyberdeck, drawn here (decision of 6.11 after ADR-0059 stage 6): a deck with a screen and
  // two ports, its neural plug underneath.
  deck: { body: ["M3.5 9.5h21l4 4v9h-25z"], line: ["M7 13h10v6H7z", "M20.5 14v5M24 15.5v3.5", "M11 22.5v3h6v-3", "M14 25.5v3"] },
  // Implants and consumables after game-icons.net (CC BY 3.0).
  ...GAME_ICON_PATHS,
};
