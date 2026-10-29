# ADR-0049: Kamera i pole widzenia: 80° w poziomie na każdym ekranie, TPP 2,2 m nisko nad ramieniem

## Kontekst
Gracz zgłasza, że przestrzenie Lublina wyglądają na przepastne. Miasto ma skalę 1:1 (ADR-0042, ADR-0045): postać ma 1,8 m, Krakowskie Przedmieście ma ok. 21 m między fasadami, od Placu Litewskiego do Bramy Krakowskiej jest ok. 470 m. Skali nie ruszamy. Wrażenie potęgowała kamera:

- `BASE_FOV = 1.08` rad pionowo (61,9°) w trybie pionowym Babylona, więc kąt w poziomie rósł z proporcjami ekranu:

  | Ekran | Poziomo | Pionowo |
  |---|---|---|
  | 4:3 | 77,3° | 61,9° |
  | 16:9 | 93,6° | 61,9° |
  | telefon 800×370 (2,16) | 104,7° | 61,9° |
  | 21:9 (3440×1440) | 110,1° | 61,9° |

- Kamera TPP 2,7 m za punktem obrotu, który stał 0,12 m nad oczami (1,74 m przy postaci 1,8 m), czyli prawie nad głową.
- Ustawienie „Pole widzenia” było w stopniach pionowo (50-80°, domyślnie 62), czyli liczbą, której gracze nie znają z innych gier.

## Decyzja

### Pole widzenia w poziomie
- Ustawienie to kąt poziomy w stopniach: suwak „Pole widzenia (poziomo)” w zakładce „Mysz i kamera”, 70-100°, domyślnie 80°.
- `core/math/fov.ts`: `verticalFov(poziomy, proporcje)` daje kąt pionowy dla kamery, `horizontalFovOf` odwrotnie. Babylon zostaje w trybie pionowym (`FOVMODE_VERTICAL_FIXED`), a rig co klatkę przelicza kąt z proporcji silnika (`getAspectRatio`). Nie używamy `FOVMODE_HORIZONTAL_FIXED`, bo zoom celowania (ADR-0019), szybkość obrotu przy zoomie i kalibracja krzyżyka w HUD liczą się od kąta pionowego; jedna liczba pionowa dla wszystkich trzech zostaje prawdą.
- Poziom trzyma się dokładnie dla proporcji od 4:3 do 2,2 (`FOV_ASPECT_RANGE`). Poza zakresem proporcje są przycinane do brzegu:
  - węższy ekran (portret) ma pion jak 4:3, więc nie dostaje rybiego oka w pionie;
  - szerszy (21:9) ma pion jak telefon 2,2, więc zyskuje kilka stopni w poziomie zamiast tracić wysokość. Telefon 800×370 i monitor 21:9 mają prawie te same proporcje (2,16 i 2,39), więc granicę ustawiamy tuż nad telefonami (19,5:9 to 2,17).
- Po zmianie, przy domyślnych 80°:

  | Ekran | Poziomo | Pionowo |
  |---|---|---|
  | 4:3 | 80,0° | 64,4° (1,123 rad) |
  | 16:9 | 80,0° | 50,5° (0,882 rad) |
  | telefon 800×370 | 80,0° | 42,4° (0,740 rad) |
  | 21:9 (3440×1440) | 84,7° | 41,8° (0,729 rad) |

- `BASE_FOV` w engine to teraz pion przy 16:9 (0,882 rad), `DEFAULT_HORIZONTAL_FOV` to 80°. Celowanie zwęża jak dotąd (`aimedFov`, zoom broni), sprint poszerza o 10% kąta zamiast stałych 0,12 rad (przy 0,882 rad to 0,088 rad).
- Kadr referencyjny (`?reference`), tło ekranu tytułowego i jazda metrem używają kąta z biodra kamery gry, a nie stałej z konstruktora. Kamera kadru referencyjnego cofa się o 1,15 m po tej samej linii (`REFERENCE_VIEW`), żeby szyld Neon Koi i Seki zostały w podobnym kadrze; migawka NPR jest nowa.

### Kamera TPP
- `TPP_DISTANCE` 2,7 → 2,2 m, `TPP_HEIGHT_OFFSET` 0,12 → 0 m (punkt obrotu na wysokości oczu, 1,62 m), `TPP_SHOULDER_OFFSET` bez zmian (0,55 m). Postać stoi w lewej tercji kadru, krzyżyk po prawej od głowy, kamera patrzy znad ramienia, a nie z góry na głowę.
- Stałe ramienia mieszkają w `sim` (`hitscan.ts`), bo kamera stoi na promieniu celowania i krzyżyk ma trafiać dokładnie; zmiana przesuwa początek strzału w TPP o 12 cm w dół. Złoty hash determinizmu się nie zmienia (jego przebieg jest w FPP).
- Kolizja kamery bez zmian: promień sceny i okluder z app (ADR-0045) przyciągają kamerę przed ścianę (test w `engine/test/camera-fov.test.ts`).

### Ustawienie
- Pole `horizontalFov` w `SettingsVm` zastępuje `fov`. Ustawienia leżą w localStorage (`seki.settings.v1`), nie w zapisie gry, więc `SAVE_SCHEMA_VERSION` się nie zmienia. `sanitizeSettings` czyta stare `fov` raz: nietknięte domyślne 62 daje nowe 80, wybrana wartość zachowuje szerokość przy 16:9 (50 → 79, 56 → 87, 80 → 100 po przycięciu).
- UI według ADR-0031: wąska intencja `CameraIntents.setFieldOfView(stopnie)`, hook `useFieldOfView()` dla suwaka i `useViewportAspect()` dla krzyżyka. App: `SettingsController` przycina do 70-100 i zapisuje; `main.tsx` co klatkę podaje kąt do `rig.horizontalFov`, więc zmiana działa od razu, bez przeładowania.

## Pomiar
Spec `e2e/npr-perf.spec.ts` (models=off, SwiftShader, krokowanie, ADR-0046), wywołania rysowania / aktywne siatki, dwa przebiegi z tym samym wynikiem (±2 wywołania):

| Scena | Przed | Po | Budżet przed | Budżet po |
|---|---|---|---|---|
| reference | 179 / 73 | 167 / 67 | 185 / 76 | 173 / 70 |
| krakowskie-tpp | 369 / 156 | 359 / 151 | 378 / 160 | 368 / 155 |
| rynek-tpp | 204 / 80 | 187 / 71 | 210 / 84 | 193 / 75 |
| podzamcze-tpp | 289 / 114 | 256 / 96 | 296 / 118 | 263 / 100 |
| nabrzeze | 266 / 114 | 226 / 95 | 272 / 118 | 232 / 99 |
| phone-low | 231 / 145 | 227 / 141 | 237 / 150 | 233 / 145 |

Każdy budżet spada, żaden nie rośnie. Kadr referencyjny bez cofnięcia kamery dawał 163 / 66.

## Konsekwencje
- Ulice wyglądają na węższe i bliższe, postać w TPP jest większa w kadrze, a gracz, który chce szerzej, ma suwak do 100°.
- Telefon w poziomie widzi tyle ulicy co monitor 16:9 (przedtem 105°); 21:9 widzi trochę więcej, ale ma niższy kadr niż 16:9.
- Krzyżyk w HUD liczy kąt z proporcji okna tak samo jak kamera; jeśli canvas kiedyś przestanie zajmować całe okno, HUD musi dostać proporcje canvasu.
- Zmiana wysokości ramienia w `sim` zmienia początek strzału w TPP; testy AI i walki przechodzą bez zmian.
