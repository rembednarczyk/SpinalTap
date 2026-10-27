// Builds artifact/index.html from the Vite build: the artifact host supplies the document
// skeleton, so the page carries only title, styles and markup, and loads the same assets.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";

const dist = "packages/app/dist";
const html = readFileSync(`${dist}/index.html`, "utf8");
const entry = /<script type="module" crossorigin src="\.\/(assets\/[^"]+)"/.exec(html)?.[1];
const css = /<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+)"/.exec(html)?.[1];
if (!entry || !css) throw new Error("unexpected dist/index.html");

const page = `<title>Seki Senshi</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;700&family=Share+Tech+Mono&display=swap">
<style>
/* Single dark look: a night city game screen, full bleed. */
:root { --bg: #05080c; color-scheme: dark; }
html, body { height: 100%; margin: 0; overflow: hidden; background: var(--bg); }
#game-canvas { width: 100%; height: 100%; display: block; outline: none; touch-action: none; }
${readFileSync(`${dist}/${css}`, "utf8")}
</style>
<canvas id="game-canvas"></canvas>
<div id="ui-root"></div>
<script type="module" src="./${entry}"></script>
`;
mkdirSync("artifact", { recursive: true });
writeFileSync("artifact/index.html", page);
const files = Object.fromEntries(
  readdirSync(`${dist}/assets`)
    .filter((f) => !f.endsWith(".css"))
    .map((f) => [`assets/${f}`, `${dist}/assets/${f}`]),
);
// Recorded sounds go along. The artifact host serves no 3D model types (.glb, .vrm), so the city
// kit, the VRoid cast and the weapon models stay out: there the game falls back to the plain
// blocks, the procedural cast and the box guns. A full build needs a regular static host.
const MEDIA = { ".ogg": "audio/ogg" };
for (const dir of ["audio"]) {
  for (const f of readdirSync(`${dist}/${dir}`)) {
    const ext = f.slice(f.lastIndexOf("."));
    const contentType = MEDIA[ext];
    if (contentType) files[`${dir}/${f}`] = { from: `${dist}/${dir}/${f}`, contentType };
  }
}
writeFileSync("artifact/files.json", JSON.stringify(files));
console.log(`artifact/index.html + ${Object.keys(files).length} asset files`);
