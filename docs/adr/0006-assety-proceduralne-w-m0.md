# ADR-0006: Assety proceduralne w M0, glTF od M1

## Decyzja
M0 nie ma modeli 3D ani dźwięków: postacie, budynki i neony powstają proceduralnie (`engine/src/renderer/characters.ts`, `props.ts`), dźwięki syntezuje WebAudio (ADR-0009). Pipeline assetów od M1: glTF/glb z kompresją meshopt (lepsza dekompresja w przeglądarce niż Draco przy podobnym rozmiarze), tekstury KTX2/Basis (UASTC dla normal map, ETC1S dla albedo).

## Konsekwencje
Wycinek działa bez repozytorium assetów, a `ViewDescriptor` w `core` pozostaje niezależny od formatu: zmiana na glb dotyczy tylko `engine`.
