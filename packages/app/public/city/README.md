# Miasto: budynki, auta i rekwizyty ulicy (ADR-0022)

`city-kit.glb` to jeden plik z modelami z darmowych paczek **CC0**, przemalowanymi na nocne
Shinsekai (ciemny beton, teal, magenta, świecące okna i neony). Licencja CC0: wolno używać,
zmieniać i rozpowszechniać, także komercyjnie, bez atrybucji (autorom i tak dziękujemy).

| Klucze w pliku | Źródło | Autor | Licencja |
|---|---|---|---|
| `kc-a` … `kc-m`, `kc-sa` … `kc-se` (kamienice, sklepy, wieżowce) | [City Kit Commercial 2.1](https://kenney.nl/assets/city-kit-commercial), `building-a…m`, `building-skyscraper-a…e` | Kenney | CC0 |
| `car-van`, `car-delivery`, `car-sedan`, `car-taxi`, `car-hatchback`, `car-wreck` | [Car Kit 3.1](https://kenney.nl/assets/car-kit), `van`, `delivery`, `sedan`, `taxi`, `hatchback-sports` | Kenney | CC0 |
| `dumpster` | [City Kit Roads](https://kenney.nl/assets/city-kit-roads), `dumpster` | Kenney | CC0 |
| `nt-bar`, `nt-store`, `nt-pharmacy`, `nt-bank` (witryny z neonami) | [Neon Town](https://opengameart.org/content/neon-town), `bar`, `store`, `pharmacy`, `bank` | leonkin | CC0 |

Zmiany względem oryginałów (narzędzie `tools/city_kit.py`):
- kolory z palety Kenneya (`colormap.png`) i z materiałów Neon Town są przypisane do ról
  (ściana, gzyms, okno, markiza, neon…) i przemalowane na wspólną paletę próbek; okna świecą albo
  nie, losowo per szyba (stałe ziarno), ściany i lakier aut barwi renderer per budynek;
- modele obrócone frontem do +Z, wyśrodkowane, w metrach (Kenney ×8: piętro 3,2 m);
- jedna siatka na model, wierzchołki sklejone, normalne i UV skwantowane (`KHR_mesh_quantization`).

Napisy na szyldach (BAR, RAMEN, KARAOKE…) rysuje gra; to zmyślone lokale, bez prawdziwych marek.
Z Neon Town nie bierzemy billboardu (napis „OpenGameArt”).

Odtworzenie pliku (paczki rozpakowane, każda do osobnego katalogu):

```
python3 -I tools/city_kit.py \
  --commercial kenney_city-kit-commercial_2.1/Models/GLB\ format \
  --cars kenney_car-kit/Models/GLB\ format \
  --roads kenney_city-kit-roads/Models/GLB\ format \
  --neontown NeonTown/GLTF --out packages/app/public/city
```

Pobranie: `https://kenney.nl/media/pages/assets/city-kit-commercial/a742d900eb-1753115042/kenney_city-kit-commercial_2.1.zip`,
`https://kenney.nl/media/pages/assets/car-kit/1a312ec241-1775131960/kenney_car-kit.zip`,
`https://kenney.nl/media/pages/assets/city-kit-roads/74288c9459-1791628607/kenney_city-kit-roads.zip`,
`https://opengameart.org/sites/default/files/NeonTown.zip` (szczegóły: `docs/assets-research.md`).

## Rekwizyty fasad: `city-props.glb` (ADR-0058)

Klimatyzatory, anteny i czasza, rury i markizy z paczek **CC0**, na tej samej palecie co
`city-kit.glb`. Renderer piecze je do istniejących siatek komórek (kit 64 m i komórki mapy), bez
nowych wywołań rysowania. Paczki z URL-ami i sha256: `tools/assets/sources.json`.

| Klucze w pliku | Źródło (pobranie) | Autor | Licencja (cytat z paczki) |
|---|---|---|---|
| `pr-ac-box`, `pr-ac-side`, `pr-ac-stack`, `pr-antenna`, `pr-dish`, `pr-pipe`, `pr-pipe-corner` | [Cyberpunk Game Kit](https://drive.google.com/drive/folders/1GyKLypoBxrpLN6GERF9U610Wiub48v9y), `Platforms/AC`, `AC_Side`, `AC_Stacked`, `Antenna_1`, `Antenna_2`, `Pipe_1`, `Pipe_Corner` (`.gltf`, pliki z `drive.usercontent.google.com`, id w `sources.json`) | Quaternius | CC0: „License: CC0 1.0 Universal (CC0 1.0) Public Domain Dedication” |
| `pr-ac-lite-a`, `pr-ac-lite-b` (tania wersja na telefon), `pr-awning-flat-*`, `pr-awning-flat-c-*` | [Modular Buildings 2.1](https://opengameart.org/content/modular-buildings), `detail-ac-a`, `detail-ac-b`, `roof-flat-awning-a`, `roof-flat-awning-c`; `https://opengameart.org/sites/default/files/kenney_modular-buildings.zip` | Kenney | CC0: „License: (Creative Commons Zero, CC0) … You can use this content for personal, educational, and commercial purposes.” |
| `pr-awning-wide-*`, `pr-awning-small-*` | [Retro Urban Kit 2.0](https://opengameart.org/content/retro-urban-kit), `detail-awning-wide`, `detail-awning-small`; `https://opengameart.org/sites/default/files/kenney_retro-urban-kit.zip` | Kenney | CC0: „License: (Creative Commons Zero, CC0) http://creativecommons.org/publicdomain/zero/1.0/” |

Zmiany względem oryginałów (`tools/city_props.py`): kolor każdego trójkąta to uśredniony kolor
tekseli pod nim (Kenney) albo płaski materiał (Quaternius), przypisany do roli palety; emisja
przechodzi w neon. Markizy dostają płótno `fabric-teal`, `fabric-magenta` albo `fabric-amber`
(osobny model na kolor). Front na +Z, metry, wyśrodkowane, `extras.size` i `extras.styles`
(rodzaj miejsca: `ac-wall`, `dish`, `awning`…), do 1,5 tys. trójkątów na model.

Odtworzenie pliku:

```
NODE_USE_ENV_PROXY=1 node tools/assets/fetch.mjs /tmp/city-assets
python3 -I -B tools/city_kit.py --props /tmp/city-assets \
  --quaternius /tmp/city-assets/quaternius-cyberpunk-kit --ccby /tmp/city-assets \
  --out packages/app/public/city
```

## Rekwizyty ulic na licencji CC-BY 4.0 (ADR-0063)

Dwa modele w `city-props.glb` są na licencji **CC-BY 4.0**: wolno je używać, zmieniać i
rozpowszechniać, także komercyjnie, pod warunkiem podania autora, źródła i licencji oraz zaznaczenia
zmian. Ten sam podpis jest na ekranie „Twórcy” w menu gry (`packages/ui/src/credits/credits.ts`);
węzeł modelu w pliku ma `extras.credit` z identyfikatorem źródła z `tools/assets/sources.json`.

| Klucz w pliku | Tytuł | Autor | Źródło | Licencja | Zmiany |
|---|---|---|---|---|---|
| `pr-pole` (słupy z kablami nad bocznymi ulicami Podzamcza i Nabrzeża) | Electric pole | [Eh (Just_Eh)](https://sketchfab.com/Just_Eh) | [Sketchfab](https://sketchfab.com/3d-models/electric-pole-a41cc931ffd84947b8f7b566acc33384) | [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/) | jeden z czterech słupów z pliku, uproszczony z 3,7 do 1,4 tys. trójkątów, kolory sprowadzone do palety, skala 3,4 (8,6 m) |
| `pr-robodog` (robopies przy straganach i bramach) | Robotic Animal | [igor.tesV](https://sketchfab.com/igor.tesV) | [Sketchfab](https://sketchfab.com/3d-models/robotic-animal-d36aed18ec8f4638901e6e5c7ab4e7f6) | [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/) | uproszczony z 9,6 do 1,4 tys. trójkątów, kolory z tekstur sprowadzone do palety, bez tekstur, skala 0,025 (0,5 m) |

Zmiany względem oryginałów (`tools/city_ccby.py`): kolor trójkąta z płaskiego materiału (słup) albo
uśredniony z tekstury (robopies), przypisany do roli palety; emisja przechodzi w neon albo lampę.
Siatka uproszczona przez grupowanie wierzchołków w siatce sześcianów (najdrobniejsza siatka, która
mieści model w 1,4 tys. trójkątów), normalne płaskie. Front na +Z, metry, `extras.size`,
`extras.styles` (`pole`, `robodog`), `extras.lights` (lampa słupa, pod halo).

Renderer stawia słup zamiast latarni drogowej przy bocznej ulicy (OSM `residential`, `service`…)
Podzamcza i Nabrzeża, w miejscu jej bryły, i rozpina kable do najbliższego słupa; robopies leży bokiem
przy ladzie co trzeciego straganu Podzamcza i przy fasadzie obok bram (Krakowska, Grodzka, część
przejść bramnych). Bez nowych brył w symulacji i bez nowych wywołań rysowania.

Pozostałe cztery modele z tej paczki (`cyberpunk_building`, `futuristic_compact_room`,
`hw_4_cyberpunk_sci-fi_building`, `sci-fi_megacity_cluster`) są w `sources.json`, ale jeszcze nie w
grze (etapy 2–4 ADR-0063); dostaną wiersz tutaj, gdy trafią do pliku.

Wyłączenie w grze: `?city=off` (zostają gołe bryły, bez kitu i bez rekwizytów).
