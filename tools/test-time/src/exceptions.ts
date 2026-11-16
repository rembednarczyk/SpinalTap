import type { Exception } from "./gate.ts";

/**
 * The tests the time gate lets through (ADR-0083 step 2), each with its reason: a test that has to
 * take long, or one waiting for the shared city cache or the project of its own (ADR-0083 steps 3
 * and 4). A test or a whole file (`gate.ts`, `testId`). Remove an entry once the test is fast again.
 */
/** Tests already over half their limit when the gate came in: they may not grow, and leave the list once fast. */
const KNOWN_SLOW = "over half of the 20 s limit when the gate came in (CI run 43714759388, 15.11); ADR-0083 step 3 (the steering's store shared by a worker's simulations) does not take it under: its time is work of its own (model files, traffic, a raster of the whole city, the generator), for step 4; its growth over main stays gated";

export const EXCEPTIONS: readonly Exception[] = [
  { test: "packages/app/test/alchemia-ramp-traffic.test.ts > the cars in and out of Alchemia's P-1 (ADR-0074 §4, G-491) > brings one from Bajkowskiego down the ramp into the south cabin and one out of the north cabin up Lubartowska past Olejna, into no other car", reason: KNOWN_SLOW, only: "limit" },
  { test: "packages/engine/test/model-donors.test.ts > named characters' borrowed cloth (ADR-0076 stage 4a, G-575) > dresses Neon Koi's barman and regulars from fixed donor files, Kurosawa's never among them", reason: KNOWN_SLOW, only: "limit" },
  { test: "packages/engine/test/model-kurosawa.test.ts > Kurosawa's model (ADR-0076 stage 3) > is a VRoid M00 figure with his own face and hair, not Kaito's, in the game's cast", reason: KNOWN_SLOW, only: "limit" },
  { test: "packages/engine/test/model-release.test.ts > letting go of character model files (ADR-0076 stage 4b) > dresses a look the same after its file was let go of and loaded again", reason: KNOWN_SLOW, only: "limit" },
  { test: "packages/engine/test/model-release.test.ts > letting go of character model files (ADR-0076 stage 4b) > lets go of kurosawa.vrm a while after he left the scene, with its meshes and textures", reason: KNOWN_SLOW, only: "limit" },
  { test: "packages/engine/test/model-release.test.ts > letting go of character model files (ADR-0076 stage 4b) > loads a save away from Kurosawa and back again, his file let go of behind the first loading screen", reason: KNOWN_SLOW, only: "limit" },
  { test: "packages/sim/test/alchemia-parking.test.ts > P-1 in the level graph (ADR-0074 §5, stage 4) > an alerted brawler on the car park gets to the player on the deck, and one on the deck to her on the car park", reason: KNOWN_SLOW, only: "limit" },
  { test: "packages/sim/test/determinism.test.ts > determinism > same seed + same input stream = same end state", reason: KNOWN_SLOW, only: "limit" },
  { test: "packages/sim/test/prism-perf.test.ts > cost of a step with 300 prisms in range (ADR-0043) > checks only the solids near each query", reason: KNOWN_SLOW, only: "limit" },
  { test: "tools/glitch-scan/test/glitch-scan.test.ts > the glitch scan against its baseline (ADR-0054) > finds no new place of walk-blocked (baseline/walk-blocked.txt)", reason: KNOWN_SLOW, only: "limit" },
  { test: "tools/osm-import/test/generate.test.ts > generator > generates the same tables from the committed raw data twice", reason: KNOWN_SLOW, only: "limit" },
  { test: "packages/engine/test/vest-plate-model.test.ts > the ballistic vest on a model (G-870) > is a plate carrier of the model's own top, over the bust and the cloth at rest, aiming, running and crouched", reason: "11,2 s z 20 s na CI 16.11 po #603: wczytuje trzy pliki VRM (Seki, ganger, Kaito) i krokuje cztery pozy; lokalnie ok. 5 s, z czego test 30%, reszta to import i wczytanie modeli (przyspieszenie przez dzielenie trójkątów w kubełki nie dało zysku); do przyspieszenia w kroku 3 ADR-0083; wzrost wobec main nadal pilnowany", only: "limit" },
  { test: "packages/sim/test/flee-dead-zone.test.ts > the dead zone for the crowd (ADR-0070) > a walker of a crowd route (3 of 3) stops past the radius of a hostile street, instead of stepping in and out of it", reason: "15,5 s z 20 s (78%) na CI 16.11 na PR #600 bez zmian w sim; istniejący test tłumu na granicy progu 75% pod obciążeniem maszyn CI; do przyspieszenia w kroku 3 ADR-0083; wzrost wobec main nadal pilnowany", only: "limit" },
];
