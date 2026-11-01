# ADR-0058: Żywe miasto: rekwizyty, pojazdy i szyldy z paczek CC0

## Kontekst
Użytkownik chce, żeby nocny Lublin był gęstszy i bardziej kolorowy, z dużo większą liczbą assetów pobranych z internetu. Dziś miasto ma:
- budynki i auta z city kitu (ADR-0022);
- meble uliczne z ADR-0050, w większości proceduralne;
- nadbudowy, kable i reklamy z ADR-0051, też proceduralne.

Rozpoznanie (31.10) pobrało 33 paczki CC0, razem ok. 2 tys. modeli:
- Kenney przez wpisy na OpenGameArt: Roads, Modular Buildings, Retro Urban, Mini Market, Factory, Survival, Food, Train, Industrial, Suburban, Nature, Car Kit;
- Quaternius: Cyberpunk Game Kit, Zombie Apocalypse, Toon Shooter, Sushi Restaurant, Public Transport, Cars, Posed Humans, Modular Men/Women;
- pojedyncze paczki z OpenGameArt: automaty, bankomaty, motorower, billboard, pojazdy;
- decale z ambientCG: graffiti, wlepki, tabliczki.

Modele są low-poly i mają kolory w palecie albo w płaskich materiałach, czyli tak jak obecny kit. Wymagania:
- budżety wywołań rysowania i aktywnych siatek (`tools/perf-budgets.json`);
- telefon;
- migawka NPR;
- determinizm symulacji (ADR-0008).

## Decyzja
- **Tylko CC0.** (Od 31.10 także CC-BY 4.0 z podpisem autora: ADR-0063.)
  - Każde źródło ma w `packages/app/public/city/README.md` wiersz z URL-em pobrania, autorem i cytatem licencji z paczki albo strony.
  - Paczki na innych licencjach (CC-BY, płatne) i modele z cudzym brandingiem odpadają. Wyjątek: napis da się wyciąć, a bierzemy samą geometrię.
  - Zipy źródłowe nie trafiają do repo. `tools/assets/sources.json` trzyma URL i sha256 każdej paczki, a skrypt `tools/assets/fetch.mjs` je pobiera, dzięki czemu wynik da się odtworzyć.
- **Osobny plik `city-props.glb`.**
  - Piecze go `tools/city_kit.py` z nowymi wejściami: `--props` (Kenney GLB z `colormap.png`) i `--quaternius` (glTF z płaskimi materiałami).
  - Paczki z atlasem lub teksturami pikselowymi przechodzą przez uśredniony kolor teksela trójkąta. OBJ/MTL czyta prosty czytnik, a FBX jest wcześniej konwertowany offline do GLB.
  - Paleta próbek jest wspólna z kitem (ADR-0022). Dochodzą role `fabric-teal`, `fabric-magenta`, `fabric-amber` (markizy, noreny, płótna) i `plant`.
  - Każdy model to jedna siatka z kluczem (`pr-*`, `veh-*`), frontem na +Z, w metrach i z `extras.size`.
  - City kit dalej ładuje się pierwszy. Rekwizyty dochodzą po nim i są osobnym etapem ekranu ładowania (ADR-0057).
- **Bez nowych wywołań rysowania.**
  - Rekwizyty piecze się do istniejących siatek:
    - meble i drobiazgi do siatki bloku 256 m (ADR-0050);
    - elementy fasad (klimatyzatory, anteny, markizy, rury, balkony, szyldy) do komórek kitu 64 m i komórek mapcity (ADR-0051);
    - pojazdy do wspólnych siatek ruchu i parkingu.
  - Jedyny wyjątek to drony nad ulicą: jedna wspólna, ruchoma siatka, +1 wywołanie (+2 z G-buforem).
  - Na sztukę do ok. 1,5 tys. trójkątów; cięższe modele upraszczamy albo pomijamy.
  - Drobiazgi (jedzenie, puszki, worki) trafiają tylko do bliskiej siatki bloku i nie pojawiają się na jakości `low`.
