# ADR-0004: Cel renderowania: WebGL2, WebGPU później

## Decyzja
WebGL2 jako baza (`Engine` Babylona). Shader toon jest w GLSL; Babylon potrafi go przetłumaczyć dla WebGPU, ale ścieżka WebGPU (`WebGPUEngine` za flagą) wejdzie dopiero po profilowaniu M0 na docelowym sprzęcie.

## Konsekwencje
Szerokie wsparcie przeglądarek, w tym headless Chromium ze SwiftShaderem w CI.
