# ADR-0076: Modele postaci NPC: obsada nazwanych, pula tła i warianty

Status: Zaakceptowany (7.11, decyzje użytkownika w sekcji „Decyzje użytkownika”). Wynika z prośby użytkownika z 7.11 (backlog, sekcja „Następne”: „Podmiana wszystkich NPC na modele z assetów i różnorodność”). Dotyczy ADR-0058 (assety CC0, etap 8: tłum w pozach), ADR-0063 (licencje, ekran „Autorzy”), ADR-0057 (ekran ładowania i wczytywanie modeli) i ADR-0031 (podział renderera). Stan kodu: `origin/main` b8ffc81. G-474 (czarny Kaito) ma osobny PR na gałęzi `ccr-ec2c4269-ilh8k8-g474`.

## Kontekst

**Jak jest dziś.**
- Obsada to pięć plików VRM w `packages/app/public/models` (próbki VRoid z OpenGameArt, „VRoid Studio CC0 models”), razem 31,3 MiB (rozmiary w MiB):

  | Plik | Źródło | Baza VRoid | Rola w `manifest.json` | Kto go nosi |
  |---|---|---|---|---|
  | `seki.vrm` (6,7) | AvatarSample_D | kobieca (F00) | `heroine` | Seki |
  | `kaito.vrm` (7,7) | Sakurada Fumiriya | męska (M00) | `fixer` | Kaito **i Kurosawa** (`preset: "fixer"`) |
  | `mori.vrm` (5,5) | AvatarSample_F (Vita) | **kobieca** (F00) | `ripperdoc` | Mori (mężczyzna w dialogach) |
  | `civilian.vrm` (6,0) | Sendagaya Shino | kobieca (F00), nastolatka | `civilian` | Ume, Oyaji, Hana, Genzō, Ren, Fumiko, Kenta, Goro, Sachiko, sprzedawcy, przechodnie z symulacji |
  | `ganger.vrm` (5,4) | Base_Male | męska (M00) | `ganger` | Hebi i ochrona Tessen (`corpo`) |

- Renderer wybiera model tylko z rodzaju widoku: `ViewDescriptor` NPC ma `preset: "fixer" | "civilian" | "ripperdoc"`, wróg `preset: "ganger" | "corpo"` (`packages/core/src/ports/types.ts`), a `modelKeyOf` w `character-views.ts` mapuje to na pięć kluczy `CharacterModelKey`. Widok nie wie, kim jest postać, więc babcia Ume, Oyaji i Ren to ta sama dziewczyna.
- Tłum chodników (`kind: "crowd"`, ADR-0041) i postacie w pozach (ADR-0058 etap 8) są proceduralne albo pieczone do siatki bloku; mają już deterministyczny wygląd z ziarna (`crowd-look.ts`: płeć, wzrost, fryzura, kolory skóry, włosów i ubrań). Tego ADR-u nie dotyczą, poza wspólną paletą.
- Modele VRM są wczytywane raz na plik (`ModelLibrary`), instancje mają własny szkielet i pulę po zwolnieniu (`CharacterModels`). Ekran ładowania wczytuje wszystkie pliki manifestu (`preload`, ADR-0057). Retarget (`model-rig.ts`) zna nazwy kości VRoid, Mixamo i Blendera; spring bones czyta z rozszerzenia VRM (`vrm-meta.ts`). Odcień ubrań z przebrania (ADR-0036) przemalowuje materiały `Tops` i `Bottoms` (`loadout.ts`).
- Budżet `e2e/models.spec.ts`: 495 wywołań rysowania przy 12 ubranych postaciach (pomiar 480 i 483).
- Pamięć: plik VRM to 5,4–7,7 MB, z czego PNG 3,9–5,0 MB. Po zdekodowaniu tekstury jednego modelu zajmują ok. 60–71 MiB pamięci GPU (RGBA8 z mipmapami, liczone z wymiarów tekstur w plikach, 7.11), z czego ok. jedną trzecią biorą mapy normalnych, których shader toon nie czyta. Pięć modeli to ok. 330 MiB.

**Kto jest kim w dialogach** (`packages/narrative/ink/en`, obsada głosów w ADR-0060):

