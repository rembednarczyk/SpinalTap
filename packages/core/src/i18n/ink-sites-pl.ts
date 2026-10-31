/**
 * Polish names of the contract sites for the ink dialogues only (ADR-0056). Kaito's lines are
 * Polish until stage 5 and read the site from `CONTRACT_SITES[id].label`; every other place shows
 * the site through its catalog key `contract.site.<id>`. Stage 5 gives the narrative its own
 * catalogs, and this file goes with it.
 *
 * TODO(ADR-0056, stage 5): remove this file once ink writes its words through `NarrativeText`
 * (the runtime then names `contract_site` by key) and `narrative-runtime.ts` stops reading it.
 */
export const INK_SITE_LABELS_PL = {
  east_lot: "parking przy furgonetce na Placu Litewskim",
  koi_back: "podwórko za barem Neon Koi",
  car_wash: "podwórko za myjnią za Placem Łokietka",
  south_gate: "wrak na Krakowskim, przy Placu Litewskim",
  kanal_bridge: "pod kładką na Grodzkiej",
  hana_stall: "wózek Hany na targu na Podzamczu",
  hebi_stash: "skrytka Hebi pod wiaduktem, wschodni koniec targu",
  raid_north: "stragan Oyaji, Hebi idą spod wiaduktu",
  raid_east: "stragan Oyaji, Hebi idą od wschodniej ściany hali, od Ruskiej",
  docks_escort: "z placu kontenerowego na Nabrzeżu na molo, do łodzi",
  tessen_office: "biuro Tessen na Nabrzeżu Bystrzycy",
  quay_terminal: "terminal Tessen pod dźwigiem nad rzeką",
} as const;
