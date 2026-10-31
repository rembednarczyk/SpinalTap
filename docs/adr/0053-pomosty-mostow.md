# ADR-0053: Pomosty mostów: jezdnia i ścieżki na moście od przyczółka do przyczółka

## Kontekst
Importer oznaczał nawierzchnie z dróg `bridge=*` flagą `bridge`, ale nikt jej nie czytał. Renderer kładł je na terenie, a symulacja liczyła grunt z siatki terenu. Mełgiewska przez Bystrzycę schodziła więc o 5 m w koryto rzeki, a auta i gracz jechali po dnie, po wodzie. Tak samo wyglądała kładka przy dokach i most na podjeździe pod zamek.

## Decyzja
- Importer (`ground.ts`): nawierzchnia z drogi na moście dostaje `deck` z końcami tej drogi. Końce drogi to przyczółki mostu, a odcinek między nimi to oś pomostu.
- Pomost (`sim/src/world/deck.ts`):
  - wysokość na przyczółkach to wysokość mapy w tych punktach;
  - między nimi wysokość zmienia się liniowo wzdłuż osi, w poprzek osi jest stała;
  - poza końcami osi wysokość jest przycięta do wysokości przyczółka.
- Symulacja:
  - `GroundField.heightAt` zwraca pomost tam, gdzie jest wyżej niż teren; po pomoście chodzą postacie i jeżdżą auta;
  - `groundY` treści też uwzględnia pomost, więc meble i auta zaparkowane na moście stoją na nim;
  - teren i woda pod mostem zostają bez zmian.
- Kontrakt widoku `ground` (`core/ports/types.ts`) dostaje opcjonalne `deck` z osią i wysokościami przyczółków.
- Renderer (`mapcity/deck-plan.ts`):
  - kawałki na pomoście i linie na nich kładzie na wysokości pomostu, a rzekę dalej na terenie;
  - otwarte krawędzie pomostu dostają betonową opaskę 0,9 m w dół;
  - stopy postaci liczy od pomostu.
  - Wszystko trafia do siatki gruntu komórki, bez nowych wywołań rysowania.

## Konsekwencje
- W centrum jest 9 kawałków na mostach: jezdnie i chodniki Mełgiewskiej nad Bystrzycą, kładka przy dokach, most na podjeździe pod zamek i krótka kładka na Podzamczu. Złote hashe bez zmian.
- Pod mostem nie da się przejść brzegiem: grunt jest tam pomostem. Uzupełnienie (G-062): pomost wyżej niż `DECK_HEADROOM` (2 m) nad terenem jest gruntem tylko dla stóp, które sięgają go krokiem (`GroundField.heightAt` z `reach`); pod nim grunt to teren, a spód pomostu jest sufitem skoku. Renderer kładzie tam drogę pod mostem na terenie i pocienia pomost (`deckDepth`), żeby głowa przechodnia mieściła się pod spodem. Kawałek pomostu leży na własnej osi. `groundY` treści i ruch aut dalej widzą najwyższy pomost.
- Kule przelatują przez pomost, a promienie widzą tylko teren.
- Most nie ma przęseł, filarów ani balustrad, tylko opaskę. Do dopracowania razem z kładkami nad ulicami (ADR-0051).