- **Rozstawienie w rendererze.**
  - Rekwizyty bez kolizji (drobiazgi, fasady, szyldy, rośliny w donicach przy ścianie) stawia renderer. Robi to deterministycznie, z ziarna pozycji i z danych dzielnicy (`clutter`, rodzaj ulicy), jak meble z ADR-0050. Symulacja i złote hashe się nie zmieniają.
  - Rzeczy, o które gracz może się potknąć lub schować (automaty, lady, kontenery), stoją tylko tam, gdzie `sim` ma już bryłę mebla albo straganu. Nowe bryły w `sim` to osobna zmiana, ze świadomą aktualizacją hasha.
  - Charakter dzielnic:
    - deptak Krakowskie: automaty, bankomaty, donice z bambusem i sakurą, markizy w pasy, szyldy-flagi, ekrany nad barami, skutery i rowery przy krawężniku, budki yatai z norenami i lampionami;
    - targ pod wiaduktem (Podzamcze): lady, palety, beczki, kartony, płócienne zadaszenia, graffiti na filarach;
    - Nabrzeże: kontenery, zbiorniki, wieże ciśnień, rury, ciężarówki;
    - dachy i nadbudowy: klimatyzatory, anteny i czasze, panele, zbiorniki, rusztowania, schody przeciwpożarowe;
    - Rynek i Stare Miasto: oszczędnie, czyli donice, ławki i latarnie, bez neonów i kabli.
- **Szyldy z teksturą** (Quaternius Cyberpunk, Sushi).
  - Obraz szyldu przechodzi do atlasu napisów pod paletą, a UV szyldu wskazuje kafel atlasu. Glow czyta go przez `emissiveTexture` (ADR-0022).
  - Napisy są generyczne, bez prawdziwych marek.
- **Etapy (osobne PR-y), w każdym pomiar budżetów, migawka NPR obejrzana przed commitem i wpis źródeł:**
  1. Potok: `sources.json`, `fetch.mjs`, wejścia `--props` i `--quaternius`, plik `city-props.glb` i jego ładowanie. Pierwsze rekwizyty fasad: klimatyzatory, anteny i czasze, rury, markizy.
  2. Meble deptaka: automaty, bankomaty, hydranty, donice i rośliny, skutery i rowery.
  3. Targ i budki z jedzeniem: lady, stołki, noreny, lampiony, palety, beczki, kartony, płótna, drobiazgi na ladach.
  4. Pojazdy: ciężarówki, śmieciarka, SUV-y, tramwaj lub trolejbus z autobusu, dalekie LOD-y.
  5. Szyldy z teksturą i ekrany na wysięgnikach (atlas).
  6. Decale: graffiti, wlepki, tabliczki, kratki ściekowe.
  7. Drony nad kanionami ulic.
  8. Tłum: statyczne pozy (Posed Humans) na ławkach i w kolejkach. Riggowane Modular Men/Women tylko dla nazwanych NPC, bo bez LOD są za ciężkie na wspólną siatkę tłumu.
  9. **Drzwi automatyczne i rozsuwane** (dodane 31.10): modele skrzydeł, ram, paneli z kodem i podświetlenia zamiast proceduralnych skrzydeł z ADR-0038, dla kliniki, Neon Koi, biura Tessen i kolejnych wnętrz.
     - Źródła CC0, np. `Door` z Quaternius Cyberpunk Game Kit (pobrany, 324 trójkąty) i elementy sci-fi z paczek Kenneya.
     - Warianty: przeszklone dwuskrzydłowe drzwi sklepu, stalowe drzwi pancerne na kod, roleta.
     - Model pasuje do istniejącej bryły kolizji skrzydła, a renderer tylko podmienia wygląd. Ruch dalej idzie przez `updateTransform` z `door-system.ts`, więc symulacja się nie zmienia.
     - Stan zamka widać po kolorze diody panelu (zamknięte, otwarte, wyłamane).
     - Do tego dźwięk otwierania z ADR-0060.

