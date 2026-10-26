# ADR-0003: Kontur NPR: inverted-hull na postaciach

## Kontekst
Do wyboru: inverted-hull albo post-process edge detection (§7).

## Decyzja
Inverted-hull przez wbudowany `OutlineRenderer` Babylona (`mesh.renderOutline`), tylko dla postaci i viewmodelu broni (flaga `outline` w presetach NPR). Otoczenie nie ma konturu; jego czytelność buduje toon shading, rim light i mgła.

Shader toon (`engine/src/npr/toon-shader.ts`): dwa twarde pasma światła, twardy rim light, schodkowe odblaski na mokrym asfalcie, proceduralne okna na fasadach, mgła odległościowa. Grading: `DefaultRenderingPipeline` z krzywymi kolorów (stonowana, turkusowa paleta).

## Konsekwencje
Kontur podwaja draw calle postaci, dlatego tylko dla nich. Jeśli w M4 zechcemy kreski na architekturze, dodamy edge detection jako osobny post-process.
