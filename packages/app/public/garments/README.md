# Ubrania jako osobne assety (ADR-0086)

Skinned meshe ubrań na kościach `J_Bip_*` postaci VRoid, wycięte z modeli przez
`tools/garments/garment_extract.py` według przepisu w `tools/garments/garments.json` (źródło po sha256,
materiały, ewentualnie prostokąty UV). Silnik zakłada je na model postaci po nazwach kości, dopasowuje do
ciała pliku obsady i nie rysuje zakrytej części jej góry (`packages/engine/src/renderer/garment-assets.ts`).
Surowe pliki VRM nie trafiają do repo; strona, autor, warunki z datą i sha256 są w `tools/assets/sources.json`.

| Plik | Tytuł | Autor | Źródło | Licencja | Zmiany |
|---|---|---|---|---|---|
| `jacket-techwear.glb` | Kimi \|\| Desktop Mate Model | Toriss | [VRoid Hub](https://hub.vroid.com/en/characters/7972506988434619525/models/2687543789787584553) | [warunki autora na VRoid Hub](https://hub.vroid.com/license?allowed_to_use_user=everyone&characterization_allowed_user=everyone&corporate_commercial_use=allow&credit=unnecessary&modification=allow&personal_commercial_use=profit&redistribution=allow&sexual_expression=allow&version=1&violent_expression=allow) (stan z 15.11.2026: modyfikacja, redystrybucja, przemoc i komercja dozwolone, podpis niewymagany; w grze na liście NC, `docs/assety-nc.md`) | sama kurtka (materiały `N00_007_03_Tops_01_CLOTH_01..03`, 5140 trójkątów), wagi przeniesione z kości `J_Sec_*` na najbliższe `J_Bip_*`, trzy tekstury 2048 px w jednym atlasie 512 px, bez reszty modelu |

Odtworzenie: `python3 -I tools/garments/garment_extract.py 8653533936556512697.vrm packages/app/public/garments/jacket-techwear.glb --recipe tools/garments/garments.json --id jacket-techwear` (ten sam plik wejściowy daje ten sam GLB, bajt w bajt).
