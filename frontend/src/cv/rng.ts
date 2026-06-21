// Tiny seedable PRNG (mulberry32) + value noise — deterministic across Node and the browser, so the synthetic trays
// and the training patches are byte-identical given a seed.

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A cheap, smooth-ish 2-D hash noise in [-1,1] (deterministic in x,y,seed) — for grain/banding modulation. */
export function hashNoise(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) / 4294967296) * 2 - 1;
}

/** Smoothed value noise (bilinear over an integer lattice) — gives correlated grain at a chosen scale. */
export function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const s = (a: number) => a * a * (3 - 2 * a); // smoothstep
  const n00 = hashNoise(x0, y0, seed);
  const n10 = hashNoise(x0 + 1, y0, seed);
  const n01 = hashNoise(x0, y0 + 1, seed);
  const n11 = hashNoise(x0 + 1, y0 + 1, seed);
  const nx0 = n00 + (n10 - n00) * s(fx);
  const nx1 = n01 + (n11 - n01) * s(fx);
  return nx0 + (nx1 - nx0) * s(fy);
}
