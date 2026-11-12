import { describe, expect, it } from 'vitest';
import { ModelMemory, type ModelFilesNow } from '../src/renderer/model-memory';

const files = (loaded: string[], used: string[] = [], kept: string[] = []): ModelFilesNow => ({
  loaded,
  used: new Set(used),
  kept: new Set(kept),
});

// Names run against the idle order on purpose, so a sort by name alone would fail.
describe('ModelMemory: release order over the limit (G-621)', () => {
  it('lets go of the longest unused file first, one candidate at a time', () => {
    const mem = new ModelMemory(2);
    expect(mem.sweep(1, files(['z']))).toEqual([]);
    expect(mem.sweep(1, files(['z', 'y']))).toEqual([]);
    // z idle 3, y idle 2, x idle 1: one over the limit, so only z goes.
    expect(mem.sweep(1, files(['z', 'y', 'x']))).toEqual(['z']);
  });

  it('lets go of several at once in order, longest unused first', () => {
    const mem = new ModelMemory(3);
    mem.sweep(1, files(['c']));
    mem.sweep(1, files(['c', 'b']));
    mem.sweep(1, files(['c', 'b', 'a']));
    // c idle 4, b idle 3, a idle 2, d and e idle 1: two over the limit, so c then b.
    const out = mem.sweep(1, files(['a', 'b', 'c', 'd', 'e']));
    expect(out).toEqual(['c', 'b']);
  });

  it('breaks a tie by name, not by load order', () => {
    const mem = new ModelMemory(1);
    expect(mem.sweep(1, files(['m', 'k']))).toEqual(['k']);
  });

  it('never lets go of files in use or kept ones, even over the limit', () => {
    const mem = new ModelMemory(1);
    const out = mem.sweep(1, files(['used', 'kept', 'old', 'new'], ['used'], ['kept']));
    expect(out).toEqual(['new', 'old']);
    expect(mem.sweep(1, files(['used', 'kept'], ['used'], ['kept']))).toEqual([]);
  });

  it('a file worn again starts its idle time over', () => {
    const mem = new ModelMemory(2);
    mem.sweep(5, files(['a', 'b']));
    mem.sweep(1, files(['a', 'b'], ['a']));
    // a idle 1 again, b idle 7: b goes first.
    expect(mem.sweep(1, files(['a', 'b', 'c']))).toEqual(['b']);
  });
});
