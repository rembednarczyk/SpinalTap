# ADR-0063: Assety CC-BY 4.0 obok CC0 i paczka od użytkownika

## Kontekst
ADR-0058 dopuszcza tylko modele na licencji CC0. Użytkownik przekazał (31.10, folder na Google Drive) sześć modeli ze Sketchfaba, wszystkie na CC-BY 4.0 (licencja i autor zapisane w `asset.extras` pliku glTF):

| Plik | Autor | Rozmiar | Trójkąty | Tekstury |
|---|---|---|---|---|
| `electric_pole.glb` | Just_Eh | 1,2 MB | 18 tys. | brak (16 materiałów) |
| `robotic_animal.glb` | igor.tesV | 7,8 MB | 9,6 tys. | 4 (bez szkieletu i animacji) |
| `cyberpunk_building.glb` | igor.tesV | 25 MB | 11 tys. | 20 |
| `futuristic_compact_room.glb` | igor.tesV | 41 MB | 14 tys. | 19 |
| `hw_4_cyberpunk_sci-fi_building.glb` | Just_Eh | 11,8 MB | 225 tys. | 11 (56 materiałów) |
| `sci-fi_megacity_cluster.glb` | TRYFIELD | 62 MB | 503 tys. | 11 |

Użytkownik zdecydował (31.10): dopuszczamy CC-BY 4.0.

## Decyzja
- **Licencje:** CC0 albo CC-BY 4.0. Inne (CC-BY-SA, CC-BY-NC, płatne, bez licencji) dalej odpadają. Dotyczy modeli, tekstur i dźwięków (ADR-0060 bez zmian w części o głosach).
- **Uznanie autorstwa:**
  - każdy plik CC-BY ma wiersz w README katalogu (`packages/app/public/*/README.md`): tytuł, autor z linkiem, źródło, licencja z linkiem, opis zmian („uproszczony, kolory sprowadzone do palety”);
  - ekran „Autorzy” w menu tytułowym i pauzy czyta listę z jednego pliku danych (`credits`), żeby README i ekran się nie rozjechały; test sprawdza, że każdy plik CC-BY w `public` ma wpis;
  - teksty ekranu przez katalogi i18n (ADR-0056), nazwy autorów i tytuły zostają oryginalne.
- **Źródła:** surowe pliki nie trafiają do repo. `tools/assets/sources.json` dostaje URL pobrania, sha256, autora, licencję i link do strony modelu, a `tools/assets/fetch.mjs` je pobiera (ADR-0058).
- **Dopasowanie do stylu NPR:** tak jak paczki z ADR-0058, modele przechodzą przez `tools/city_kit.py` (albo bliźniacze wejście):
  - kolory z tekstur uśrednione na trójkąt i sprowadzone do palety kitu (ADR-0022); emisja zostaje jako świecenie przez glow;
  - uproszczenie siatki do budżetu: rekwizyt do ok. 1,5 tys. trójkątów, budynek do ok. 8 tys., panorama w kilku LOD-ach;
  - wynik to małe GLB w `packages/app/public/` z kluczem, frontem na +Z, w metrach i z `extras.size`, bez tekstur.
- **Przeznaczenie:**
  1. `electric_pole` i `robotic_animal`: rekwizyty ulic (słupy z kablami nad bocznymi ulicami Podzamcza i Nabrzeża, robopies przy straganach i bramach), pieczone do siatek bloków jak w ADR-0058.
  2. `sci-fi_megacity_cluster`: megawieże na horyzoncie poza danymi Lublina (pierścień panoramy, ADR-0051), tylko daleki LOD, jedna wspólna siatka.
  3. `futuristic_compact_room`: wnętrze kapsułowego mieszkania (kryjówka Seki albo pokój do wynajęcia), z obszarem `INTERIORS` i autozapisem przy wejściu (ADR-0061).
  4. `cyberpunk_building` i `hw_4_cyberpunk_sci-fi_building`: nowe budynki w miejscach, gdzie Lublin 2077 celowo odchodzi od dzisiejszego miasta, np. Alchemia na Placu Ofiar Getta (backlog), po przeglądzie kuratora topografii i z wpisem T-0xx; nigdy w miejsce prawdziwej kamienicy.
