/**
 * The picture of a big LED screen in the map city's signs (ADR-0074 C4, Alchemia's front): a
 * procedural advert in the world's style, no texture of its own, in the signs' one mesh and draw
 * call. Pattern: the digital billboard of a mall's facade (a slideshow of spots, each a few
 * seconds, cut with a wipe), drawn as an additive light over the screen's dark panel, which the
 * building's own mesh draws. Three spots, each starting from the screen's program (`seed`'s whole
 * part) so neighbours never show the same one:
 * - the city at night: towers drifting past a teal sky with the moon, their windows lit warm or in
 *   the screen's colour (the board's big screen on the podium);
 * - the brand: a ring logo, lines of text as bars, diagonal stripes in the screen's colour;
 * - a face: a figure of light in rings on magenta to blue, its rows slipping now and then (not
 *   with flashes reduced).
 * Program 3 is no screen but a hologram (the board's upright panels by the sign): a standing figure
 * of light breathing as it turns, its rows slipping now and then, a rain of glyphs, bars at its feet
 * and a bluer frame, black (nothing, additive) between.
 * The bottom fifth is a dark band for the caption, which the plan writes in the glyph atlas's
 * letters. LED rows over all. `seed` = program + aspect / 16 (width over height, under 16).
 * Needs `hash` (map signs' shader) before it.
 */
