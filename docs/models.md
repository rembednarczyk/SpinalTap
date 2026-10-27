# Importowane modele postaci (VRM / glTF)

Proceduralna obsada z `packages/engine/src/renderer/characters.ts` jest domyślna. Każdą rolę
można podmienić na model z VRoid Studio, Blendera albo od grafika. Model dostaje toon shading,
cień, line art i animację z proceduralnego rigu, więc nie potrzebuje własnych klipów.

## Manifest

`models/manifest.json` obok gry (albo dowolny URL w parametrze `?models=`):

```json
{
  "heroine": { "url": "seki.vrm", "scale": 1.0 },
  "fixer": { "url": "kaito.glb", "yaw": 0 },
  "civilian": { "url": "ume.vrm" },
  "ripperdoc": { "url": "mori.vrm" },
  "ganger": { "url": "hebi.glb", "outline": true }
}
```

| Pole | Znaczenie |
|---|---|
| `url` | Plik `.vrm`, `.glb` lub `.gltf`, ścieżka względem manifestu. |
| `scale` | Skala jednolita. Eksporty VRoid są w metrach, czyli `1`. |
| `yaw` | Dodatkowy obrót wokół Y. Zwykle zbędny, bo kierunek wykrywa retarget. |
| `outline` | Kontur z odwróconego hulla (cienki). Domyślnie wyłączony, patrz niżej. |
| `preset` | Preset toon (`importedCharacter` domyślnie). |
| `idle`, `walk`, `run` | Nazwy klipów glTF. Na razie nieużywane: postać animuje rig. |

Testowy model VRoid leży w `packages/app/public/models/test/` i włącza się przez
`?models=./models/test/manifest.json` (licencja w README tego katalogu). Scena referencyjna
NPR zawsze używa obsady proceduralnej, żeby migawka nie zależała od pobrań.

## Jak to działa

1. `ModelLibrary` ładuje każdy plik raz (`AssetContainer`) i wydaje niezależne instancje.
2. `convertModelMaterials` zamienia materiały glTF na toon:
   - kolor bazowy i tekstura z materiału źródłowego;
   - `MASK` jako alpha test, `BLEND` (eyeliner, rzęsy, odblaski) jako prawdziwe mieszanie;
   - warstwy oka dostają polygon offset (białko < tęczówka < odblask), żeby kolejność
     rysowania nie decydowała o wyniku;
   - prymitywy z tym samym materiałem i wspólnymi danymi wierzchołków są scalane w jeden mesh
     (fryzura VRoid: z 95 do 16 meshy);
   - warstwy `EyeExtra` (gwiazdki w oczach) są usuwane.
3. `HumanoidRetarget` przypina model do ciała rigu i co klatkę przenosi obroty stawów
   (biodra, kolana, barki, łokcie, głowa) na kości humanoida w przestrzeni modelu. Rozpoznaje
   nazwy kości VRoid (`J_Bip_*`), Mixamo i Blendera. T-pose i A-pose są sprowadzane do rąk
   opuszczonych, a modele VRM 0.x zwrócone tyłem są obracane automatycznie.
4. Postać strzelająca dostaje broń w kości prawej dłoni, ułożoną wzdłuż przedramienia rigu.
5. `SpringBones` porusza włosami i ubraniem (kości `HairJoint-*` i `J_Sec_*`) algorytmem
   sprężyn VRM: bezwładność, opór, sztywność i lekka grawitacja, z limitem wychylenia.
   Końcówki w 75% podążają za ruchem postaci, żeby przy biegu włosy nie stawały dęba. Sfery
   kolizji na głowie, klatce i udach trzymają włosy z dala od twarzy, a spódnicę od nóg.

## Ograniczenia i pułapki

- **Kontur z hulla zasłania ubranie.** Babylonowy `OutlineRenderer` w drugim przebiegu
  zapisuje głębię nadmuchanego hulla. Skóra z konturem 1,8 cm zakrywa sukienkę leżącą
  centymetr nad nią. Dlatego importowane modele mają kontur wyłączony i tuszuje je post-process
  line art. Na niskiej jakości (telefony) line art jest wyłączony, więc modele nie mają konturu.
- **Blend shapes twarzy (mruganie, usta)** jeszcze nie działają: toon shader nie ma morph
  targetów. Pierwsza próba (standardowe include'y Babylona `morphTargetsVertex*`) została
  wycofana, bo testy w przeglądarce się zawieszały. Później okazało się, że to samo działo się
  bez niej przy przeciążonej maszynie, więc przyczyna nie jest ustalona. Przy ponownej próbie
  trzymać sterowane cele zawsze aktywne (wpływ > 0), bo Babylon liczy aktywne cele do definicji
  shadera i każde mrugnięcie wymuszałoby rekompilację.
- **Parametry sprężyn z pliku VRM** (`secondaryAnimation`) nie są czytane; wszystkie łańcuchy
  mają jedne ustawienia (`DEFAULT_SPRING`).
- **Klipy animacji z pliku** nie są odtwarzane, bo rig daje chód, celowanie, trafienie i upadek.
- **Wydajność:** model VRoid to około 15 draw calli plus cień. Budżet ulicy (280) mieści
  kilka takich postaci. Przy większej obsadzie potrzebne będzie LOD albo atlas materiałów.
