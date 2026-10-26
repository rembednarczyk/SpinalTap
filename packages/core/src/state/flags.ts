/**
 * World facts as a sorted, duplicate-free list of strings. Sorted storage keeps
 * snapshots and state hashes stable regardless of the order flags were set in.
 */
export type Flags = readonly string[];

export const hasFlag = (flags: Flags, flag: string): boolean => flags.includes(flag);

export const setFlag = (flags: Flags, flag: string): Flags =>
  hasFlag(flags, flag) ? flags : [...flags, flag].sort();

export const killedFlag = (tag: string): string => `killed:${tag}`;
