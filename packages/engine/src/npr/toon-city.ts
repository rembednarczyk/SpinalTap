/**
 * Toon shader parts of the city from map data (ADR-0044), compiled in only with the FACADE or
 * MAP_GROUND define, so every other material is unchanged. They paint in metres from the UVs
 * the plans bake (`renderer/mapcity`), stepped like cels, and blend their detail out with
 * distance so far grids do not shimmer.
 */

/**
 * Facades: uv = (along the wall, up from the ground floor) in metres; uv2.x = storey in
 * decimetres (integer) + bay / 10, uv2.y = style (integer: window style, +8 shop front, 16 roof)
 * + seed. `selfLit` runs 1 at night to 0.5 by day: lit windows follow it.
 */
export const FACADE_GLSL = /* glsl */ `
#ifdef FACADE
void facadeDecode(vec2 meta, out float storey, out float bay, out float style, out float shop, out float seed) {
  storey = floor(meta.x + 0.0005) / 10.0;
  // Quantised: an interpolated constant wobbles in its last bits, and hashes of it would sparkle.
  bay = floor(fract(meta.x) * 1000.0 + 0.5) / 100.0;
  float code = floor(meta.y + 0.0005);
  seed = (floor(fract(meta.y) * 256.0) + 0.5) / 256.0;
  shop = step(7.5, code) * (1.0 - step(15.5, code));
  style = code - 8.0 * shop;
}

/** Plaster: dark plinth, rusticated ground floor, pilasters, lintels and sills, grime under the cornices, roof tiles. */
vec3 facadePaint(vec3 albedo, vec2 q, vec2 meta, vec3 n, vec3 p, float dist) {
  float storey; float bay; float style; float shop; float seed;
  facadeDecode(meta, storey, bay, style, shop, seed);
  float near = 1.0 - smoothstep(50.0, 130.0, dist);
  float k = 1.0;
  if (style > 15.5) {
    // Roofs: tile courses and a few repaired patches.
    k *= 0.86 + 0.14 * step(0.5, fract(p.y / 0.32 + 0.5 * step(0.5, fract((p.x + p.z) / 0.5)))) * near;
    k *= 1.0 - 0.12 * step(0.7, vnoise(p.xz * 0.3 + seed * 20.0));
    return albedo * k;
  }
  if (abs(n.y) > 0.5) return albedo * 0.9;
  if (q.y < 0.55) k *= 0.7;
  k -= 0.09 * step(0.6, vnoise(vec2(q.x * 0.7 + seed * 40.0, q.y * 0.07)));
  if (storey < 0.05) return albedo * k;
  float ground = storey * 1.25;
  float u = fract(q.x / bay);
  if (q.y < ground) {
    if (style < 1.5 || (style > 2.5 && style < 3.5)) k -= 0.16 * gridLine(q.y, 0.42, 0.022) * near;
  } else if (style < 3.5) {
    float fy = fract((q.y - ground) / storey);
    if (style < 1.5 && seed > 0.45) k += 0.09 * (1.0 - step(0.07, min(u, 1.0 - u)));
    float inBay = step(0.24, u) * step(u, 0.76);
    float lintel = inBay * step(0.81, fy) * step(fy, 0.88);
    float sill = inBay * step(0.17, fy) * step(fy, 0.22);
    k += 0.18 * max(lintel, sill) * near;
  }
  return albedo * k;
}

/** Window rectangle of a style in the cell (u across the bay, fy up the storey). */
float facadeWindow(float style, float u, float fy) {
  if (style < 1.5) return step(0.3, u) * step(u, 0.7) * step(0.24, fy) * step(fy, 0.8);
  if (style < 2.5) return step(0.1, u) * step(u, 0.9) * step(0.25, fy) * step(fy, 0.84);
  if (style < 3.5) return step(0.28, u) * step(u, 0.72) * step(0.2, fy) * step(fy, 0.86);
  if (style < 4.5) {
    // Lancet: a tall slot with a pointed head.
    float x = abs(u - 0.5) / 0.14;
    float head = 0.9 - 0.1 * x * x;
    return step(x, 1.0) * step(0.14, fy) * step(fy, head);
  }
  if (style < 5.5) return step(0.04, u) * step(u, 0.96) * step(0.56, fy) * step(fy, 0.8);
  return step(0.2, u) * step(u, 0.8) * step(0.3, fy) * step(fy, 0.76);
}

/** Glass of the windows and shop fronts: rgb, a = mask; glow = how much of it is self-lit. */
vec4 facadeGlass(vec2 q, vec2 meta, vec3 n, vec3 v, float dist, float night, out float glow) {
  glow = 0.0;
  float storey; float bay; float style; float shop; float seed;
  facadeDecode(meta, storey, bay, style, shop, seed);
  if (storey < 0.05 || style > 15.5 || abs(n.y) > 0.5) return vec4(0.0);
  float detail = 1.0 - smoothstep(120.0, 240.0, dist);
  float ground = storey * 1.25;
  float graze = pow(1.0 - abs(dot(n, v)), 2.0);
  vec3 dark = vec3(0.04, 0.055, 0.08) + vec3(0.06, 0.08, 0.12) * graze;
  float church = step(3.5, style) * step(style, 4.5);
  if (q.y < ground && shop > 0.5 && church < 0.5) {
    float sb = bay * (fract(seed * 3.1) > 0.5 ? 1.0 : 2.0);
    float c = floor(q.x / sb);
    float u = fract(q.x / sb);
    float top = ground - 0.85;
    float vit = step(0.05, u) * step(u, 0.95) * step(0.45, q.y) * step(q.y, top);
    float h = hash(vec2(c, seed * 53.0));
    vec3 shopCol = h > 0.82 ? vec3(0.35, 0.92, 1.0) : h > 0.66 ? vec3(1.0, 0.42, 0.78) : h > 0.5 ? vec3(0.75, 1.0, 0.6) : vec3(1.0, 0.8, 0.52);
    float shutter = step(0.8, hash(vec2(c, seed * 7.0))) * night;
    float lit = (1.0 - shutter) * (0.5 + 0.5 * night);
    float fall = clamp((q.y - 0.45) / max(top - 0.45, 0.5), 0.0, 1.0);
    vec3 col = mix(dark, shopCol * mix(1.2, 0.7, fall), lit);
    // Goods on shelves behind the glass.
    col *= 1.0 - 0.3 * step(0.55, fract(q.y / 0.5)) * step(0.4, hash(vec2(c, floor(q.y / 0.5)))) * lit;
    float frame = max(gridLine(u * sb, sb * 0.5, 0.035), gridLine(q.y - top + 0.55, 100.0, 0.03));
    col = mix(col, vec3(0.025, 0.03, 0.04), frame);
    if (shutter > 0.5) col = vec3(0.11, 0.12, 0.14) * (0.8 + 0.2 * step(0.5, fract(q.y / 0.12)));
    glow = vit * lit * (1.0 - frame);
    return vec4(col, vit);
  }
  float row = church > 0.5 ? 0.0 : floor((q.y - ground) / storey) + 1.0;
  float fy = church > 0.5 ? q.y / ground : (q.y < ground ? q.y / ground : fract((q.y - ground) / storey));
  if (church > 0.5 && q.y > ground) return vec4(0.0);
  float c = floor(q.x / bay);
  float u = fract(q.x / bay);
  float rect = facadeWindow(style, u, fy);
  // Gate of a tenement: one bay of the ground floor is a dark passage into the courtyard.
  if (row < 0.5 && church < 0.5 && style < 1.5) {
    float gate = step(abs(c - 1.0), 0.5) * step(0.35, hash(vec2(seed, 3.0)));
    rect = max(rect * (1.0 - gate), gate * step(0.16, u) * step(u, 0.84) * step(q.y, ground * 0.8) * step(0.0, q.y));
  }
  float share = (0.34 + 0.28 * fract(seed * 7.7)) * night;
  float floorOn = step(0.22, hash(vec2(row, seed * 91.0)));
  float r = hash(vec2(c, row) + seed * 137.0);
  float lit = step(1.0 - share, r) * floorOn * step(0.5, row + church);
  vec3 litCol = r > 0.96 ? vec3(1.0, 0.45, 0.8) : r > 0.9 ? vec3(0.55, 0.85, 1.0) : vec3(1.0, 0.72, 0.42);
  // Curtains and a half-drawn blind in some lit windows.
  litCol *= 1.0 - 0.45 * step(0.6, hash(vec2(c * 3.0, row))) * step(0.5, u);
  float mx = abs(u - 0.5) * bay;
  float mullion = (1.0 - step(0.03, mx)) * step(style, 3.5);
  float transom = (1.0 - step(0.03 / storey, abs(fy - 0.66))) * step(style, 1.5);
  vec3 col = mix(dark, litCol, lit);
  col = mix(col, vec3(0.03, 0.035, 0.045), max(mullion, transom) * detail);
  // Far away: the average glow of the grid instead of single windows.
  vec3 avg = mix(dark, vec3(1.0, 0.72, 0.42), share * 0.8);
  float mask = mix(0.3, rect, detail);
  glow = mix(share * 0.3, rect * lit, detail);
  return vec4(mix(avg, col, detail), mask);
}
#endif
`;

