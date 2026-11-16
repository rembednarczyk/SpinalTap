import type { Exception } from "./gate.ts";

/**
 * The tests the time gate lets through (ADR-0083 step 2), each with its reason: a test that has to
 * take long, or one waiting for the shared city cache or the project of its own (ADR-0083 steps 3
 * and 4). A test or a whole file (`gate.ts`, `testId`). Remove an entry once the test is fast again.
 */
/** Tests already over half their limit when the gate came in: they may not grow, and leave the list once fast. */
const KNOWN_SLOW = "over half of the 20 s limit when the gate came in (CI run 43714759388, 15.11); to speed up in ADR-0083 step 3 (shared city cache); its growth over main stays gated";

export const EXCEPTIONS: readonly Exception[] = [
  { test: "packages/app/test/alchemia-ramp-traffic.test.ts > the cars in and out of Alchemia's P-1 (ADR-0074 §4, G-491) > brings one from Bajkowskiego down the ramp into the south cabin and one out of the north cabin up Lubartowska past Olejna, into no other car", reason: KNOWN_SLOW, only: "limit" },
  { test: "packages/engine/test/model-donors.test.ts > named characters' borrowed cloth (ADR-0076 stage 4a, G-575) > dresses Neon Koi's barman and regulars from fixed donor files, Kurosawa's never among them", reason: KNOWN_SLOW, only: "limit" },
  { test: "packages/engine/test/model-kurosawa.test.ts > Kurosawa's model (ADR-0076 stage 3) > is a VRoid M00 figure with his own face and hair, not Kaito's, in the game's cast", reason: KNOWN_SLOW, only: "limit" },
  { test: "packages/engine/test/model-release.test.ts > letting go of character model files (ADR-0076 stage 4b) > dresses a look the same after its file was let go of and loaded again", reason: KNOWN_SLOW, only: "limit" },
  { test: "packages/engine/test/model-release.test.ts > letting go of character model files (ADR-0076 stage 4b) > lets go of kurosawa.vrm a while after he left the scene, with its meshes and textures", reason: KNOWN_SLOW, only: "limit" },
  { test: "packages/engine/test/model-release.test.ts > letting go of character model files (ADR-0076 stage 4b) > loads a save away from Kurosawa and back again, his file let go of behind the first loading screen", reason: KNOWN_SLOW, only: "limit" },
  { test: "packages/sim/test/alchemia-parking.test.ts > P-1 in the level graph (ADR-0074 §5, stage 4) > an alerted brawler on the car park gets to the player on the deck, and one on the deck to her on the car park", reason: KNOWN_SLOW, only: "limit" },
  { test: "packages/sim/test/determinism.test.ts > determinism > a loaded snapshot continues exactly like the original run", reason: KNOWN_SLOW, only: "limit" },
  { test: "packages/sim/test/determinism.test.ts > determinism > same seed + same input stream = same end state", reason: KNOWN_SLOW, only: "limit" },
  { test: "packages/sim/test/determinism.test.ts > determinism > the crowd of residents (ADR-0041) and the traffic (ADR-0050) leave the golden run as it was, at density high", reason: KNOWN_SLOW, only: "limit" },
  { test: "packages/sim/test/determinism.test.ts > determinism > the crowd of residents (ADR-0041) and the traffic (ADR-0050) leave the golden run as it was, at density low", reason: KNOWN_SLOW, only: "limit" },
  { test: "packages/sim/test/determinism.test.ts > determinism > the same run on 'hard' has a golden hash of its own (ADR-0066)", reason: KNOWN_SLOW, only: "limit" },
  { test: "packages/sim/test/m1.test.ts > fixer contracts > save/load with deaths and spawns continues exactly like the original", reason: KNOWN_SLOW, only: "limit" },
  { test: "packages/sim/test/m4-docks.test.ts > escort (Mika to the boat) > Mika waits, walks with Seki, the ambush comes on the quay, the boat clears the job; Genzō pays", reason: KNOWN_SLOW, only: "limit" },
  { test: "packages/sim/test/prism-perf.test.ts > cost of a step with 300 prisms in range (ADR-0043) > checks only the solids near each query", reason: KNOWN_SLOW, only: "limit" },
  { test: "packages/sim/test/save-load-contract-ended.test.ts > save and load after a contract has ended (G-178) > a hack lost by walking off the terminal keeps its wave after loading (another seed, another job)", reason: KNOWN_SLOW, only: "limit" },
  { test: "packages/sim/test/save-load-crowd-panic.test.ts > a save while the street panics (G-240) > a shot in front of babcia Ume, saved mid-call: reported in both games, which go on the same", reason: KNOWN_SLOW, only: "limit" },
  { test: "packages/sim/test/save-load-crowd-panic.test.ts > a save while the street panics (G-240) > goes on the same after a load, step by step (seed 13)", reason: KNOWN_SLOW, only: "limit" },
  { test: "packages/sim/test/save-load-crowd-panic.test.ts > a save while the street panics (G-240) > goes on the same after a load, step by step (seed 7)", reason: KNOWN_SLOW, only: "limit" },
  { test: "packages/sim/test/save-load-micro-body.test.ts > the body of a micro-event's mugger in the save (G-233) > won, knocked out: woken after a load or without one, the mugger is the same (G-242)", reason: KNOWN_SLOW, only: "limit" },
  { test: "tools/glitch-scan/test/glitch-scan.test.ts > the glitch scan against its baseline (ADR-0054) > finds no new place of walk-blocked (baseline/walk-blocked.txt)", reason: KNOWN_SLOW, only: "limit" },
  { test: "tools/osm-import/test/generate.test.ts > generator > generates the same tables from the committed raw data twice", reason: KNOWN_SLOW, only: "limit" },
  { test: "packages/sim/test/crowd.test.ts > the crowd in the simulation > a shot sends them running; calm again, they walk back to the route and carry on", reason: "23,1 s z 30 s na CI (77%) już na main 15.11, z limitem 30 s ustawionym w teście; do przyspieszenia w kroku 3 ADR-0083; wzrost wobec main nadal pilnowany", only: "limit" },
  { test: "packages/engine/test/vest-plate-model.test.ts > the ballistic vest on a model (G-870) > is a plate carrier of the model's own top, over the bust and the cloth at rest, aiming, running and crouched", reason: "11,2 s z 20 s na CI 16.11 po #603: wczytuje trzy pliki VRM (Seki, ganger, Kaito) i krokuje cztery pozy; lokalnie ok. 5 s, z czego test 30%, reszta to import i wczytanie modeli (przyspieszenie przez dzielenie trójkątów w kubełki nie dało zysku); do przyspieszenia w kroku 3 ADR-0083; wzrost wobec main nadal pilnowany", only: "limit" },
  { test: "packages/sim/test/flee-dead-zone.test.ts > the dead zone for the crowd (ADR-0070) > a walker of a crowd route (3 of 3) stops past the radius of a hostile street, instead of stepping in and out of it", reason: "15,5 s z 20 s (78%) na CI 16.11 na PR #600 bez zmian w sim; istniejący test tłumu na granicy progu 75% pod obciążeniem maszyn CI; do przyspieszenia w kroku 3 ADR-0083; wzrost wobec main nadal pilnowany", only: "limit" },
];
