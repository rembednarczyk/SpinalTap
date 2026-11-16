import type { StreetPropKind } from "./city-geo";

/**
 * The building sites of the map city (ADR-0087 stage 1): the pieces `tools/osm-import`'s
 * generator (`construction-site.ts`) lays on a site of the map, as street pieces whose variant
 * holds their layout, so the simulation that collides with them, the renderer that draws them and
 * the glitch scan read one layout. Each piece's frame: local +x along the fence, local +z out of
 * the site (to the street), foot at the origin.
 *
 * - `site-fence`: a stretch of the fence, up to `SITE_PANEL` m long, its length, the ground's rise
 *   along it, whether it carries a developer's hologram ad and the colour of the LED strip on top;
 * - `site-gate`: the open gate, `SITE_GATE.gate` m wide on the side to a street with a way in, else
 *   the wicket, `SITE_GATE.wicket` m;
 * - `site-board`: the information board by the gate, on the fence's outer face;
 * - `site-cabin`: an office container of the back yard, its door towards the site; stacked ones
 *   stand on the one under them.
 */
export const SITE_KINDS: ReadonlySet<StreetPropKind> = new Set<StreetPropKind>(["site-fence", "site-gate", "site-board", "site-cabin"]);

/** The longest stretch of the fence one piece is (m): a panel of a site fence. */
export const SITE_PANEL = 2.5;

/** The fence (m): panel height over the ground, thickness, the post's half side. */
export const SITE_FENCE = { height: 2.2, thick: 0.08, post: 0.05 } as const;

/** The gate's openings (m): the gate for vehicles, the wicket for people; the posts' half side and height. */
export const SITE_GATE = { gate: 6, wicket: 1.2, post: 0.12, height: 2.5 } as const;

/** An office container (m): half length along the fence, half depth, height (a 20 ft cabin). */
export const SITE_CABIN = { hx: 3.03, hz: 1.22, height: 2.6 } as const;

/** The information board (m): width, height of its face's bottom and top over the ground. */
export const SITE_BOARD = { width: 2.4, bottom: 0.7, top: 2.1 } as const;

/** How many designs the hologram ads, the LED strips, the boards and the cabins come in. */
export const SITE_LOOKS = { ads: 4, leds: 4, boards: 4, cabins: 4 } as const;

export interface SiteFenceLayout {
  /** Along local +x, centred on the foot (m). */
  readonly length: number;
  /** How much higher the ground is at the +x end than at the -x end (m). */
  readonly rise: number;
  /** The hologram ad on its outer face, `SITE_LOOKS.ads` designs; null for none. */
  readonly ad: number | null;
  /** The LED strip's colour, of `SITE_LOOKS.leds`. */
  readonly led: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Length (cm) in bits 0-8, rise (cm + 128) in bits 9-16, the ad (design + 1, 0 for none) in bits 17-19, the LED's colour in bits 20-21. */
export const siteFenceVariant = (f: SiteFenceLayout): number =>
  clamp(Math.round(f.length * 100), 0, 511) +
  512 * (clamp(Math.round(f.rise * 100), -128, 127) + 128) +
  131072 * (f.ad === null ? 0 : (f.ad % SITE_LOOKS.ads) + 1) +
  1048576 * (f.led % SITE_LOOKS.leds);

export const siteFenceLayout = (variant: number): SiteFenceLayout => {
  const ad = (variant >> 17) & 7;
  return { length: (variant & 511) / 100, rise: (((variant >> 9) & 255) - 128) / 100, ad: ad === 0 ? null : ad - 1, led: (variant >> 20) & 3 };
};

/** The gate a variant holds: bit 0 the wicket, bits 1-2 the LED's colour, bit 3 its sliding leaf parked towards local +x (else -x), behind the fence. */
export const siteGateVariant = (wicket: boolean, led: number, leafPlusX: boolean): number => (wicket ? 1 : 0) + 2 * (led % SITE_LOOKS.leds) + (leafPlusX ? 8 : 0);

export interface SiteGateLayout {
  /** The opening between the posts (m). */
  readonly width: number;
  readonly wicket: boolean;
  readonly led: number;
  /** Which way along local x the open leaf is parked, behind the fence: +1 or -1. */
  readonly leaf: 1 | -1;
}

export const siteGateLayout = (variant: number): SiteGateLayout => {
  const wicket = (variant & 1) === 1;
  return { width: wicket ? SITE_GATE.wicket : SITE_GATE.gate, wicket, led: (variant >> 1) & 3, leaf: (variant & 8) !== 0 ? 1 : -1 };
};

/** How far behind the fence's line the gate's open leaf is parked (m), and how much longer than the opening it is. */
export const SITE_LEAF = { behind: 0.2, over: 0.2 } as const;
