# ADR-0013: World streaming: chunki z histerezą, drugi dystrykt

## Kontekst
M2 (§14): przemieszczanie między dystryktami bez przeładowania całości. Świat ma rosnąć o kolejne dystrykty, a symulacja ma liczyć tylko to, co jest wokół gracza. Wszystko musi zostać deterministyczne i przetrwać zapis.

## Decyzja
- **Chunk** to prostokąt mapy z treścią (propy, postacie z kluczem). Tabela `WORLD_CHUNKS` w `sim/src/content/world-map.ts`: `shinsekai-7`, `kanal` (Ulica Kanałowa), `targ-south` i `targ-north` (Targ pod estakadą). Treść nowych dystryktów jest generowana ze stałego ziarna (`CONTENT_SEED`), bez `RandomPort` gry.
- **`WorldStreamer`** (`sim/src/world/streaming.ts`) ładuje chunk, gdy gracz jest w promieniu 30 m od jego granic, i zwalnia go dopiero powyżej 44 m (histereza). Odpowiada mu `streamingSystem`, pierwszy w `createSystems()`, więc reszta kroku widzi świat dla bieżącej pozycji (także po teleporcie).
- **Id bytów są rezerwowane z góry** dla całej treści (gracz, potem chunki w kolejności tabeli, potem cele kontraktu). Ponownie załadowany byt ma to samo id; ruch iteruje bryły w kolejności tworzenia, więc kolejność ładowania nie zmienia wyniku.
- **Stan uśpionych postaci**: przy zwalnianiu chunka postać z kluczem zostawia `EntitySnapshot`, który wraca przy ponownym załadowaniu i trafia do zapisu. Zabici (`dead:<key>`) nie wracają. Zaalarmowany ganger jest przypięty: goni gracza dalej, zamiast znikać z chunkiem.
- **Postacie z treści** (`ActorDef`) niosą frakcję i opcjonalnie AI przechodnia (`bystander`): babcia Ume z M2 i Oyaji z targu uciekają tak samo; stan AI jest bezstanowy, więc usypianie go nie gubi.
- **Kontrakt** jest uznany za wyczyszczony po flagach śmierci wszystkich celów, nie po stanie świata (cele mogą spać w zwolnionym chunku).
- **Zapis v6**: `SaveSnapshot.streaming.loadedChunks`; `entities` obejmuje też uśpione postacie. Migracja v5→v6 wstawia pustą listę, a symulacja dociąga chunki wokół zapisanej pozycji gracza.
- **Kontrakt `RenderPort.despawn(id, reason?)`**: `"removed"` (domyślnie, np. śmierć: animacja wyjścia) albo `"unloaded"` (chunk zwolniony: znika od razu). `RenderSync` rozróżnia je po `WorldStreamer.streamedOut`.
- **Renderer** (minimalne zmiany): przy despawnie propa zdejmuje też stożki światła, odbicia i migotanie z `Atmosphere` oraz własne materiały neonów i żarówek. `ToonMaterials` nie odrzuca świateł ponad 8 slotów: czekają w kolejce, a sloty dostają najpierw światła w promieniu 50 m od kamery, w kolejności rejestracji. W obrębie jednego dystryktu (i w scenie referencyjnej) wybór jest taki jak wcześniej.

## Konsekwencje
- Dystrykty są połączone ulicą z zakrętem, żeby z miejsc, w których jeden jest zwolniony, nie było go widać (nie ma jeszcze LOD ani impostorów). Dekoracje silnika z `dressing.ts` dotyczą tylko Shinsekai i zostają w scenie także po jego zwolnieniu; są wtedy zasłonięte.
- Złoty hash replayu zmienił się tylko o nowe pole zapisu (848f66d6 → 9b3d0871; hash z pominięciem `streaming` i z wersją 5 nadal daje 848f66d6).
- Budżet wydajności `market-tpp` w `tools/perf-budgets.json` pilnuje targu z wyładowanym Shinsekai.
