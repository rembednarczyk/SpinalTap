/**
 * miniplex reorders entities on removal (swap-remove), and buckets differ in order. Systems
 * whose result depends on iteration order (RNG use, push-out between bodies) iterate in
 * creation order instead, which survives a save/load round trip.
 */
export const inCreationOrder = <T extends { readonly id: number }>(entities: Iterable<T>): T[] =>
  [...entities].sort((a, b) => a.id - b.id);