/**
 * Ground surfaces: uv = metres in the surface's box (along, across), uv2.x = surface code
 * (0 terrain, 1 road, 2 sidewalk, 3 square, 4 cobble, 5 footway, 6 grass, 7 rail, 8 kerb),
 * uv2.y = width of a long strip (road markings) or 0.
 */
export const GROUND_GLSL = /* glsl */ `
#ifdef MAP_GROUND
vec3 groundPaint(vec3 albedo, vec2 q, vec2 meta, vec3 p, float dist) {
  float code = floor(meta.x + 0.5);
  float near = 1.0 - smoothstep(25.0, 75.0, dist);
  vec2 w = p.xz;
  float k = 1.0;
  if (code < 0.5) {
    k = 0.82 + 0.18 * step(0.5, vnoise(w * 0.35)) - 0.08 * step(0.7, vnoise(w * 1.7));
  } else if (code < 1.5) {
    k = 0.92 + 0.08 * step(0.6, vnoise(w * 0.3)) - 0.1 * step(0.74, vnoise(w * 0.07 + 3.0));
    float hw = meta.y * 0.5;
    if (hw > 1.6) {
      float centre = (1.0 - step(0.07, abs(q.y))) * step(fract(q.x / 6.0), 0.5);
      float edge = step(hw - 0.45, abs(q.y)) * (1.0 - step(hw - 0.3, abs(q.y)));
      if (max(centre, edge) > 0.5) return vec3(0.72, 0.72, 0.66) * (0.9 + 0.1 * vnoise(w * 3.0));
    }
  } else if (code < 2.5) {
    k -= 0.24 * max(gridLine(q.x, 1.0, 0.018), gridLine(q.y, 1.0, 0.018)) * near;
    k += 0.06 * (hash(floor(q)) - 0.5);
  } else if (code < 3.5) {
    // Granite slabs in running bond, with bands of a darker stone every 6 m.
    vec2 g = vec2(q.x / 1.2 + 0.5 * step(0.5, fract(q.y / 1.2)), q.y / 0.6);
    k -= 0.14 * max(gridLine(g.x, 1.0, 0.015), gridLine(g.y, 1.0, 0.03)) * near;
    k += 0.08 * (hash(floor(g)) - 0.5);
    k -= 0.07 * step(0.5, fract(q.y / 6.0)) * step(fract(q.y / 6.0), 0.6);
  } else if (code < 4.5) {
    // Old Town setts: small stones in courses, every stone its own shade.
    vec2 g = vec2(w.x / 0.2 + 0.5 * step(0.5, fract(w.y / 0.24)), w.y / 0.12);
    vec2 f = fract(g);
    float joint = 1.0 - step(0.12, min(min(f.x, 1.0 - f.x) * 1.6, min(f.y, 1.0 - f.y) * 0.9));
    k = 0.8 + 0.35 * hash(floor(g));
    float fine = 1.0 - smoothstep(12.0, 35.0, dist);
    k = mix(0.95, k, fine) - 0.3 * joint * fine;
  } else if (code < 5.5) {
    vec2 g = w / 0.3;
    float fine = 1.0 - smoothstep(12.0, 35.0, dist);
    k -= 0.14 * max(gridLine(g.x, 1.0, 0.05), gridLine(g.y + 0.5 * step(0.5, fract(g.x * 0.5)), 1.0, 0.05)) * fine;
  } else if (code < 6.5) {
    k = 0.75 + 0.3 * step(0.5, vnoise(w * 0.5)) + 0.12 * step(0.7, vnoise(w * 3.1));
  } else if (code < 7.5) {
    k = 0.8 + 0.2 * vnoise(w * 4.0);
    float sleeper = step(0.62, fract(q.x / 0.65)) * (1.0 - step(1.3, abs(q.y)));
    k = mix(k, 0.55, sleeper);
    float rail = step(0.68, abs(q.y)) * (1.0 - step(0.76, abs(q.y)));
    if (rail > 0.5) return vec3(0.62, 0.64, 0.68);
  }
  return albedo * k;
}
#endif
`;
