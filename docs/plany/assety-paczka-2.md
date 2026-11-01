# Assety: druga paczka ze Sketchfaba (ADR-0063)

Użytkownik dodał 31.10 do folderu na Dysku 27 modeli z listy kandydatów (`docs/plany/sketchfab-kandydaci.md`
na gałęzi sesji). Każdy plik ma licencję i autora w `asset.extras` glTF; wszystkie są na **CC-BY 4.0**,
więc żadnego nie odrzucamy z powodu licencji (ADR-0063: tylko CC0 albo CC-BY 4.0). Wszystkie mają
wpis w `tools/assets/sources.json` (URL pobrania, sha256, autor, strona, licencja). Modele jeszcze
niewykorzystane mają `"used": []`.

Pomiary z `scene_triangles` (trójkąty po rozwinięciu węzłów, wymiary w jednostkach pliku). „Tekstury”
to liczba obrazów w pliku. Ocena stylu dotyczy wyniku po sprowadzeniu do palety NPR (ADR-0022):
tekstury znikają, a kolor trójkąta to uśredniony teksel przypisany do roli palety. Liczą się więc
bryła i duże płaszczyzny koloru, a nie detal namalowany w teksturze.

## Inwentaryzacja

| Plik | Autor | Rozmiar | Trójkąty | Tekstury | Wymiary (jedn.) | Przeznaczenie | Styl po palecie | Etap |
|---|---|---|---|---|---|---|---|---|
| `vending_machine` | A9908244 | 0,7 MB | 434 | 2 | 1,23 × 2 × 1,19 | rekwizyt ulicy: automat z napojami | dobry: prosta bryła, szyba z towarem świeci | **w kodzie** (`st-vending`) |
| `ramen_vending_machine` | JustFaith | 16,6 MB | 53,2 tys. | 4 | 1,34 × 2,09 × 0,54 | rekwizyt ulicy: automat z ramenem | dobry: neonowy szyld z liter z bryły (WOKMASTER RAMEN, zmyślona marka), po uproszczeniu litery robiły się kleksem, więc szyld jest odcięty przy wypieku (`below`) | **w kodzie** (`st-vending-ramen`) |
| `reston_b2_terminal` | Iteration Unlimited | 16,4 MB | 6,5 tys. | 10 | 0,73 × 0,6 × 0,2 (dwa terminale) | rekwizyt ulicy: biletomat (żółty terminal na słupku) | dobry, żółty jak biletomaty ZTM | **w kodzie** (`st-ticket-terminal`) |
| `scifi_kiosk` | Martin Ibbett | 1,8 MB | 2,1 tys. | 3 | 0,37 × 1,21 × 0,31 | rekwizyt ulicy: słupek informacyjny/biletomat (to nie kiosk-budka) | dobry: ciemny słupek, ekran świeci | **w kodzie** (`st-ticket-kiosk`) |
| `cctv_camera` | Smoggybeard | 3,2 MB | 3,2 tys. | 7 | 0,66 × 1,33 × 2 | rekwizyt ulicy: kamera na maszcie (rodzaj `cctv`) | dobry | **w kodzie** (`st-cctv`) |
| `chinese__japanese_paper_lantern_chochin` | DeepDown | 2,8 MB | 2,8 tys. | 3 | 0,38 × 0,58 × 0,38 | rekwizyt ulicy: lampiony pod daszkami straganów | dobry: czerwony papier jako neon | **w kodzie** (`st-lantern`) |
| `simple_mini-atm` | Blender3D | 19,4 MB | 3 tys. | 4 | szkielet, wymiary w pozie wiązania | rekwizyt fasady: bankomat w ścianie przy bankach i sklepach | średni: ciemna płyta z jedną szczeliną; ma szkielet i animację (do pominięcia) | E2 (fasady) |
| `avika_street_food_cart` | AVIKA | 9,1 MB | 36,2 tys. | 10 | 3,91 × 2,65 × 1,48 | rekwizyt ulicy: wózek z jedzeniem na targu | dobry, ale 3,9 m długości nie mieści się w bryle straganu (2,1 × 0,5 m lady); potrzebuje własnych miejsc i bryły w symulacji | **w kodzie** (`st-food-cart`, rodzaj `food-cart`) |
| `classic_shipping_container_freegameready` | Sebastian Webster | 4,3 MB | 17,1 tys. | 3 | 5,85 × 2,34 × 2,95 (otwarte drzwi) | rekwizyt: kontenery na Nabrzeżu i w nadbudówkach (`vertical-plan`, rodzaj `container`) | dobry: żebrowana bryła, kolor z puli kontenerów | **w kodzie** (`st-container-rust`, `-dumpster`, rodzaj `container`) |
| `street_asset_pack` | vmatthew | 55,9 MB | 37,8 tys. | 138 | 12,8 × 6,1 × 6,8 (paczka) | rekwizyty ulicy: barierki, pachołki, znaki, worki, hydrant, skrzynki | dobry dla barierek i pachołków; znaki drogowe to tekstury (zostają płaskie tarcze) | E2 (wycinki) |
| `satellite_comms` | Duane's Mind | 2,3 MB | 8,7 tys. | 2 | 11,6 × 17,2 × 13 | dach: duża antena satelitarna (Tessen, wieże) | dobry | E2 (dachy) |
| `taiwan_style_signboard_lowpoly` | Solarliu | 16,5 MB | 3,5 tys. | 7 | 54 × 37 × 20 (zestaw) | szyldy na elewacji (zestaw ramek i wysięgników) | dobry jako bryły tablic; atlas tekstur ma **prawdziwe marki** (Coca-Cola, McDonald's, Panasonic, Carrefour), ale tekstury nie przechodzą do gry: tablice dostają jednolity kolor palety, napisy rysuje gra | E3 (szyldy) |
| `game_ready_japanese_small_vertical_neon_sign` | Alex Bes | 16,3 MB | 7,1 tys. | 8 | 13,7 × 103 × 45,6 | szyld pionowy na wysięgniku | dobry: litery z bryły, napis fikcyjny/ogólny (寿司バー, „sushi bar”) | E3 (szyldy) |
| `japanese_neon_sign_set_low_poly_for_background` | YD Visual | 1,3 MB | 36 | 18 | płaskie kwadraty | szyldy w tle (18 płaskich tablic) | słaby: same płaskie kwadraty, napis tylko w teksturze emisji (ogólne słowa: 東京, 写真…, fikcyjne), po palecie to jednolite prostokąty neonu | E3 (najwyżej jako bryły tła) |
| `cyberpunk_animated_japanese_led_neon_sign` | YD Visual | 3,4 MB | 328 | 16 | 2,32 × 3,2 × 0,35 | szyld LED na wysięgniku | dobry: pusta tablica LED w ramie, napis tylko w animowanej teksturze (ogólne znaki, fikcyjne) | E3 (szyldy) |
| `cyberpunk_diner_sign_japanese` | LukeMarsh201 | 4 MB | 3 tys. | 15 | 18 × 8,6 × 1,2 | szyld na elewacji (bar, jadłodajnia) | dobry: rama z rurek neonu i litery z bryły (ダイナー, „diner”, fikcyjne) | E3 (szyldy) |
| `asian_shop_pack_free_gameready` | abhayexe | 22,7 MB | 38,9 tys. | 28 | 24,3 × 6 × 6,4 | parter z witrynami i markizami | słaby: fasada jest w teksturach ze zdjęć, a tekstury mają **prawdziwe marki** (Standard Chartered, McDonald's, 7-Eleven) i prawdziwe koreańskie szyldy; po palecie zostaje płaska ściana | odrzucony z planu (zostaje tylko wpis w `sources.json`) |
| `cyberpunk_drone_concept_design` | Berk Gedik | 7,7 MB | 21,2 tys. | 7 | 2 × 0,61 × 0,95 | dron jako NPC/patrol (Tessen) | dobry: czerwony kadłub, cztery wirniki | E4 (drony) |
| `cyberpunk_robot` | Doink | 4,5 MB | 12,5 tys. | 4 | 108 × 164 × 33 | postać humanoidalna (androidka), NPC | dobry, ale to postać ze szkieletem: przez potok postaci, nie przez `city_kit` | E4 (NPC) |
| `cyberpunk_car` | 4d_Bob | 2,5 MB | 11,4 tys. | 4 | 223 × 141 × 541 (Z w górę) | pojazd: sportowe auto, ruch uliczny | dobry: ciemny lakier, felgi z neonem | E5 (pojazdy) |
| `dirty_car` | 3D Error 404 | 6,8 MB | 16,7 tys. | 7 | 262 × 179 × 601 (Z w górę) | pojazd: stary sedan, wrak, parkujące auta | dobry, rdza z tekstury znika (lakier z palety) | E5 (pojazdy) |
| `cyberpunk_apartment` | Jiaxing | 3,3 MB | 11,3 tys. | 5 | 0,31 × 0,14 × 0,38 (skala do poprawy) | wnętrze kapsuły/mieszkania (etap 3 ADR-0063) | średni: mało koloru, 131 siatek, animacja kamery do pominięcia | E6 (wnętrza) |
| `neon_bedroom` | dylanheyes | 6,6 MB | 33,6 tys. | 11 | 6,2 × 3,8 × 8 | wnętrze: sypialnia z neonami (kryjówka Seki, pokój do wynajęcia) | dobry: fiolet i magenta, neony na ścianach (napis ogólny, fikcyjny) | E6 (wnętrza) |
| `fire_escape__exit_doors` | blue man group | 1,8 MB | 3,9 tys. | 5 | 0,11 × 1,57 × 1,45 | drzwi: wyjście ewakuacyjne w podwórzach i na zapleczach | dobry | E7 (drzwi i okna) |
| `cyberpunk_city_assets_pack_3_doors_and_windows` | carlcapu9 | 4,1 MB | 11,5 tys. | 3 | 3,7 × 18,5 × 37,6 (zestaw 24 elementów) | drzwi i okna kamienic, balkon | dobry: ramy i szprosy z bryły | E7 (drzwi i okna) |
| `cyberpunk_sci-fi_door_3_-_free` | Jesus Fernandez Garcia | 2 MB | 766 | 4 | 79 × 444 × 330 | drzwi: śluza (Tessen, metro, kryjówki) | dobry | E7 (drzwi i okna) |
| `low-poly_psx_style_garage_doors_pack` | vanillao03 | 1,1 MB | 4,7 tys. | 1 | 40 × 3,8 × 2,3 (zestaw) | bramy garażowe i rolety sklepów | dobry: proste płyty | E7 (drzwi i okna) |

**Licencje:** 27 z 27 to CC-BY 4.0 (`asset.extras.license: CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)`).
Brief mówił o 26 plikach, a lista ID ma 27. Żadnego pliku nie odrzucamy z powodu licencji.

**Prawdziwe marki (decyzja z 31.10, ADR-0064: szyldy zostają z fikcyjnymi napisami, kolory z palety):**
- `taiwan_style_signboard_lowpoly`: atlas z logo Coca-Coli, McDonald's, Panasonica i Carrefoura.
  Potok `city_kit` nie przenosi tekstur, więc w grze zostają tablice w jednolitych kolorach palety.
  Przy każdej przyszłej zmianie potoku (np. pieczenie napisów z tekstur) kafle z markami trzeba
  zamalować.
- `asian_shop_pack_free_gameready`: zdjęciowe fasady z logo Standard Chartered, McDonald's i 7-Eleven.
  Odrzucony z planu, bo bez tekstur nie ma z niego pożytku, a z teksturami narusza zasadę fikcyjnych marek.
- Pozostałe szyldy mają napisy ogólne albo zmyślone: ダイナー, 寿司バー, pojedyncze kanji i słowa
  (東京, 写真), WOKMASTER RAMEN. Te można zostawić.

## Co weszło w kod (etap 1 paczki: rekwizyty ulicy)

`packages/app/public/city/street-props.glb` (236 KiB, osobny plik, bo `city-props.glb` ma 465 z 512 KiB),
pieczony przez `python3 -I tools/city_kit.py --street DIR` (`tools/city_street.py`). Gra ładuje go za
fasadą `BabylonRenderer` razem z `city-props.glb` (loader kitu scala oba pliki, `mergeCityProps`).
Bloki mebli (`mapcity/street-models.ts`) rysują:
- automaty z napojami (rodzaj `vending-machine`) jako `st-vending` / `st-vending-ramen`, model według kształtu;
- biletomaty (`ticket-machine`) jako `st-ticket-terminal` / `st-ticket-kiosk`, model według pozycji;
- kamery na masztach (`cctv`) jako `st-cctv`;
- po dwa lampiony `st-lantern` pod daszkiem co trzeciego straganu (`market-stall`; na wszystkich ok. 400 straganach Podzamcza dodałyby jedną trzecią trójkątów bloków).

Każdy model jest wpasowany w pudło bryły swojego rodzaju z symulacji, więc pozycje, kolizje i złote
hashe się nie zmieniają. Wszystko trafia do siatki bloku mebli, więc wywołań rysowania i siatek nie
przybywa. Na telefonie (`low`) zostają meble proceduralne.

Do kodu nie weszły z pierwszej partii, choć brief je wymieniał:
- **kiosk** (rodzaj `kiosk`, budka 2,6 × 2 m): `scifi_kiosk` to słupek z ekranem, nie budka, więc trafił do biletomatów;
- **mini-ATM**: brak wolnostojącego rodzaju, a model to płyta do ściany ze szkieletem. Trafi do rekwizytów fasad (E2);
- **wózek z jedzeniem**: nie mieści się w bryle straganu, potrzebuje własnych miejsc i bryły w symulacji (E2);
- **kontener**: w meblach ulicy nie ma takiego rodzaju; kontenery dziś to proceduralne kondygnacje nadbudówek (E2).

Kamery urządzeń z ADR-0029 (bloki `device` w symulacji) mają widok `block` z kontraktu `ViewDescriptor`.
Podmiana na model wymaga zmiany kontraktu (nowy rodzaj widoku), więc zostaje na osobny ADR.

## Co weszło w kod (E2, razem z ADR-0058 etap 2)

Nowe rodzaje mebli z bryłą w symulacji i miejscami z importu (`furniture.ts`, `docs/world/lublin-props.todo.json`,
`tools/osm-import/src/props-bulky.ts`), modele w `street-props.glb` (`tools/city_street_e2.py`):
- wózek AVIKA (`food-cart`, bryła 3,9 × 1,5 m): 3 przy Targu na Ruskiej i 2 na Giełdzie na Kresowej, w miejscach,
  gdzie cały obrys z przejściem 1 m leży na wolnym chodniku obok straganów; 0,9 tys. trójkątów;
- kontener (`container`, 20 ft): 6 na Giełdzie na Kresowej („kontenery Tessen”, stawiane przed straganami), w dwóch
  kolorach palety (`rust`, `dumpster`, kolor z kształtu), 0,67 tys. trójkątów; w nadbudówkach (`vertical-plan`) zostają proceduralne;
- z paczek CC0 w tym samym etapie: bankomat wolnostojący (pixelmannen), hydrant (Quaternius; 6 nadziemnych z OSM,
  `data/osm/points/hydrants.json`), donica (Kenney Nature Kit), rower (Quaternius) i skuter (lyricsz) przy stojakach.

Wypiek (`tools/city_street_e2.py`): luźne części poniżej 12 trójkątów odpadają (`drop_specks`, także w modelach
etapu 1), koła wózka upraszczane osobno (`bands`), słupki daszku dorysowane, rower 0,7 tys. trójkątów, żeby
kierownica i obręcze zostały całe.

Odłożone: **mini-ATM w ścianach** (`simple_mini-atm`). Potrzebuje przypisania do elewacji banku (fasada,
wysokość, odsunięcie od okien i drzwi), czyli rekwizytu fasady w `wall-clutter`/`facade-props` z rolą
`atm` i listą banków z OSM (`amenity=bank`, 12 na Krakowskim), a model ma szkielet w pozie wiązania. Bankomaty
z OSM, które stoją w ścianach, są dziś wolnostojącymi terminalami 0,5 m od ściany (T-089). `street_asset_pack`
(barierki, pachołki) też czeka: jego hydrant okazał się wysmukłym słupkiem, więc hydrant jest z Quaterniusa.

## Plan kolejnych etapów (osobne PR-y)

- **E2: rekwizyty z bryłą albo miejscem.** Wózek AVIKA i kontener jako nowe rodzaje mebli (bryła w
  `furniture.ts`, rozstawienie w imporcie Lublina, zmiana złotego hasha i przegląd `topography-curator`).
  Mini-ATM w ścianach przy bankach i sklepach (`wall-clutter`, styl `atm`). Barierki i pachołki ze
  `street_asset_pack` przy robotach drogowych. Antena `satellite_comms` na dachach wież Tessen (`kit-props`, styl `dish-big`).
- **E3: szyldy i neony (ADR-0064).** Bazy pod parodie prawdziwych lokali z OSM (etap 4 ADR-0064):
  napis rysuje gra, model daje bryłę i ramę.
  - `cyberpunk_animated_japanese_led_neon_sign`: pusta tablica LED na wysięgniku, 328 trójkątów. To
    najlepsza baza pod szyld wysięgnikowy z nazwą lokalu.
  - `cyberpunk_diner_sign_japanese`: prostokątna rama z rurek neonu. Litery z bryły trzeba odciąć
    (wycinek po materiale), a w środku napis gry. Baza pod szyld nad witryną.
  - `game_ready_japanese_small_vertical_neon_sign`: pionowa tablica na wysięgniku, litery do odcięcia.
    Baza pod pionowe szyldy kamienic (Krakowskie, Lubartowska).
  - `taiwan_style_signboard_lowpoly`: kilkanaście kształtów tablic i wysięgników (okrągłe, pionowe,
    skrzynki). Pocięte na osobne bryły dają różnorodne tła. Tekstury z markami odpadają przy pieczeniu.
  - `japanese_neon_sign_set_low_poly_for_background`: same płaskie kwadraty, nic nie wnosi ponad
    proceduralne tablice, więc tylko jako rezerwa.
- **E4: drony i roboty.** `cyberpunk_drone_concept_design` jako dron patrolowy Tessen (widok postaci
  albo pojazdu z AI, z ADR-em do kontraktu widoku). `cyberpunk_robot` przez potok postaci (szkielet,
  animacje), poza `city_kit`.
- **E5: pojazdy.** `cyberpunk_car` i `dirty_car` do `city-kit.glb` obok aut Kenneya (oś Z w górę
  obrócona, lakier jako `paint`, światła z emisji), z kontrolą budżetu trójkątów ruchu ulicznego.
- **E6: wnętrza** (etap 3 ADR-0063). `neon_bedroom` jako kryjówka Seki albo pokój do wynajęcia,
  `cyberpunk_apartment` jako druga kapsuła (skala ×~25, bez animacji kamery).
- **E7: drzwi i okna.** `fire_escape__exit_doors`, `cyberpunk_city_assets_pack_3_doors_and_windows`,
  `cyberpunk_sci-fi_door_3_-_free` i `low-poly_psx_style_garage_doors_pack` jako warianty drzwi i okien
  fasad (z rolami szyb jak w kicie) oraz rolety sklepów.
