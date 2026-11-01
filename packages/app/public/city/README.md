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
zmian. Ten sam podpis jest na ekranie „Autorzy” w menu gry (`packages/ui/src/credits/credits.ts`);
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

## Megawieże panoramy na licencji CC-BY 4.0 (ADR-0063, etap 2)

Cztery megawieże w `city-props.glb` (`mc-tower-a` … `mc-tower-d`, `extras.styles` `megatower`) są
z modelu na licencji **CC-BY 4.0**, z tym samym podpisem na ekranie „Autorzy” i `extras.credit` w węźle.

| Klucz w pliku | Tytuł | Autor | Źródło | Licencja | Zmiany |
|---|---|---|---|---|---|
| `mc-tower-a` … `mc-tower-d` (megawieże panoramy za Czechowem, al. Kraśnicką, Zalewem i Tatarami) | Sci-Fi Megacity Cluster – Free  Asset Pac | [TRYFIELD](https://sketchfab.com/tryfield) | [Sketchfab](https://sketchfab.com/3d-models/sci-fi-megacity-cluster-free-asset-pac-458380c745dc4e05ae5e0f6e7b4c69b2) | [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/) | cztery wycinki kwartału (z 503 tys. trójkątów: 12,4, 10,9, 5,5 i 19,9 tys.) przerobione na pole wysokości i uproszczone do 0,9–1,2 tys. trójkątów, kolory sprowadzone do palety, światła okien jako pasy neonu, bez tekstur |

Zmiany względem oryginału (`tools/city_megacity.py`): model to jeden kwartał miasta ok. 200 × 200
jednostek, do 108 wysokości. Każda wieża to kwadratowy wycinek wokół jednego z najwyższych budynków
(z niższymi budynkami u stóp jako podium), bez płaszczyzn gruntu i piwnic. Wycinek staje się polem
wysokości na siatce (najdrobniejsza siatka 1–1,3 jednostki, która mieści wieżę w 1,2 tys.
trójkątów, wysokości co 2 jednostki): dachy scalone w prostokąty, ściany w pasy. Kolor ścian i dachów
z koloru bazowego pod nimi (cegła, `trim`, `trim-light`), a gdzie tekstura emisji świeci w co
najmniej 20% trójkątów komórki, góra jej ścian dostaje pas światła (`win-warm` albo najbliższy neon).
Stoi na y = 0, wyśrodkowana, `extras.size`.

Renderer (`packages/engine/src/renderer/mapcity/skyline-bodies.ts`) daje każdej z dwunastu wież
panoramy (ADR-0051) po kolei jedną z czterech brył, w skali jej wysokości (w poprzek 0,8 tej skali),
frontem do centrum, w tej samej siatce wież co dotąd: bez nowych wywołań rysowania. Na telefonie
(`low`) zostają proceduralne wieże.

Pozostałe trzy modele z paczki CC-BY (`cyberpunk_building`, `futuristic_compact_room`,
`hw_4_cyberpunk_sci-fi_building`) są w `sources.json`, ale jeszcze nie w grze (etapy 3–4 ADR-0063);
dostaną wiersz tutaj, gdy trafią do pliku.

## Meble ulicy na licencji CC-BY 4.0: `street-props.glb` (ADR-0063, druga paczka)

Osiem modeli z drugiej paczki ze Sketchfaba (inwentaryzacja: `docs/plany/assety-paczka-2.md`) na
licencji **CC-BY 4.0**, w osobnym pliku na tej samej palecie, bo `city-props.glb` jest blisko limitu
512 KiB. Gra wczytuje oba pliki po kicie i łączy je w jeden zestaw rekwizytów. Węzeł modelu ma
`extras.credit`, podpis jest na ekranie „Autorzy”.

| Klucz w pliku | Tytuł | Autor | Źródło | Licencja | Zmiany |
|---|---|---|---|---|---|
| `st-vending` (automat z napojami) | Vending Machine | [A9908244](https://sketchfab.com/A9908244) | [Sketchfab](https://sketchfab.com/3d-models/vending-machine-85faa612692e4ec48d6bd9d21484c239) | [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 434 trójkąty bez upraszczania, kolory sprowadzone do palety, towar za szybą świeci (`win-white`), wpasowany w bryłę automatu (0,98 × 1,9 × 0,74 m) |
| `st-vending-ramen` (automat z ramenem) | Ramen Vending Machine | [JustFaith](https://sketchfab.com/charljustine) | [Sketchfab](https://sketchfab.com/3d-models/ramen-vending-machine-3d3c8affeaa44620b7a04fa4a987ff99) | [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/) | bez neonowego szyldu z literami na górze (po uproszczeniu robił się z niego bezkształtny kleks), uproszczony z 53,2 do 1,4 tys. trójkątów, kolory i neony sprowadzone do palety (duże szyby przyciemnione do `shop-teal`), wpasowany w bryłę automatu (0,96 × 1,89 × 0,54 m) |
| `st-ticket-terminal` (biletomat) | Reston B2 Terminal | [Iteration Unlimited](https://sketchfab.com/iterationunlimited) | [Sketchfab](https://sketchfab.com/3d-models/reston-b2-terminal-91b08809f18244628385193e396dd3da) | [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/) | żółty z dwóch terminali w pliku (3,3 tys. trójkątów) uproszczony do 0,9 tys., kolory sprowadzone do palety, postawiony na dodanym ciemnym słupku 0,8 m, razem 0,5 × 1,64 × 0,3 m |
| `st-ticket-kiosk` (biletomat) | Scifi Kiosk | [Martin Ibbett](https://sketchfab.com/unyxium) | [Sketchfab](https://sketchfab.com/3d-models/scifi-kiosk-835aac31a9114203b5cb04952f9a273b) | [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/) | uproszczony z 2,1 do 0,9 tys. trójkątów, kolory sprowadzone do palety, ekran świeci (`win-teal`), 0,5 × 1,67 × 0,38 m |
| `st-cctv` (kamera na maszcie) | CCTV Camera | [Smoggybeard](https://sketchfab.com/Smoggybeard) | [Sketchfab](https://sketchfab.com/3d-models/cctv-camera-e69d5eb37ffb4f188e4d3c84a5d79cdc) | [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/) | uproszczony z 3,2 do 0,7 tys. trójkątów, kolory sprowadzone do palety, długość 0,6 m, zawieszony na dodanym maszcie 4,2 m |
| `st-food-cart` (wózek z jedzeniem przy targach) | Avika Street Food Cart | [AVIKA](https://sketchfab.com/a-v-i-k-a) | [Sketchfab](https://sketchfab.com/3d-models/avika-street-food-cart-d54005c378fa45c3a06090d65a53fb23) | [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/) | uproszczony z 36,2 do 0,96 tys. trójkątów (koła osobno, cztery słupki daszku dorysowane), kolory z tekstur sprowadzone do palety, bez tekstur, wpasowany w bryłę wózka (3,82 × 2,6 × 1,47 m) |
| `st-container-rust`, `st-container-dumpster` (kontenery na Giełdzie na Kresowej) | Classic Shipping Container (Free/Gameready) | [Sebastian Webster](https://sketchfab.com/Sebastian.Hamish.Webster) | [Sketchfab](https://sketchfab.com/3d-models/classic-shipping-container-freegameready-772f4be391a245f699c54e6cf157c58d) | [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/) | uproszczony z 17,1 do 0,67 tys. trójkątów, blacha w dwóch kolorach palety (`rust`, `dumpster`), bez tekstur, wpasowany w bryłę kontenera (5,96 × 2,53 × 2,42 m) |
| `st-lantern` (lampiony chochin pod daszkiem straganu) | Chinese \ Japanese paper lantern chochin | [DeepDown](https://sketchfab.com/deepdown) | [Sketchfab](https://sketchfab.com/3d-models/chinese-japanese-paper-lantern-chochin-20bcc5d20f2847f88aef3a267275d16c) | [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/) | uproszczony z 2,8 tys. do 201 trójkątów, kolory sprowadzone do palety, czerwony papier świeci (`neon-red`), 0,44 m |

Meble deptaka ADR-0058 etap 2 (`tools/city_street_e2.py`) z paczek CC0 w tym samym pliku:

| Klucze w pliku | Źródło (pobranie) | Autor | Licencja (cytat) |
|---|---|---|---|
| `st-atm` (bankomat wolnostojący) | [Low poly ATMs](https://opengameart.org/content/low-poly-atms), `ATM_NORMAL.obj`; `https://opengameart.org/sites/default/files/ATMs.zip` | pixelmannen | CC0: „License(s): CC0” (strona; paczka bez pliku licencji) |
| `st-hydrant` (hydrant nadziemny, czerwony) | [Zombie Apocalypse Kit](https://quaternius.com/packs/zombieapocalypsekit.html), `Environment/glTF/FireHydrant.gltf` (plik z `drive.usercontent.google.com`, id w `sources.json`) | Quaternius | CC0 (strona paczki i https://quaternius.com/license.html; `License.txt` w folderze paczki ma nagłówek innej paczki) |
| `st-planter` (donica z krzakiem i kwiatami) | [Nature Kit 2.1](https://opengameart.org/content/nature-kit), `pot_large`, `plant_bushDetailed`, `flower_redA`, `flower_purpleB`; `https://opengameart.org/sites/default/files/Nature%20Kit%20%282.1%29.zip` | Kenney | CC0: „License: (Creative Commons Zero, CC0) http://creativecommons.org/publicdomain/zero/1.0/” |
| `st-bike` (rower przy stojaku) | [Public Transport Pack](https://quaternius.com/packs/publictransport.html), `OBJ/Bicycle.obj` (plik z `drive.usercontent.google.com`) | Quaternius | CC0 (strona paczki i https://quaternius.com/license.html) |
| `st-scooter` (skuter przy stojaku) | [bike](https://opengameart.org/content/bike-0), `bike.obj`; `https://opengameart.org/sites/default/files/bike.zip` | lyricsz | CC0: „License(s): CC0” (strona; paczka bez pliku licencji) |

Każdy jest uproszczony do 0,3–0,35 tys. trójkątów (rower do 0,7 tys., żeby kierownica i obręcze zostały całe), bez luźnych drobin, kolory z MTL, materiałów albo tekstur sprowadzone
do palety (ekran bankomatu `win-teal`, fioletowe kwiaty donicy `neon-violet`) i wpasowany w bryłę swojego
rodzaju mebla; rower (0,48 × 0,99 × 1,65 m) i skuter (0,56 × 1,0 × 1,57 m) stoją w poprzek obręczy stojaka,
w jego bryle (1,7 × 1,66 m). Hydrant ma czerwony kolor palety (`fabric-magenta`). Na telefonie (`low`) zostają proceduralne wersje (`prop-e2.ts`).

Zmiany względem oryginałów (`tools/city_street.py`, funkcje pomocnicze z `tools/city_ccby.py`): kolor
trójkąta uśredniony z tekstury i przypisany do roli palety, emisja jako neon, siatka uproszczona przez
grupowanie wierzchołków, normalne płaskie, bez tekstur. Każdy model jest wpasowany (osobno w każdej
osi) w pudło bryły swojego rodzaju mebla z symulacji (`packages/sim/src/content/lublin/furniture.ts`).
Front na +Z, `extras.size`, `extras.styles` (rodzaj mebla: `vending-machine`, `ticket-machine`, `cctv`,
`lantern`, `atm`, `hydrant`, `planter`, `food-cart`, `container`, `parked-bike`, `parked-scooter`).

Renderer (`packages/engine/src/renderer/mapcity/street-models.ts`) rysuje automaty z napojami,
biletomaty i kamery na masztach jako te modele (model wybrany z pozycji), w miejscu i obrocie
proceduralnego mebla, a pod daszkiem co trzeciego straganu wiesza dwa lampiony. Wszystko trafia do siatki
bloku mebli, więc nie ma nowych wywołań rysowania ani zmian w symulacji. Na telefonie (`low`) zostają
meble proceduralne. Od ADR-0058 etapu 2 tak samo bankomaty, hydranty, donice, wózki z jedzeniem, kontenery
(kolor z kształtu) oraz rowery i skuter przy stojakach (obręcze zostają proceduralne); bryły i miejsca tych
rodzajów weszły do symulacji w tym samym etapie (`furniture.ts`, `docs/world/lublin-props.todo.json`).

Odtworzenie pliku:

```
NODE_USE_ENV_PROXY=1 node tools/assets/fetch.mjs /tmp/city-assets --only sketchfab-vending-machine,sketchfab-ramen-vending-machine,sketchfab-reston-b2-terminal,sketchfab-scifi-kiosk,sketchfab-cctv-camera,sketchfab-paper-lantern-chochin,sketchfab-avika-street-food-cart,sketchfab-shipping-container,oga-pixelmannen-atms,quaternius-zombie-kit,kenney-nature-kit,quaternius-public-transport,oga-lyricsz-bike
python3 -I -B tools/city_kit.py --street /tmp/city-assets --out packages/app/public/city
```

Pozostałe modele drugiej paczki są w `sources.json` z `"used": []` (kolejne etapy, plan w
`docs/plany/assety-paczka-2.md`); dostaną wiersz tutaj, gdy trafią do pliku.

Wyłączenie w grze: `?city=off` (zostają gołe bryły, bez kitu i bez rekwizytów obu plików).
