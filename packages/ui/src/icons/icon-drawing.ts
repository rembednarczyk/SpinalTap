/**
 * One item icon on the 32 × 32 grid (ADR-0073): `body` paths get the outline and a faint fill,
 * `line` paths only the outline; both take `currentColor`, so one drawing serves every rarity.
 */
export interface IconDrawing {
  readonly body: readonly string[];
  readonly line?: readonly string[];
}