- **Etapy (osobne PR-y):** 1) licencje, ekran „Autorzy”, potok i rekwizyty (słup, robopies); 2) panorama megacity; 3) wnętrze kapsuły; 4) budynki (Alchemia).

## Wdrożenie (etap 3, 2.11): pokój kapsułowy przy Jezuickiej
- **Miejsce:** parter kamienicy Jezuicka 14 na Starym Mieście (OSM w66286373, `building=apartments`, 3 kondygnacje), drzwi od ulicy naprzeciw Wieży Trynitarskiej. Wybór z danych: kamienica mieszkalna bez nazwy i bez lokali z OSM, ze ścianą od ulicy prawie równoległą do osi x (wymóg `RoomSite`), co najmniej 5 m głębi, płaskim terenem (1,10–1,20 m) i brukiem przed drzwiami. Pokój jest wycięty w budynku jak klinika i Neon Koi (ADR-0045), bez nowej bryły; fasada wyprostowana na z = −134,5 (T-129 w `docs/topografia.md`).
- **Kryjówka czy pokój:** w backlogu i planach nie ma decyzji o kryjówce Seki, więc to pokój do wynajęcia bez wpływu na fabułę (`interior.capsule`: „Capsule room to let”, „Pokój kapsułowy na wynajem”). Kryjówka (łóżko jako zapis, skrytka) czeka na decyzję użytkownika.
- **Model:** `room-props.glb` (`tools/city_room.py`, `city_kit.py --room`): bez okna-kapsuły za ścianą boczną (w kamienicy wychodziłoby do sąsiada, ADR-0061) i płyt pod podłogą, 14 088 → 5 893 trójkątów (budżet wnętrza 8 000), skala 0,2 (3,66 × 2,75 × 4,41 m), kolory z 19 tekstur sprowadzone do palety, pasy światła i ekrany jako `neon-cyan` bez upraszczania. Plik 318 KiB (z 41 MB), odtwarzalny bajt w bajt.
- **Symulacja:** ściany z drzwiami 1,2 × 2,3 m, sufit 2,8 m, podłoga (próg 0,1 m nad brukiem) i trzy bryły mebli z modelu (kuchnia, wnęka z łóżkiem, skrzynia) w nowym polu `ChunkDef.rooms`, z id od `ROOM_ID_BASE` = 4 000 000 poza alokatorem (jak meble ulicy, ADR-0050). Żadne id treści się nie przesunęło: złoty hash determinizmu i schemat zapisu bez zmian. Obszar `capsule` w `INTERIORS` daje autozapis przy wejściu (ADR-0061).
- **Rysowanie:** `engine/.../rooms/`: powłoka z brył symulacji i model w jednej siatce na materiale kitu (1 wywołanie, 2 z G-buforem), bez cienia księżyca i warstwy glow, z ciepłą lampą jako światłem punktowym; włączona tylko do 45 m od pokoju. Bez pliku meble są z prostopadłościanów.
- **Budżety** (`npr-perf`, gałąź na main 2ff5f5c, wywołania / aktywne siatki): reference 193 / 82, krakowskie-tpp 375 / 164, rynek-tpp 232 / 91, podzamcze-tpp 284 / 114, nabrzeze 236 / 102, phone-low 225 / 148, czyli tyle co po etapie 7 ADR-0058; sceny stoją ponad 100 m od pokoju. Migawka NPR bez zmian.
- **Dalej:** okna wnętrza zgodne z fasadą (uzupełnienie ADR-0061, osobny etap dla wszystkich wnętrz), skrzydło drzwi (dziś otwarty otwór), szyld nad wejściem, decyzja o kryjówce Seki.

## Konsekwencje
- Więcej gotowych modeli w stylu cyberpunk, kosztem obowiązku podpisu; ekran „Autorzy” robi się stałym elementem menu.
- Pliki źródłowe są duże (do 62 MB); do gry trafiają uproszczone wersje bez tekstur, więc rozmiar buildu i budżety (`tools/perf-budgets.json`) pilnują wyniku.
- ADR-0058 zostaje w mocy poza zdaniem „Tylko CC0”, które zastępuje ten ADR.
