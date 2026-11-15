// A small seeded generator (mulberry32), so a run — and a screenshot scene —
// can be replayed exactly from its seed. The game never calls Math.random for
// anything that shapes play; the only unseeded randomness is cosmetic sparkle.

/** Create a generator from a 32-bit seed. */
export function createRandom(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  return {
    /** Next value in [0, 1). */
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    /** A value in [min, max). */
    range(min, max) {
      return min + this.next() * (max - min);
    },
    /** A whole number in [min, max]. */
    int(min, max) {
      return Math.floor(this.range(min, max + 1));
    },
    /** True with the given probability. */
    chance(p) {
      return this.next() < p;
    },
    /** One element of the array, uniformly. */
    pick(list) {
      return list[Math.floor(this.next() * list.length)];
    },
  };
}
