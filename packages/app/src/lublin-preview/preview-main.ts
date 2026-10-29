import type { EntityId, Vec3, ViewDescriptor } from "@seki/core";
import { BabylonRenderer, PerfProbe, type PerfSample, Stage } from "@seki/engine";
import { LUBLIN_CHUNKS, buildingView, groundView, streetPropsView, terrainView } from "@seki/sim/lublin";
import { OrbitCamera, bindOrbitInput } from "./orbit-camera";
import { type PreviewOverlay, createOverlay } from "./preview-overlay";
import { galleryShots, galleryViews } from "./props-gallery";

/**
 * `?lublin-preview` (ADR-0044): the city from map data on its own, to judge the renderer
 * without game content. Spawns the generated Lublin (`LUBLIN_CHUNKS`, ADR-0042) or a JSON of
 * views (`?data=<url>`, e.g. from `tools/lublin-fixture.mjs`) through the real `RenderPort` and
 * flies an orbit camera. The game never starts. With `props-gallery` it shows every street prop
 * kind in rows instead (ADR-0047); `props=0` leaves the street furniture out.
 */

interface Placed {
  readonly position: Vec3;
  readonly view: ViewDescriptor;
}

interface Fixture {
  readonly attribution: string;
  readonly views: readonly Placed[];
}

const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };

/** Every view of the generated centre: terrain, buildings, surfaces and street furniture chunk by chunk. */
const lublinViews = (props: boolean): Fixture => ({
  attribution: "Dane mapy © OpenStreetMap contributors (ODbL) · teren: GUGiK NMT",
  views: LUBLIN_CHUNKS.flatMap((c): Placed[] => [
    { position: ORIGIN, view: terrainView(c) },
    ...c.buildings.map((b) => ({ position: { x: b.x, y: b.y, z: b.z }, view: buildingView(b) })),
    ...c.ground.map((g) => ({ position: ORIGIN, view: groundView(g) })),
    ...(props ? [{ position: ORIGIN, view: streetPropsView(c.id) }] : []),
  ]),
});

export interface PreviewView {
  /** Heights (y) are above the ground at that point. */
  readonly position: Vec3;
  readonly target: Vec3;
  readonly hour: number;
  /** Fog density as a share of the game's (thinner for overviews). */
  readonly fog?: number;
}

/** Named shots for review (keys 1 to 8). */
export const PREVIEW_VIEWS: Readonly<Record<string, PreviewView>> = {
  plac: { position: { x: 20, y: 16, z: -20 }, target: { x: 56, y: 9, z: 87 }, hour: 23 },
  krakowskie: { position: { x: 330, y: 1.8, z: -80 }, target: { x: 472, y: 9, z: -91 }, hour: 22 },
  rynek: { position: { x: 540, y: 40, z: -120 }, target: { x: 600, y: 0, z: -50 }, hour: 22 },
  trybunal: { position: { x: 556, y: 2.5, z: -84 }, target: { x: 584, y: 8, z: -58 }, hour: 23 },
  zamek: { position: { x: 770, y: 3, z: 150 }, target: { x: 888, y: 14, z: 234 }, hour: 22 },
  stare: { position: { x: 470, y: 230, z: -330 }, target: { x: 610, y: 0, z: -40 }, hour: 22, fog: 0.1 },
  gora: { position: { x: 300, y: 520, z: -560 }, target: { x: 380, y: 0, z: -20 }, hour: 22, fog: 0.06 },
  dzien: { position: { x: 20, y: 16, z: -20 }, target: { x: 56, y: 9, z: 87 }, hour: 13 },
  // Street furniture (ADR-0047): Plac Litewski's benches, trees, poles and fountain; the pastoral
  // lamps of the deptak; the wall lanterns of the Rynek; the candelabra of Plac Zamkowy.
  litewski: { position: { x: 45, y: 9.5, z: -45 }, target: { x: -20, y: 1, z: 30 }, hour: 23 },
  pastoraly: { position: { x: 232, y: 2.4, z: -66 }, target: { x: 300, y: 3.2, z: -84 }, hour: 22 },
  latarenki: { position: { x: 558, y: 2.6, z: -70 }, target: { x: 592, y: 3.9, z: -100 }, hour: 22 },
  kandelabry: { position: { x: 727, y: 2.8, z: 237 }, target: { x: 716, y: 3.2, z: 224 }, hour: 22 },
};