export const SCREEN_GLSL = /* glsl */ `
vec3 screenCity(vec2 c, float aspect, float prog, vec3 tint, float time) {
  vec3 sky = mix(vec3(0.10, 0.38, 0.62), vec3(0.02, 0.05, 0.16), c.y);
  float moon = 1.0 - smoothstep(0.09, 0.11, length(vec2((c.x - 0.74) * aspect, c.y - 0.74)));
  float xb = c.x * aspect * 7.0 + time * 0.05;
  float back = step(c.y, 0.3 + 0.35 * hash(vec2(floor(xb), prog + 9.0)));
  vec3 bg = mix(sky + moon * vec3(0.8, 0.85, 1.0), vec3(0.07, 0.14, 0.3), back);
  float x = c.x * aspect * 4.0 + time * 0.12;
  float i = floor(x);
  float tower = step(c.y, 0.38 + 0.45 * hash(vec2(i, prog + 1.0))) * step(0.12, fract(x));
  vec2 w = vec2(fract(x) * 4.0, c.y * 26.0);
  float lit = step(0.5, hash(floor(w) + vec2(i * 7.0, prog))) * step(0.35, fract(w.x)) * step(0.4, fract(w.y));
  vec3 win = mix(vec3(1.0, 0.72, 0.38), tint, step(0.5, hash(vec2(i, 5.0))));
  return mix(bg, vec3(0.02, 0.03, 0.07) + win * lit, tower);
}
vec3 screenBrand(vec2 c, float aspect, float prog, vec3 tint, float time) {
  float stripes = step(0.5, fract((c.x * aspect + c.y) * 2.5 - time * 0.25));
  vec3 bg = mix(vec3(0.03, 0.02, 0.1), tint * 0.28, stripes);
  float wide = step(1.0, aspect);
  vec2 q = mix(vec2((c.x - 0.5) * aspect, c.y - 0.72), vec2((c.x - 0.2) * aspect, c.y - 0.58), wide);
  float r = length(q);
  float ring = 1.0 - smoothstep(0.025, 0.045, abs(r - 0.24));
  float core = 1.0 - smoothstep(0.1, 0.12, r + 0.02 * sin(time * 2.0));
  vec2 b = mix(vec2((c.x - 0.14) / 0.72, (c.y - 0.26) / 0.26), vec2((c.x - 0.42) / 0.52, (c.y - 0.3) / 0.56), wide);
  float inside = step(0.0, b.x) * step(b.x, 1.0) * step(0.0, b.y) * step(b.y, 1.0);
  float bar = inside * step(0.4, fract(b.y * 4.0)) * step(b.x, 0.35 + 0.65 * hash(vec2(floor(b.y * 4.0), prog + floor(time * 0.5))));
  return bg + ring * mix(vec3(1.0), tint, 0.4) + core * tint + bar * mix(tint, vec3(1.0), 0.6);
}
vec3 screenFace(vec2 c, float aspect, vec3 tint, float time, float reduce) {
  vec3 bg = mix(vec3(0.36, 0.04, 0.3), vec3(0.05, 0.08, 0.36), c.y);
  vec2 q = vec2((c.x - 0.5) * aspect, c.y);
  q.x += 0.08 * step(0.9, hash(vec2(floor(c.y * 12.0), floor(time * 6.0)))) * (1.0 - reduce);
  float head = 1.0 - smoothstep(0.17, 0.19, length((q - vec2(0.0, 0.66)) * vec2(1.0, 0.85)));
  float body = step(q.y, 0.48) * (1.0 - smoothstep(0.0, 0.02, abs(q.x) - (0.48 - q.y) * 0.9 - 0.1));
  float rings = 0.55 + 0.45 * sin(length(q - vec2(0.0, 0.66)) * 18.0 - time * 3.0);
  return mix(bg * rings, mix(tint, vec3(1.0), 0.35), max(head, body) * (0.85 + 0.15 * sin(c.y * 90.0)));
}
vec3 screenHolo(vec2 c, float aspect, vec3 tint, float time, float reduce) {
  vec2 q = vec2((c.x - 0.5) * aspect, c.y);
  q.x += 0.04 * step(0.93, hash(vec2(floor(c.y * 20.0), floor(time * 5.0)))) * (1.0 - reduce);
  q.x /= 0.8 + 0.2 * sin(time * 0.7);
  float head = 1.0 - smoothstep(0.045, 0.055, length((q - vec2(0.0, 0.84)) * vec2(1.0, 0.8)));
  float torso = step(0.5, q.y) * step(q.y, 0.77) * (1.0 - smoothstep(0.0, 0.01, abs(q.x) - mix(0.055, 0.095, smoothstep(0.5, 0.74, q.y))));
  float legs = step(0.13, q.y) * step(q.y, 0.52) * (1.0 - smoothstep(0.0, 0.01, abs(abs(q.x) - 0.035) - 0.024));
  float arms = step(0.47, q.y) * step(q.y, 0.75) * (1.0 - smoothstep(0.0, 0.01, abs(abs(q.x) - 0.115 - (0.75 - q.y) * 0.08) - 0.018));
  float figure = max(max(head, torso), max(legs, arms));
  float bars = step(0.03, c.y) * step(c.y, 0.11) * step(0.45, fract(c.y * 37.0)) * step(abs(c.x - 0.5), 0.1 + 0.3 * hash(vec2(floor(c.y * 37.0), floor(time * 0.8))));
  float rain = step(0.9, hash(floor(vec2(c.x * 10.0, c.y * 46.0 + time * 1.5)))) * step(0.3, fract(c.y * 46.0 + time * 1.5));
  float frame = 1.0 - step(0.035, min(min(c.x, 1.0 - c.x) * aspect, min(c.y, 1.0 - c.y)) * 2.0);
  float scan = 0.6 + 0.4 * step(0.5, fract(c.y * 110.0 - time * 1.5));
  vec3 rim = mix(tint, vec3(0.35, 0.55, 1.0), 0.55);
  return tint * (figure * scan * 1.15 + bars * 0.8 + rain * 0.18 + 0.05) + rim * frame + vec3(0.35) * figure * scan;
}
vec3 screenPicture(vec2 uv, float seed, vec3 tint, float time, float reduce) {
  float prog = floor(seed);
  float aspect = max(fract(seed) * 16.0, 0.1);
  vec2 c = clamp(uv, 0.0, 1.0);
  if (prog > 2.5) return screenHolo(c, aspect, tint, time, reduce);
  float slot = time / 8.0 + prog * 0.37;
  float slide = mod(floor(slot) + prog, 3.0);
  vec2 p = vec2(c.x, (c.y - 0.2) / 0.8);
  vec3 pic;
  if (slide < 0.5) pic = screenCity(p, aspect / 0.8, prog, tint, time);
  else if (slide < 1.5) pic = screenBrand(p, aspect / 0.8, prog, tint, time);
  else pic = screenFace(p, aspect / 0.8, tint, time, reduce);
  // The caption's band, a line of the screen's colour over it.
  float band = step(c.y, 0.2);
  pic = mix(pic, vec3(0.02, 0.02, 0.05) + tint * step(0.17, c.y) * 0.8, band);
  // The cut to the next spot: a wipe of light across, none with flashes reduced.
  float age = fract(slot) * 8.0;
  float wipe = (1.0 - smoothstep(0.0, 0.03, abs(c.x - age / 0.5))) * step(age, 0.5) * (1.0 - reduce);
  return pic * (0.86 + 0.14 * step(0.25, fract(c.y * 72.0))) + wipe * vec3(0.9);
}
`;