| Postać | Płeć | Wiek i wygląd z tekstu | Gdzie stoi | Dziś |
|---|---|---|---|---|
| Kaito | M | dorosły, „weathered” (głos), fixer w barze Neon Koi | Neon Koi | `kaito.vrm` |
| Mori | M | dorosły, ripperdoc („he”, „Mori's chair”) | klinika | `mori.vrm` (kobieta) |
| Ume | K | stara („Grandma Ume”, „at my age the night's too long”) | ulica przy Koi | `civilian.vrm` |
| Hana | K | młoda, handlarka części z wózka, zleceniodawczyni | targ | `civilian.vrm` |
| Genzō | M | starszy, przewoźnik łodzi na Bystrzycy (głos „Gravel Midnight”) | doki | `civilian.vrm` |
| Ren Odagiri | M | młody („Hebi boy”, „skinny boy”), tatuaż węża Hebi na karku, nieogolony | dach Alchemii | `civilian.vrm` |
| Kurosawa | M | dorosły, człowiek Kagami, chłodny | za Alchemią | `kaito.vrm` |
| Fumiko | K | dorosła, prowadzi ramen 16–4 | Alchemia | `civilian.vrm` |
| Kenta | M | dorosły, smaży okonomiyaki | Alchemia | `civilian.vrm` |
| Goro | M | starszy (30 lat handlu obok Oyajiego), parasole | Alchemia | `civilian.vrm` |
| Oyaji | M | stary („the old man”, 30 lat na targu), naprawia | targ | `civilian.vrm` |
| Sachiko | K | dorosła albo starsza („sweetheart”), kiosk z gazetami | Alchemia | `civilian.vrm` |

W ink mówią też postacie drugiego planu z kilkoma kwestiami: Tetsu, Hideo, Sabu, Mei, Hina, Takumi, Shiro, Tomo, Nobu, Koji, Daigo, Yuki, Riko, Kiku i strażnicy Tessen.

## Inwentarz modeli postaci

Pliki z paczek leżą poza repo (scratchpad sesji, `tools/assets/fetch.mjs` pobiera je ponownie); sprawdzone skryptem bez wykonywania ich treści.

| Źródło | Licencja | Co zawiera | Szkielet i animacje | Rozmiar i trójkąty | Uwagi |
|---|---|---|---|---|---|
| VRoid Studio CC0 models (OpenGameArt, użyte 5) | VRoid Hub 1.0 w metadanych, strona OGA: CC0 | AvatarSample_D, F, Sakurada Fumiriya, Sendagaya Shino, Base_Male | VRM 0.x, kości `J_Bip_*`, spring bones, bez animacji (retarget z riga) | 5,4–7,7 MB po `shrink_glb`, 15–40 tys. tr. | styl anime jak Seki; dziś w grze |
| VRoid Studio CC0 models, **jeszcze nieużyte** | jak wyżej | AvatarSample_D_Darkness (17,2 MB zip), AvatarSample_E (15 MB), AvatarSample_G (12,2 MB), Base_Female (13,1 MB), HairSample_Female (14,3 MB), HairSample_Male (15,5 MB) | jak wyżej | po `shrink_glb` ok. 5–8 MB każdy | sześć dalszych twarzy w stylu obsady; większość to młode postacie anime, brak starszych |
| Quaternius Ultimate Modular Men (`quaternius-modular-men`) | CC0 (`License.txt`) | 11 postaci: Adventurer, Beach, Casual_2, Casual_Hoodie, Farmer, King, Punk, Spacesuit, Suit, Swat, Worker | glTF, 62 kości (`Hips`, `UpperArm.L`…), 24 animacje (Idle, Walk, Run, Death, Gun_Shoot, Punch, Interact, Wave…) | 2,9–3,7 MB glTF z base64 (ok. 2,2–2,8 MB jako GLB), 5,2–11,1 tys. tr. | bez tekstur: 5–11 materiałów o płaskich kolorach (Skin, Hair, Suit…), więc warianty to zmiana koloru materiału; COLOR_0 biały |
| Quaternius Ultimate Modular Women (`quaternius-modular-women`) | CC0 | 10 postaci: Adventurer, Casual, Formal, Medieval, Punk, SciFi, Soldier, Suit, Witch, Worker | jak wyżej | 3,0–3,3 MB glTF, 6,1–8,0 tys. tr. | jak wyżej |
| Quaternius Zombie Apocalypse (`quaternius-zombie-kit`, w `sources.json`) | CC0 | ocaleni Lis (K), Matt, Sam, Shaun (M), wersje z jedną bronią; zombie, pies, mops | glTF, 43 kości, 20 animacji | 1,7–2,9 MB, 8,9–28 tys. tr. | jedna tekstura atlasu na postać; styl low-poly |
| Quaternius Cyberpunk Game Kit (`sources.json`) | CC0 | jeden bohater, roboty-wrogowie | 25 kości, 22 animacje | 1,5 MB, 7,5 tys. tr. | bohater w stroju sci-fi, roboty jako tło |
| Quaternius Background Posed Humans (w grze, ADR-0058 etap 8) | CC0 | mężczyzna i kobieta w pozach, fryzury | bez szkieletu (OBJ) | 1,1 tys. tr. | tylko tło nieruchome, zostaje |
| Paczki użytkownika (`assets2`, Sketchfab, CC-BY 4.0, ADR-0063) | CC-BY 4.0 | rekwizyty, `cyberpunk_robot` | — | — | brak postaci ludzkich |
| Quaternius, do pobrania: Ultimate Animated Character Pack, Animated Men/Women Pack, Universal Animation Library | CC0 (strony paczek, 7.11) | 52 postacie / po 4 / 120+ animacji na wspólnym szkielecie | FBX, OBJ, Blend (glTF tylko w części paczek) | — | potrzebny konwerter FBX→glTF w `tools` (Blender) |
| Kenney Animated Characters (Protagonists, Retro…) | CC0 (strona paczki, 7.11) | postacie blokowe ze skórkami | wspólny szkielet | małe | styl blokowy, za daleko od obsady |

Inne źródła odpadają: modele z VRoid Hub z innymi warunkami niż próbki (każdy model ma własną licencję, często bez redystrybucji), Mixamo (licencja Adobe zakazuje redystrybucji samych modeli), CC-BY-SA i NC (ADR-0063).

**Wniosek.** W stylu obecnej obsady (anime, VRoid) zostało sześć nieużytych próbek, za mało na 12 nazwanych postaci, a starszych (Ume, Oyaji, Goro, Genzō) wśród nich nie ma. Quaternius daje 21 riggowanych postaci CC0 z animacjami, lekkich (5–11 tys. trójkątów, bez tekstur, więc ułamek pamięci GPU modelu VRoid), ale w innym stylu (stylizowane low-poly, płaskie kolory zamiast rysunku anime). Trzecia droga to postacie zrobione w VRoid Studio na bazach Base_Male i Base_Female: prawa do wyniku ma według warunków VRoid Studio jego autor, więc nie trzeba licencji z zewnątrz, ale wymaga pracy ręcznej w programie z interfejsem graficznym.

## Decyzje użytkownika (7.11)
Nadrzędny cel: **maksymalna różnorodność** postaci przy jednym, spójnym stylu.
1. **Postacie nazwane: spójny styl VRoid.** Bez mieszania z low-poly w jednej scenie. Teraz A (próbki VRoid: sześć nieużytych i obecne, z wariantami), a B (postacie z VRoid Studio) wchodzi plik po pliku, gdy takie pliki się pojawią; manifest obsady przyjmie je bez zmian w kodzie.
2. **Pula tła: warianty obecnych modeli albo inne modele.** Etap 2 robi warianty VRoid; inne źródła (w tym nowe próbki VRoid, a Quaternius tylko tam, gdzie nie psuje spójności, np. na telefonie po pomiarze) są dozwolone w etapie 4.
3. **Mori: poprawić** w etapie 2 na model męski (baza M00) z fartuchem i okularami.
4. **Kurosawa: osobny model** w etapie 3 (do tego czasu wariant zapasowy różny od Kaito).
5. **Rozmiar: zgoda** na obsadę do 80 MiB i wczytywanie postaci w tle.
6. **Drugi plan: wszyscy dostają własny wygląd.** Każda postać z ink (Tetsu, Mei, Shiro i inne) ma własny wpis w `cast`: osobny plik, gdy jest dostępny, inaczej unikalna, stała kombinacja bazy, fryzury, kolorów, tekstur ubrań i akcesoriów, której nie dzieli z nikim innym. Test pilnuje, że żadne dwie postacie nazwane nie mają tego samego wyglądu.
7. **Wiek i sylwetka (7.11, druga tura):** obecna obsada wciąż jest za mało różnorodna, np. babcia Ume to młoda dziewczyna. Postacie starsze (Ume, Oyaji, Goro, Genzō i inne starsze według dialogów) mają wyglądać na swój wiek: siwe albo przerzedzone włosy, przygarbiona postawa, inne proporcje (niższe, cięższe albo szczuplejsze sylwetki przez skalę kości), ubrania stosowne do wieku. Jeśli warianty nie wystarczą, wolno zaciągnąć więcej modeli (najpierw nieużyte próbki VRoid CC0 i inne pliki VRM z licencją pozwalającą na użycie w grze, w spójnym stylu), z wpisem licencji w README i „Autorach”.
8. **Wyższe limity wywołań dla postaci (7.11):** użytkownik zgadza się na wyższe budżety wywołań rysowania i siatek dla scen z postaciami (`models.spec`, sceny z obsadą), jeśli różnorodność tego wymaga. Każde podniesienie z pomiarem przed i po w commicie i wpisem w ADR-0046 (decyzja użytkownika jako uzasadnienie).
9. **Tłum z modelami w pobliżu kamery (7.11):** mieszkańcy tłumu (ADR-0041, figury z 11 brył w jednej siatce) bliżej kamery niż ok. 15–20 m zamieniają się na modele VRoid z wariantami (LOD), dalsi zostają figurami; limit modeli tłumu naraz (np. 8 na komputerze, 4 na telefonie) i budżety rysowania; osobny etap po etapie 4.

## Decyzja

### 1. Tożsamość postaci w widoku (zmiana kontraktu, Architekt)
- `ViewDescriptor` NPC i wroga dostaje dwa opcjonalne pola: `cast?: CastKey` (klucz postaci nazwanej, np. `"ume"`, `"kurosawa"`; typ w `core`, lista z treści) i `look?: number` (ziarno wyglądu postaci tła). `preset` zostaje jako rola zachowania i zapasowy wygląd.
- Symulacja wypełnia `cast` z klucza spawnu postaci nazwanej (`ActorDef.spawn.key`) przez tabelę w treści `sim`, a `look` z hasha klucza spawnu (postacie treści) albo z ziarna mieszkańca (przechodnie symulacji), więc jest stały między zapisami; bez `Math.random`. Zapis gry, symulacja i złote hashe bez zmian: to pole widoku, nie stan.
- Renderer: `modelKeyOf` wybiera model po `cast`, potem po puli dla roli i `look`, na końcu po `preset`.

### 2. Manifest obsady
- `manifest.json` dostaje sekcje `cast` (klucz postaci → plik, skala, wariant) i `pools` (rola tła → lista plików z wagami): `civilian`, `vendor`, `ganger`, `corpo`. Stare klucze (`heroine`, `fixer`, `civilian`, `ripperdoc`, `ganger`) zostają jako zapas, więc brak pliku zostawia dzisiejszy wygląd. `parseModelManifest` odrzuca nieznane klucze jak dziś.
- Postacie drugiego planu z ink (Tetsu, Mei, Shiro…) biorą model z puli swojej roli ze stałym `look` z klucza, więc wyglądają zawsze tak samo, choć nie mają własnego pliku.

### 3. Warianty z jednego modelu
- **VRoid:** modele na tej samej bazie (F00 albo M00) mają ten sam układ UV ubrań (`*_Tops_01`, `*_Bottoms_01`, `*_Shoes_01`, tekstury Seki i Kaito różnią się tylko kolorem), więc wariant to: odcień tekstury ubrań (ścieżka `tint` z `loadout.ts`, dziś dla przebrań), odcień włosów (materiały `HAIR` mają kolor bazowy mnożony przez szarą teksturę: wystarczy zmienić kolor), odcień skóry (mnożnik na materiałach `SKIN`) i podmiana tekstury góry albo spodni na teksturę innego modelu tej samej bazy.
- **Quaternius:** materiały są płaskimi kolorami z nazwami (`Skin`, `Hair`, `Eyebrows`, `Suit`, `Tie`, `Worker_Vest`, `Purple`, `LightBlue`…), więc wariant to tabela nazwa materiału → rola (skóra, włosy, góra, dół, buty) → paleta, spisana raz na plik. Kolory bazowe w plikach są liniowe i bardzo ciemne (np. `Suit` 0,02): loader musi je przeliczyć do przestrzeni, w której shader toon czyta kolor, inaczej wróci czarna sylwetka jak w G-474. Test z G-474 (`model-cast-colours.test.ts`) obejmie nowe pliki.
- **Akcesoria:** doczepki na kościach głowy i klatki jak w `garment-addons.ts` (dziś wizjer, hełm i płyta kamizelki z ADR-0036), z nowymi prostymi bryłami (okulary, czapka, torba, maska), wybierane z `look`.
- **Determinizm:** wariant liczy renderer z `look` (jak `crowdLook`, mulberry32, bez innych źródeł losowości). Palety skóry, włosów i ubrań wspólne z `crowd-look.ts`, żeby tło i tłum pasowały do siebie.
- **Koszt:** odcień to osobny materiał toon na wariant (klucz w pamięci podręcznej materiałów), więc wywołania rysowania się nie zmieniają, a liczba materiałów i shaderów rośnie z liczbą wariantów na ekranie. Limit: 4 warianty na plik naraz w kadrze, dalsze postacie dzielą najbliższy.

### 4. Pamięć i rozmiar (telefon)
- Ładowanie: ekran ładowania wczytuje tylko obsadę startu (Seki i postacie w promieniu dzielnicy startu); reszta w tle przy wejściu w promień 120 m od postaci (strumień jak miasto), a zwolniona pula po wyjściu z dzielnicy. Do czasu wczytania postać stoi w modelu zapasowym roli, bez przerwy w grze.
- Pamięć GPU (pomiar etapu 1, `model-textures.test.ts`: RGBA8 z mipmapami z wymiarów tekstur w plikach): plik VRoid zajmuje 42–47 MiB, pięć plików 221 MiB. Materiały VRoid są `KHR_materials_unlit`, więc Babylon dekoduje z nich tylko kolor bazowy: mapy normalnych, matcapy, emisja i miniatura nigdy nie trafiają do GPU, a szacunek „−1/3 po zwolnieniu normalnych” był błędny. Loader zwalnia tylko teksturę ukrytej warstwy oczu (`EyeExtra`): −7,4 MiB na pięć plików, −3%. Prawdziwy zysk daje dopiero zmniejszenie tekstur: tło 512 px zamiast 1024 px (`shrink_glb.py` z osobnym rozmiarem, etap 5, ok. 11–12 MiB na plik), postacie nazwane 1024 px.
- Warianty (etap 2) nie dodają tekstur: odcień to inny kolor bazowy tej samej tekstury, a podmiana góry albo spodni bierze teksturę z już wczytanego pliku tej samej bazy.
- Limity naraz, przeliczone z pomiaru (ok. 45 MiB na plik VRoid 1024 px): komputer do 11 różnych plików VRoid w pamięci (ok. 500 MiB tekstur postaci), telefon (`low`) do 5 (ok. 225 MiB); po etapie 5 telefon zmieści w tym samym budżecie 3 pliki nazwane 1024 px i 8 plików tła 512 px. Pliki Quaterniusa (bez tekstur, ok. 2 MiB na plik) dowolnie wiele. Ponad limit najdawniej użyty plik bez instancji na scenie jest zwalniany.
- Rozmiar paczki: każdy nowy VRoid ok. 5–8 MB, Quaternius szacunkowo 0,6–1 MB jako GLB po wycięciu zbędnych animacji (do sprawdzenia w etapie 4). Cel: obsada razem do 80 MiB (dziś 31,3 MiB). `shrink_glb.py` dostaje usuwanie COLOR_0 z VRM (G-474: zbędne 0,5 MB w `kaito.vrm`) i nieużywanych obrazów (miniatura `Thumbnail` 0,8 MB na plik).

### 5. Wywołania rysowania i siatki
- Bramka `npr-perf` i `models.spec` bez podnoszenia budżetów: model VRoid to 10–15 wywołań (materiał na wywołanie po scaleniu prymitywów), Quaternius 4–11. Pula tła z Quaterniusa obniża koszt sceny z wieloma sprzedawcami; postacie nazwane z VRoid kosztują jak dziś.
- Retarget: aliasy kości Quaterniusa (`Wrist.L` jako dłoń, `UpperLeg.L`, `LowerLeg.L`) dopisane w `model-rig.ts` z testem na pliku; animacje z pliku nie są odtwarzane (rig gry jest źródłem ruchu, jak dla VRM).
- Spring bones tylko dla VRM; Quaternius bez wtórnego ruchu.

### 6. Licencje
- Każdy nowy plik: wiersz w `models/README.md` (plik, źródło z linkiem, autor, licencja, zmiany), źródło z sha256 w `tools/assets/sources.json` i wpis na ekranie „Autorzy” (`packages/ui/src/credits/credits.ts`, sekcja `characters`); test `credits.test.ts` pilnuje, że każdy plik w `public/models` ma wpis.
- Próbki VRoid zostają pod licencją `VRoid-Hub-1.0` (metadane plików), z odnośnikiem do strony OGA (CC0) i warunków VRoid; postacie z VRoid Studio zrobione przez użytkownika: licencja użytkownika zapisana w metadanych VRM i README.
- Nowe pliki obsady (etapy 3a i 3), wszystkie z paczki „VRoid Studio CC0 models” (https://opengameart.org/content/vroid-studio-cc0-models, autor VRoidプロジェクト, strona: CC0), metadane VRM: `licenseName` CC0, `allowedUserName` Everyone, `commercialUssageName` Allow, `otherLicenseUrl` VRoid Hub license v1 z `modification=allow`, `redistribution=allow`, `credit=unnecessary`:

  | Plik | Próbka | Zip (sha256 w `tools/assets/sources.json`) | Kto nosi |
  |---|---|---|---|
  | `base-female.vrm` | Base_Female | `base_female.zip` (`bf2717cf…`) | Ume, Kiku, Sachiko |
  | `kurosawa.vrm` | HairSample_Male | `hairsample_male.zip` (`ba874402…`) | Kurosawa |

## Etapy (osobne PR-y)
0. **G-474** (osobny PR, gotowy): loader zdejmuje kolory wierzchołków z VRM, test na każdym pliku manifestu.
1. **Kontrakt i manifest:** `cast` i `look` w `ViewDescriptor`, tabela obsady w `sim`, sekcje `cast` i `pools` w manifeście, zapas na dzisiejsze klucze; pomiar pamięci GPU i budżetów przed zmianą modeli; zwalnianie nieczytanych tekstur. Bez nowych plików.
2. **Warianty:** odcienie skóry, włosów i ubrań z `look` na obecnych pięciu modelach i akcesoria; od razu różni sprzedawcy i przechodnie. Migawka NPR świadomie.
3. **Postacie nazwane:** pliki według wyboru użytkownika (pytanie 1), po jednym albo dwóch na PR, ze zrzutami z dialogu i z ulicy.
4. **Pula tła:** cywile, sprzedawcy tła, gangerzy Hebi, ochrona Tessen, wczytywanie w tle według dzielnic, limity na telefonie.
3a. **Wiek i sylwetka (decyzja 7):** zanim przyjdą nowe pliki postaci nazwanych, warianty wieku na obecnych i nowych plikach (siwe włosy, postawa, proporcje kości, ubrania); od razu Ume, Oyaji, Goro, Genzō i starsi z drugiego planu; zaciągnięcie dodatkowych modeli VRM, jeśli warianty nie wystarczą; budżety postaci wyższe zgodnie z decyzją 8.
5. **Porządki:** `shrink_glb.py` (COLOR_0, miniatury, tekstury 512 px tła), pomiar rozmiaru paczki i pamięci na telefonie.
6. **Tłum z modelami w pobliżu (decyzja 9):** podmiana mieszkańców tłumu bliżej niż ok. 15–20 m na modele VRoid z wariantami (LOD), limity naraz na komputerze i telefonie, płynne przejście figura ↔ model, budżety rysowania z pomiarem.

## Pytania do użytkownika
1. **Skąd modele postaci nazwanych?**
   - A: tylko próbki VRoid (sześć nieużytych + obecne), z wariantami kolorów i fryzur; spójny styl, ale starsze postacie (Ume, Oyaji, Goro, Genzō) dalej wyglądają młodo.
   - B: postacie zrobione w VRoid Studio na bazach Base_Male i Base_Female, według opisów z dialogów (wiek, sylwetka, ubiór); spójny styl i zgodność z opisami, wymaga pracy w programie (użytkownik albo osoba z zewnątrz) i zgody na licencję autora.
   - C: mieszane źródła (VRoid dla głównych: Kaito, Mori, Ren, Hana, Kurosawa; Quaternius dla sprzedawców: Ume, Oyaji, Goro, Sachiko, Fumiko, Kenta, Genzō), bliżej opisów wiekiem i ubiorem, kosztem dwóch stylów w jednej scenie (anime obok low-poly).
   - Propozycja: B dla dwunastu nazwanych, A jako zapas do czasu, aż będą gotowe.
2. **Pula tła:** A: warianty pięciu obecnych modeli VRoid (spójnie, cięższe na telefonie); B: Quaternius Modular Men/Women z paletą (lżejsze, inny styl); C: VRoid na komputerze, Quaternius na telefonie. Propozycja: A w etapie 2, decyzja o B po pomiarze w etapie 1.
3. **Mori jako mężczyzna:** dziś nosi model kobiety (AvatarSample_F). Zmienić od razu w etapie 2 na wariant `ganger.vrm` (Base_Male) w fartuchu i okularach, czy czekać na etap 3?
4. **Kurosawa** dzieli dziś model z Kaito: osobny model w etapie 3 czy wariant `kaito.vrm` (inne kolory, garnitur) już w etapie 2?
5. **Rozmiar gry:** zgoda na obsadę do 80 MiB (dziś 31,3 MiB) i wczytywanie postaci w tle, czy trzymać się dzisiejszego rozmiaru (warianty zamiast nowych plików)?
6. **Postacie drugiego planu** (Tetsu, Mei, Shiro i inne): stały wariant z puli wystarczy, czy któraś ma dostać własny model?

## Konsekwencje
- Zmiana kontraktu `ViewDescriptor` (dwa pola opcjonalne) wymaga zgody Architekta; symulacja, zapis i złote hashe bez zmian.
- Więcej materiałów toon (warianty) i plików do wczytania; budżety pilnują wywołań i siatek, pamięć mierzy nowy pomiar w `npr-perf` (liczba i rozmiar tekstur).
- Migawka NPR zmienia się w etapach 2–4; każda zmiana obejrzana i opisana w commicie.
- Każdy nowy model przechodzi test z G-474 (kolor bazowy nie czarny, tekstura, bez koloru wierzchołków na VRM).

## Z budowy etapu 2 (7.11)
- **Wariant to numer.** `variantOf(n, dress?)` (`model-variant.ts`, mulberry32 z palet `crowd-look.ts`): 0 to plik bez zmian, 1–16 tło (z `look` przez osobny mieszacz niż wybór pliku z puli), postacie nazwane od 100 w manifeście, z ręcznymi zmianami `dress` (skóra, włosy, góra, dół, pożyczona góra albo dół, akcesoria). Numer i `dress` są częścią wpisu obsady, więc wygląd postaci nazwanej jest stały i niezależny od tego, kto stoi obok.
- **Materiały, nie tekstury.** Skóra: mnożnik koloru bazowego (paleta podzielona przez jasną skórę VRoid), włosy i ubrania: ścieżka TINT z przebrań (jasność tekstury, odcień z palety), brwi za włosami. Materiały są w pamięci podręcznej toon po kolorze i teksturze, więc dwie postacie w jednym wariancie dzielą je, a wywołania rysowania się nie zmieniają. Przy powrocie instancji do puli wariant schodzi.
- **Podmiana góry albo dołu** tylko między osobnymi `Tops`/`Bottoms` tej samej bazy (`F00_001`, `M00_001`: wspólny układ UV). Sukienka jednoczęściowa (`mori.vrm`, `Onepiece`) nie bierze cudzej tekstury i jej nie pożycza, a kurtki Seki nikt nie nosi. Dziś realnie: Base_Male i Kaito wymieniają się górą i spodniami, Shino może nosić spodnie Seki.
- **Akcesoria** (okulary jako oprawki, czapka, maska, plecak): proste bryły na kotwicach kości głowy i klatki jak `garment-addons.ts`, wszystkie jednej kości scalone w jedną siatkę z kolorami wierzchołków (`charVertexColor`), bez cienia. Wariant tła losuje akcesoria jednej kości, więc postać tła kosztuje najwyżej jedną siatkę więcej; postacie nazwane mogą mieć dwie (Mori: okulary i fartuch).
- **Fartuch** (runda 2 przeglądu): pierwsza wersja, płyta przed kością klatki, wyglądała jak trzymana tablica i wchodziła siedzącym w uda. Teraz to powłoka ubrania (`model-apron.ts`): przednie trójkąty góry i spodni od klatki do krocza, węższe niż barki, odsunięte o 1,2 cm wzdłuż normalnych, na szkielecie ubrania. Leży na ciele i gnie się z nim. Krawędzie boczne są schodkowe (całe trójkąty), a między nogami fartuch nie wisi, bo kopiuje ubranie.
- **Limit 4 wariantów tła na plik** (`VariantBudget`): liczony na postaciach ubranych w scenie (bez rozróżnienia kadru), piąta postać bierze najbliższy numerem. Postacie nazwane go nie liczą: każda ma swój wariant.
- **Obsada:** 32 wpisy, każdy z unikalną parą plik + wariant (test w `model-manifest.test.ts`, lista wyjątków pusta) i unikalnym wyglądem w swoim pliku. Mori na `ganger.vrm` (Base_Male) w okularach i białym fartuchu (decyzja 3), Kurosawa na `kaito.vrm` z czarnymi włosami, ciemnym garniturem i okularami (decyzja 4, test: włosy, góra i dół inne niż u Kaito). Zwolniony `mori.vrm` (AvatarSample_F) noszą Hana, Sachiko, Hina, Kiku i część tła. Nowe postacie: barman, dwaj bywalcy Koi, salaryman, strażnik z mewą, Mika (każda eskorta, po przyrostku klucza kontraktu `-escort`).
- **Pule:** przechodnie i sprzedawcy tła z czterech plików (`civilian.vrm` i `ganger.vrm` z wagą 2, `mori.vrm` i `kaito.vrm` 1), gangerzy z `ganger.vrm` i `kaito.vrm`, ochrona Tessen z `ganger.vrm`. Plików do wczytania nadal pięć.
- **Shader:** w ścieżce TINT wycięty teksel (ALPHATEST) bierze odcień zamiast klucza magenty; inaczej podłoga jasności TINT dawała magentową obwódkę na włosach w odcieniu.
- **Laska i spódnica w aktywnościach** (przegląd PR #395): `CharacterActivities` zapisuje w rigu aktywności pozy (`rig.doing`). Laska jest tylko przy chodzie i staniu (bez aktywności albo `idle`); przy miotle, rozmowie, jedzeniu i reszcie jest schowana, bo dłoń podnosiła ją nad ziemię. Spódnica jest schowana przy `sit` i `sleep` (sztywny dzwon schodził pod podłogę, kolana z niego wychodziły). Obie znikają po śmierci, w ogłuszeniu i na ramieniu niosącego. Test na chód i każdą aktywność (`model-figure-ume.test.ts`).
- **Pomiar** (`e2e/models.spec.ts`, nowa gra w klinice, 12 ubranych postaci): main b72305c → gałąź, wywołania rysowania / aktywne siatki: 451 / 151 → 445 / 151 (gałąź dwa razy to samo). Akcesoria dokładają siatki (Mori dwie, barman jedna, część przechodniów jedna), ale Mori i część tła stoją teraz na Base_Male, który ma mniej materiałów niż modele kobiece. Budżet 495 bez zmian. Na main dwa z trzech przebiegów zmierzyły klatkę bez aktywnych siatek (324 / 0): pomiar `models.spec` bywa niestabilny niezależnie od tej zmiany. Migawka NPR i sceny `npr-perf` są bez modeli (`models=off`, rig proceduralny w kadrze odniesienia), więc wariantów nie widzą: bez zmian.
- **Zostaje:** twarze i fryzury to wciąż pięć plików (postacie nazwane z jednego pliku różnią się kolorami, ubraniem i akcesoriami, nie twarzą), starsi wyglądają młodo mimo siwych włosów: to etap 3. Budżet wariantów nie patrzy na kadr, tylko na scenę. Akcesoria są sztywne (fartuch nie gnie się z nogami). Wygląd ciał po wczytaniu gry to G-487 (osobno).

## Z budowy etapu 3a (8.11): wiek i sylwetka
**Wiek i płeć z dialogów** (`packages/narrative/ink/en`, komentarze scen i narracja; „starszy” to około 55–65 lat, „stary” powyżej):

| Postać | Płeć | Wiek z tekstu | Skąd | Wygląd w etapie 3a |
|---|---|---|---|---|
| Ume | K | stara | „Grandma Ume”, „at my age the night's too long” | `base-female.vrm` (nowy), skala 0,86, siwe włosy zaczesane do tyłu, chusta na ramionach, długa spódnica, laska, kokarda w kolorze swetra, pochylenie 0,55, szczuplejsza (0,94), krótki krok (0,55) |
| Oyaji | M | stary | „the old man” w hakach, 30 lat na targu (Goro) | `kaito.vrm` 0,95, siwe włosy, okulary, kamizelka na jasnej koszuli, pochylenie 0,4, szczupły (0,92), krok 0,65 |
| Goro | M | starszy | „Thirty years we've traded side by side” | `ganger.vrm` 1,0, szpakowaty, okulary, pochylenie 0,25, cięższy (1,15), krok 0,75 |
| Genzō | M | starszy | przewoźnik nocą, głos „Gravel Midnight” (ADR-0060) | `ganger.vrm` 1,03, siwy, czapka, kamizelka, pochylenie 0,2, krępy (1,12), krok 0,8 |
| Sabu | M | stary | „Old Sabu”, „an old man sits on a crate” | `ganger.vrm` 0,96, białe włosy, czapka, pochylenie 0,5, chudy (0,9), krok 0,6 |
| Kiku | K | starsza | „Sit down, child”, wróżka w chuście z LED | `base-female.vrm` 0,9, szpakowata, chusta na głowie, długa spódnica, pochylenie 0,3, cięższa (1,08), krok 0,75 |
| Sachiko | K | starsza | „sweetheart”, kiosk z gazetami, „Nothing ever changes here” | `base-female.vrm` 0,93, szpakowata, okulary, kamizelka, długa spódnica, pochylenie 0,2, cięższa (1,1), krok 0,8 |
| Nobu | M | starszy | „an older guy with an empty sleeve” | `ganger.vrm` 1,02, szpakowaty, pochylenie 0,15, krok 0,85 |
| Tomo | M | w średnim wieku | „Twenty-two years on the riverside”, żona | `kaito.vrm`, ciemnoszare włosy, cięższy (1,12) |
| Shiro | M | dorosły | „a thin man”, wdowiec po sprzedanych wspomnieniach | bez zmian |
| Daigo | M | dorosły | kurnik na kredyt, „My girl!” | bez zmian |
| Akane | K | dorosła | wdowa od roku, fartuch | bez zmian |
| Tetsu, Hideo, Kenta, Fumiko, Kaito, Kurosawa, Mori | M/K | dorośli | sklep DENKI, urzędnik, kucharze, fixer, Kagami, ripperdoc | bez zmian |
| Hana, Mei, Riko, Ren, Takumi | K/M | młodzi | „boy”, „girl”, „skinny boy” | bez zmian |
| Koji | M | nastolatek | „a boy in a too-big Hebi jacket. His voice cracks”, „send me back to my mom” | skala 1,0 → 0,93 |
| Hina | K | dziecko | „A little girl in a yellow cape” | skala 0,97 → 0,74 |

**Co zrobione.**
- **Sylwetka** (`model-figure.ts`): pole `figure` w `dress` obsady (`stoop`, `build`, `pace`, przycinane do 0–0,7 rad, 0,8–1,25 i 0,4–1). Pochylenie obraca kości kręgosłupa, klatki, górnej klatki i szyi (VRoid `J_Bip_C_*`, Mixamo `Spine*`, `Neck`) wokół prawej osi ciała, w udziałach 0,3 / 0,25 / 0,15 / 0,3. Retarget nie steruje tymi kośćmi, a głowę i ręce ustawia w przestrzeni modelu, więc głowa zostaje wysunięta do przodu i patrzy przed siebie, a ręce wiszą pionowo. `build` skaluje korzeń modelu w szerokości i głębokości (po akcesoriach, żeby ich kotwice miały skalę modelu). `pace` skraca zamach nóg i rąk w chodzie riga (`character-animation.ts`, jeden mnożnik). Wszystko schodzi przy powrocie do puli.
- **Chód:** prędkość postaci liczy symulacja, więc „wolniejszy chód” w widoku to krótszy krok i mniejszy zamach rąk przy tej samej kadencji. Wolniejsze tempo marszu starszych wymagałoby zmiany w `sim` (złote hashe), poza tym etapem.
- **Akcesoria:** chusta na ramiona (stożek otwarty z przodu z dwoma końcami, kotwica klatki), chusta na głowę (czasza z tyłu głowy i ogon na karku), kamizelka (powłoka tułowia z góry ubrania jak fartuch, ale dookoła i bez rękawów, `buildVest` w `model-apron.ts`) laska i długa spódnica. Laska (połowa wysokości kości głowy) wisi z prawej dłoni, ale zostaje pionowa, cokolwiek robi przedramię (gest, zamach kroku): to dziecko korzenia postaci, ustawiane przy dłoni przed każdą klatką; pierwsza wersja trzymana jak broń (`holdInRightHand`) leżała poziomo przy gestach sprzedawcy. Spódnica to dzwon od talii do łydek na ciele riga, nie na kości: nogi stawiają kroki w środku, stopy wystają spod rąbka, a szkolna plisowana spódnica i podkolanówki Base_Female znikają pod nią. Nowe pole `tie` w `dress` barwi krawat albo kokardę (materiały `*_Accessory*`, część `tie`), bo czerwona szkolna kokarda Base_Female mówiła „uczennica”. Każda z tych rzeczy to osobna siatka: Ume ma trzy więcej niż plik bez wariantu (chusta, laska, spódnica), Oyaji i Genzō po dwie (okulary albo czapka i kamizelka).
- **Tło:** co piąty wariant tła 1–16 jest starszy (siwe włosy z własnej palety, pochylenie 0,2–0,45, budowa 0,92–1,06, krok 0,7), z osobnego strumienia losowego, więc kolory i akcesoria pozostałych wariantów się nie zmieniły. Numery postaci nazwanych (od 100) nigdy nie starzeją się z ziarna. Starsze warianty dostają tylko przechodnie i sprzedawcy (pule `civilian` i `vendor`) bez broni; gangerzy i ochrona tych samych numerów są młodzi, a postać z bronią zostaje wyprostowana także z `figure` w manifeście, bo chwyt oburęczny (G-282) liczy się z barków i długości rąk zmierzonych w spoczynku (przegląd PR #395: prawa dłoń 0,055–0,088 m od chwytu u pochylonego gangera).
- **Nowy plik: `base-female.vrm`** (Base_Female z „VRoid Studio CC0 models”, CC0 w metadanych VRM i na stronie OGA): włosy gładko zaczesane do tyłu z wysokim czołem. Po przefarbowaniu na siwo czytają się jako upięte włosy starszej kobiety, czego nie dają długie fryzury pozostałych próbek. Pozostałe sprawdzone próbki: HairSample_Male (młoda, kolczasta fryzura) i HairSample_Female (kocie uszy) się nie nadają, AvatarSample_D_Darkness, E i G to młode dziewczyny z długimi włosami. Plik po `shrink_glb.py` (1024 px, morph tylko mruganie i samogłoski; COLOR_0 nie ma już w oryginale) waży 5,2 MiB. Obsada razem 36,5 MiB (było 31,3), w limicie 80 MiB z decyzji 5. Brwi Base_Female mają ciemnogranatowy kolor bazowy (#07092c, jasność 0,044): test z G-474 przyjmuje dla brwi próg 0,03 zamiast 0,05, bo każda postać na tym pliku dostaje brwi w kolorze włosów.
- **Pomiar** (`e2e/models.spec.ts`, nowa gra w klinice, 12 ubranych postaci): main d6ff3ac → gałąź, wywołania rysowania / aktywne siatki: 448 / 152 → 446 / 152. Budżet 495 bez zmian; decyzja 8 (wyższe limity) nie była potrzebna, więc bez wpisu w ADR-0046. Sceny `npr-perf` są bez modeli (`models=off`): bez zmian.
- **Zostaje:** twarze VRoid są młode i to się nie zmieni bez innych plików (VRoid Studio, decyzja 1 B). Sylwetka, włosy, ubrania i laska przesuwają odbiór wieku, ale z bliska twarz Ume to wciąż twarz anime. Postacie cywilne z modelem dalej trzymają lewą rękę w pozie parasola, choć parasol riga jest ukryty (znalezisko poboczne).

## Z budowy etapu 3 (Kurosawa, 8.11)
- **Plik: `kurosawa.vrm`** z próbki HairSample_Male (licencja w sekcji 6). Z sześciu nieużytych próbek to jedyna męska poza Base_Male (`ganger.vrm`, już Mori, Goro, Genzō i tło): czarnogranatowe, gładkie włosy z grzywką na oczy i wąska, chłodna twarz, inna niż Kaito (Sakurada Fumiriya) i Base_Male. Pozostałe (AvatarSample_D_Darkness, E, G, HairSample_Female z kocimi uszami, Base_Female już w grze) to kobiety. `shrink_glb.py` 1024 px, morph tylko mruganie i samogłoski: 18,9 MB → 6,0 MiB; COLOR_0 nie ma w oryginale. Obsada razem 36,5 → 42,5 MiB (siedem plików, limit 80 MiB z decyzji 5; test w `model-manifest.test.ts` pilnuje limitu). Pamięć GPU tekstur bazowych: 38,7 MiB (13 tekstur), najmniej z obsady.
- **Retarget bez zmian:** szkielet VRoid `J_Bip_*` jak pozostałe próbki, spring bones z rozszerzenia VRM; okulary wiszą na kotwicy głowy. Model rysuje 13 siatek (Kaito 16), z okularami 14 (`model-kurosawa.test.ts`).
- **Wygląd (`dress`, wariant 0):** włosy prawie czarne, ciemnogranatowa góra, czarne spodnie, ciemne oprawki okularów. Wpis obsady nie dzieli pliku z nikim (test: tylko Kurosawa w `cast`, plik poza pulami tła). Kolory nadal inne niż Kaito (test z decyzji 4 zostaje).
- **Krój ubrania (`cut`):** HairSample_Male nosi bluzę z kapturem `M00_006_01_Tops_01_CLOTH`, a Kaito i Base_Male koszule `M00_001`. Podmiana góry (etap 2) sprawdzała tylko bazę (`M00`), więc tło na Base_Male i Kaito dostałoby teksturę bluzy na cudzym UV. `clothOf` zwraca teraz krój góry i dołu (`cuts`, z nazwy materiału `M00_001`), a `lends` pożycza część tylko przy tej samej bazie i tym samym kroju. Spodnie Kurosawy (`M00_001`) wchodzą do puli spodni Base_Male i Kaito, bluza do żadnej. Dowód: `model-kurosawa.test.ts` z `model-library.ts`, `model-dress.ts` i `character-models.ts` z main: Base_Male w bluzie Kurosawy, test pada; z poprawką przechodzi. Tło Base_Male i Kaito z wylosowaną podmianą spodni może teraz trafić na spodnie Kurosawy (lista dawców spodni M00 ma trzy pliki zamiast dwóch): to zmiana wyglądu części tła, nie postaci nazwanych (żadna nie ma `bottomFrom`).
- **Pomiar** (ulica za Alchemią, kamera stała 9 m z boku Kurosawy, 13 ubranych postaci, `jump` do kroku 3 „Lustra”): wywołania rysowania / aktywne siatki: main 387 / 111 → gałąź 390 / 108. `e2e/models.spec.ts` (klinika, bez Kurosawy) zielony w budżecie 495; decyzja 8 niepotrzebna, bez wpisu w ADR-0046. Sceny `npr-perf` są bez modeli (`models=off`): migawka bez zmian.
- **Zostaje:** bluza z kapturem czyta się młodziej niż garnitur, którego Kurosawa (człowiek Kagami) by się spodziewał; ciemny odcień i okulary to przesuwają, ale garnitur da dopiero plik z VRoid Studio (decyzja 1 B) albo próbka M00 z marynarką. Ekran ładowania wczytuje też `kurosawa.vrm` (+6 MiB na starcie), choć Kurosawa stoi dopiero w drugim akcie: wczytywanie w tle według dzielnic to etap 4.
