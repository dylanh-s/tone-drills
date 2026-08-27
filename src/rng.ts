// Seeded RNG backed by `seedrandom`, plus the array helpers the drill needs.
// Replaces Python's `random` module. Draws are stable for a given seed within
// the site, but not byte-identical to the CPython CLI.

import seedrandom from "seedrandom";

export class Rng {
  private next: () => number;

  constructor(seed: number | string) {
    this.next = seedrandom(String(seed));
  }

  /** Float in [0, 1). */
  random(): number {
    return this.next();
  }

  /** Integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  /** In-place Fisher–Yates shuffle; returns the same array. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** k distinct elements from `pool` (like random.sample). */
  sample<T>(pool: readonly T[], k: number): T[] {
    return this.shuffle([...pool]).slice(0, k);
  }

  /** One element from `pool`. */
  choice<T>(pool: readonly T[]): T {
    return pool[this.int(pool.length)];
  }
}
