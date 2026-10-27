# ADR-0003: Kontur NPR: inverted-hull na postaciach

## Kontekst
Do wyboru: inverted-hull albo post-process edge detection (§7).

## Decyzja
Inverted-hull przez wbudowany `OutlineRenderer` Babylona (`mesh.renderOutline`), tylko dla postaci i viewmodelu broni (flaga `outline` w presetach NPR). Otoczenie nie ma konturu; jego czytelność buduje toon shading, rim light i mgła.

Shader toon (`engine/src/npr/toon-shader.ts`): dwa twarde pasma światła, twardy rim light, schodkowe odblaski na mokrym asfalcie, proceduralne okna na fasadach, mgła odległościowa. Grading: `DefaultRenderingPipeline` z krzywymi kolorów (stonowana, turkusowa paleta).

## Konsekwencje
Kontur podwaja draw calle postaci, dlatego tylko dla nich. Jeśli w M4 zechcemy kreski na architekturze, dodamy edge detection jako osobny post-process.

## Rewizja 1: pipeline w stylu animacji z lat 90.

Docelowy kaliber to ręcznie rysowane anime z lat 90. (referencje: stonowane turkusy, ostre cienie, tusz na wszystkich krawędziach). Konsekwencje dla renderu:

- **Kontury ekranowe na całej scenie** (`npr/line-art.ts`): krawędzie z G-bufora (skok głębi i załamanie normalnych), wygaszane z odległością. Inverted-hull zostaje na postaciach jako grubsza kreska. Jakość `low` (telefony) wyłącza G-bufor.
- **Ostry cień księżyca** (`npr/moon-shadow.ts`): ortograficzna kamera podąża za graczem z przyciąganiem do tekseli (bez migotania), filtr dwuliniowy wyostrzony do twardej krawędzi, statyczne obiekty rzucające cień scalone w jedną bryłę.
- **Shader toon v2**: instancje i skinning przez standardowe include'y Babylona, tekstura i kolor wierzchołków (gotowość na modele glTF), chłodny kolor strony cienia, światło wypełniające na postaciach (twarze czytelne nocą), dynamiczne światło błysku z lufy.
- **Postacie**: bryły obrotowe z proporcjami anime, stawy łokci i kolan, scalone w jedną skinowaną siatkę na postać (kolory części w kolorach wierzchołków, kości podpięte pod węzły animacji proceduralnej).
- **Atmosfera** (`renderer/atmosphere.ts`): kopuła nieba, panorama dalekich wieżowców, stożki światła latarni, odbicia neonów w mokrym asfalcie, migotanie szyldów, para, rozbryzgi deszczu.