## Konsekwencje
- Miasto będzie gęstsze i bardziej kolorowe bez nowych wywołań rysowania (poza dronami). Rośnie liczba trójkątów i wierzchołków w siatkach bloków i komórek, co mierzy `npr-perf` na scenach Lublina i telefonie.
- Plik rekwizytów to szacunkowo 1–1,5 MB po kwantyzacji. Ekran ładowania pokazuje go jako osobny etap.
- Migawka NPR zmienia się na każdym etapie, świadomie.
- Brakuje w CC0: hulajnóg, trolejbusu i parasoli ogródkowych w lekkiej wersji. Trolejbus powstaje z autobusu i proceduralnych odbieraków, parasole z płótna Survival Kit. Cięższe paczki (Downtown City MegaKit 223 MB, loafbrr Park Furniture 88 MB) są do ręcznego pobrania później.

## Uzupełnienie (etap 9, 1.11): drzwi na fasadach z reguł OSM
Decyzja użytkownika z 1.11 („assety z regułami rozstawienia przed nowymi dzielnicami”) przesunęła etap 9 z samej podmiany skrzydeł drzwi gry na drzwi wszystkich budynków miasta. Podmiana proceduralnych skrzydeł drzwi gry (ADR-0038, klinika, Neon Koi) z diodą zamka zostaje na osobny etap.
- **Rodzaj mebla `door`** (`core/world/city-geo.ts`, poza kontraktami portów): bez bryły w symulacji (ściana za drzwiami już jest bryłą budynku), więc złote hashe się nie zmieniają. `variant` trzyma model w bitach 0–2 i wymiary w bitach 3–15 (`core/world/doors.ts`: szerokość co 5 cm, wysokość co 2 cm, zaokrąglane w górę). Symulacja nie przenosi drzwi na teren (`WORLD_STREET_PROPS`): stopa zostaje na nawierzchni zmierzonej przez import, bo od niej liczona jest wysokość drzwi do okien.
- **Miejsca na ścianie** (`engine/.../mapcity/door-slots.ts`): ten sam układ okien i witryn parteru co shader fasady (`facadeGlass`, z kwantyzacją UV): drzwi stoją w filarze między szybami albo zakrywają całą szybę (drzwi z naświetlem w miejscu okna kamienicy, drzwi sklepu na całą szerokość witryny), nigdy w połowie szyby, pod szyldem lokalu i poniżej okien piętra. Bez drzwi: ściany szczytowe, kościoły, zabytki z własnym modelem, ściany z przejściami gry i przejazdami, druga oś kamienicy, gdzie shader może malować bramę.
- **Reguły** (`tools/osm-import/src/props-doors.ts`, `pnpm osm:props`): 1) węzeł `entrance=*`/`door=*` (`data/osm/points/entrances.json`, `pnpm osm:entrances`) do 1,5 m od narysowanej ściany: drzwi w najbliższym miejscu do 1,5 m wzdłuż ściany; 2) szyld lokalu bez drzwi pod nim: drzwi sklepu (banku: na kod) w zasięgu szyldu, bo OSM ma wejścia dla niewielu budynków (59 węzłów na ok. 300 szyldów); 3) kamienica (`residential`, `historic`) bez drzwi: drzwi klatki na najdłuższej ścianie od ulicy, najbliżej jej środka. Wszystkie: 3 m od drzwi gry i osi przejazdów, otwarty grunt przed drzwiami, nawierzchnia do 0,8 m od parteru i spadek w poprzek do 0,12 m, 1 m przed drzwiami bez brył mebli, 0,6 m między drzwiami.
- **Modele**: skrzydła z E7 paczki 2 (CC-BY: carlcapu9, vanillao03, Jesus Fernandez Garcia) w `door-props.glb`; ościeżnicę, nadproże, próg i naświetle rysuje renderer. Wszystko w siatce bloku mebli: bez nowych wywołań rysowania. Telefon (`low`) ma skrzydła proceduralne.
- **Skan** (`tools/glitch-scan/test/door-pieces.ts`, baza 0): `door-off-wall`, `door-floating`, `door-in-window` (port maski szyb shadera), `door-in-board`, `door-in-passage` (przejazdy i brama kamienicy), `door-on-game-door`.
