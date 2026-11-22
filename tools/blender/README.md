# Detal pomieszczeń z Blendera (ADR-0098)

Modele rzeczy z inwentarzy kart pomieszczeń (`docs/pomieszczenia/`), budowane skryptami w Blenderze bez okna. Wynik trafia do `packages/app/public/city/room-detail-props.glb`.

- `shapes.py`: biblioteka kształtów we współrzędnych gry (x w bok, y w górę, z przód modelu, metry, stopa na y = 0). Gra jest lewoskrętna jak Babylon, a Blender i glTF prawoskrętne: `Model` odbija x przy przejściu do Blendera i odwraca ściany, więc x modelu to x świata przy obrocie 0 (bez tego model w grze wychodził lustrzany). Zawiera pudła z fazkami, walce, rurki między punktami, bryły obrotowe z profilu i płaskie czworokąty. Każda ściana ma rolę palety zestawu miasta (`tools/city_kit_palette.py`) jako nazwę materiału.
- `rooms/<pomieszczenie>.py`: modele jednego wnętrza według jego karty (`MODELS`: funkcje zwracające `shapes.Model`). Model stoi w ramce bryły symulacji, którą rysuje.
- `build.py`: buduje wszystkie modele i eksportuje jeden glTF.
- `../city_blender.py`: uruchamia `build.py`, wypieka role na UV palety i zapisuje plik rekwizytów z `extras` {size, styles}.

Przebudowa: `python3 tools/city_blender.py packages/app/public/city` (wymaga `blender` na ścieżce; w obrazie środowiska jest Blender 4.0). Te same skrypty dają ten sam plik: bez losowości, warianty z `hashf`.

Nowy model:
1. Dopisz go do karty pomieszczenia (inwentarz docelowy, źródło: Blender).
2. Dodaj funkcję do `rooms/<pomieszczenie>.py`.
3. Dodaj klucz na końcu `ROOM_DETAIL_SHAPES` (`packages/core/src/world/room-detail.ts`).
4. Postaw model w grze jako rekwizyt `room-detail` (np. `packages/sim/src/content/koi-detail.ts`). Bryła, którą rysuje, dostaje `scenery`.
5. Przebuduj plik, potem `pnpm rooms:write`.
