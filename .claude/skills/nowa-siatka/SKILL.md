---
name: nowa-siatka
description: Dodawanie nowej siatki chunków do mapy Lublina (rząd albo blok komórek) od danych po merge, z listą kontrolną i hookiem Stop, który nie pozwala skończyć bez rozstrzygnięcia każdego punktu. Używaj przy rozszerzaniu mapy o nowe komórki i przy ponownym imporcie istniejących.
---

# Nowa siatka mapy

Wzorzec: lista Definition of Done pilnowana bramką (lista kontrolna wydania z continuous delivery), tu dla jednej
siatki zamiast wydania. Lista punktów jest w kodzie: `tools/grid-verify/src/checklist.ts`; każdy punkt ma `skad`,
czyli błąd, który go nauczył.

## Przebieg

1. Deklaracja: `docs/siatki/<nazwa>.json` (wzór w `docs/siatki/README.md`), chunki w `docs/mapa-pokrycie.json`
   ze statusem `nieprzejrzane`.
2. Włącz hook: `pnpm grid:verify <nazwa> --start`. Od tej chwili hook Stop (`tools/grid-verify/hook.sh`) blokuje
   koniec tury, dopóki aktualny raport ma punkty nierozstrzygnięte.
3. Dane i import: edycja NMT (T-343), budynki na brzegu mapy (T-342), `pnpm osm:build`, `pnpm osm:props`,
   `pnpm tables:check`.
4. Skan: `pnpm grid:verify <nazwa>` dzieli nowe miejsca skanu na te w chunkach siatki i resztę. Każde w siatce
   naprawiasz (jeden glitch na commit, `pnpm scan:update`), zgłaszasz w `docs/glitches.md` albo przyjmujesz decyzją
   z odnośnikiem. Poza siatką nowych miejsc być nie powinno (szew).
5. Grunt i ruch: testy ruchu i terytoriów oraz sondy siatki (`tools/grid-verify/test/grid-probe.test.ts`, schody
   na jezdni). Nowa sonda trafia tam, gdy siatka pokaże błąd, którego skan nie liczy; gdy da się go policzyć
   w całym mieście, dostaje rodzaj w skanie.
6. Topografia i treść: przegląd agenta `topography-curator`, karty lokacji dla nowych miejsc, sceny bez siatek
   najpierw na mapę.
7. Wygląd: zrzuty dzień i noc z wysokości oczu w ujęciach siatki, potem `pnpm grid:verify <nazwa> --full`
   (migawka NPR i bramki Definition of Done) na spokojnej maszynie.
8. Dokumentacja: rejestr glitchy, `docs/topografia.md`, status komórek w `docs/mapa-pokrycie.json`, backlog,
   changelog. Zapisz `zrobione` z odnośnikami w deklaracji.
9. `pnpm grid:verify <nazwa> --full`, potem `pnpm grid:verify <nazwa> --stop` wyłącza hook (tylko przy aktualnym
   raporcie bez punktów otwartych).

Raport jest ważny tylko dla commita i stanu drzewa, przy których powstał: po każdej zmianie uruchom go ponownie.
