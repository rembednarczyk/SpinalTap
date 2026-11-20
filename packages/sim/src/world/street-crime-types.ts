import type { CityDistrictId, MicroEventKind, Vec3 } from "@seki/core";

/** A crime of the street's board (ADR-0091 stage 5). On its own so that the context can name it without the board's module. */
export interface BoardCrime {
  readonly id: string;
  readonly district: CityDistrictId;
  readonly kind: MicroEventKind;
  readonly at: Vec3;
}
