// Small seeded RNG. Replaces Python's `random` module. It does NOT reproduce
// CPython's Mersenne-Twister sequences — the web app only needs draws that are
// stable for a given seed within the site, not byte-identical to the CLI.
/** Deterministic 32-bit hash of a string (FNV-1a). Used to derive numeric
 *  sub-seeds from strings like `${seed}-${idx}-lucia`, replacing Python's md5. */
export function hashStr(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}
/** mulberry32 — a compact, well-distributed seeded PRNG. */
export class Rng {
    constructor(seed) {
        this.state = (typeof seed === "number" ? seed >>> 0 : hashStr(seed)) || 1;
    }
    /** Float in [0, 1). */
    random() {
        let t = (this.state += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    /** Integer in [0, n). */
    int(n) {
        return Math.floor(this.random() * n);
    }
    /** In-place Fisher–Yates shuffle; returns the same array. */
    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = this.int(i + 1);
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
    /** k distinct elements from `pool` (like random.sample). */
    sample(pool, k) {
        return this.shuffle([...pool]).slice(0, k);
    }
    /** One element from `pool`. */
    choice(pool) {
        return pool[this.int(pool.length)];
    }
}