export interface LublinPreviewApi {
  ready: boolean;
  view(name: string): void;
  setHour(hour: number): void;
  camera(position: Vec3, target: Vec3): void;
  perf(): PerfSample;
  map(): unknown;
}

declare global {
  interface Window {
    __lublin?: LublinPreviewApi;
  }
}

/** Daylight of an hour: night from 21 to 5, day from 8 to 18, linear in between. */
export const daylightAt = (hour: number): number => {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 8 && h <= 18) return 1;
  if (h <= 5 || h >= 21) return 0;
  return h < 8 ? (h - 5) / 3 : (21 - h) / 3;
};

const start = async (): Promise<void> => {
  const params = new URLSearchParams(location.search);
  const q = params.get("quality");
  const quality = q === "low" || q === "medium" || q === "high" ? q : "high";
  const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
  const stage = new Stage(canvas, { reference: false, quality });
  const fog = Number(params.get("fog") ?? 0.35);
  // No game districts: no street dressing, signage or far stand-ins of the old map. Thinner fog to see the whole extract.
  const renderer = new BabylonRenderer(stage, { cityKit: null, world: [], fogScale: fog });
  renderer.rig.camera.minZ = 0.3;
  renderer.rig.camera.maxZ = 1500;
  const probe = new PerfProbe(stage.engine, stage.scene);
  // The old map's horizon of megabuildings would stand in the middle of the real city.
  for (const m of renderer.farCity.meshes) m.setEnabled(false);
  const gallery = params.has("props-gallery");
  const shots: Readonly<Record<string, PreviewView>> = gallery ? galleryShots() : PREVIEW_VIEWS;
  const home = gallery ? "galeria" : "plac";
  const first = shots[params.get("view") ?? home] ?? shots[home];
  const cam = new OrbitCamera({ position: { x: 0, y: 20, z: -60 }, target: { x: 0, y: 0, z: 0 } });
  const keys = bindOrbitInput(canvas, cam);
  const overlay: PreviewOverlay = createOverlay(document.getElementById("ui-root") as HTMLElement, params.has("clean"));
  let hour = first?.hour ?? 23;
  const setHour = (h: number) => {
    hour = h;
    renderer.playEffect({ kind: "time-of-day", daylight: daylightAt(h), hour: h });
  };
  setHour(hour);

  const data = params.get("data");
  const fixture = data ? ((await (await fetch(data)).json()) as Fixture) : gallery ? galleryViews() : lublinViews(params.get("props") !== "0");
  let id: EntityId = 1;
  for (const v of fixture.views) renderer.spawn(id++, v.view, { position: v.position, yaw: 0, pitch: 0, speed: 0 });

  const lift = (p: Vec3): Vec3 => ({ x: p.x, y: p.y + (renderer.mapHeightAt(p.x, p.z) ?? 0), z: p.z });
  const api: LublinPreviewApi = {
    ready: false,
    view: (name) => {
      const v = shots[name];
      if (!v) return;
      cam.look(lift(v.position), lift(v.target));
      setHour(v.hour);
      renderer.setFogScale(v.fog ?? fog);
    },
    setHour,
    camera: (position, target) => cam.look(position, target),
    perf: () => probe.sample(),
    map: () => renderer.mapStats,
  };
  window.__lublin = api;
  api.view(params.get("view") ?? home);
  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyN") setHour(daylightAt(hour) > 0.5 ? 23 : 13);
    const named = Object.keys(shots)[Number(e.key) - 1];
    if (named) api.view(named);
  });
  let frames = 0;
  stage.engine.runRenderLoop(() => {
    const dt = Math.min(stage.engine.getDeltaTime() / 1000, 0.1);
    keys(dt);
    renderer.rig.setReferenceView(cam.position, cam.target);
    renderer.frame(dt);
    stage.scene.render();
    if (++frames % 30 === 0) overlay.show(fixture.attribution, hour, probe.sample(), renderer.mapStats);
    // Ready once the cells have been built and the shaders compiled.
    if (!api.ready && frames > 30 && stage.scene.isReady()) api.ready = true;
  });
};

void start();
