// A tiny, dependency-free PCA (mean-centre + power-iteration for the top-2 eigenvectors of the covariance). Used to
// project the 8-dim colour/texture feature vectors into a 2D scatter so the synthetic lithology clouds and the real
// DCID patches can be shown on the same axes (the domain-gap view). Deterministic given the inputs.

export interface Pca {
  mean: Float32Array;
  axes: [Float32Array, Float32Array];
}

function covariance(vectors: Float32Array[], mean: Float32Array): Float32Array {
  const d = mean.length;
  const cov = new Float32Array(d * d);
  for (const v of vectors) {
    for (let i = 0; i < d; i++) {
      const di = v[i] - mean[i];
      for (let j = i; j < d; j++) cov[i * d + j] += di * (v[j] - mean[j]);
    }
  }
  const n = Math.max(1, vectors.length - 1);
  for (let i = 0; i < d; i++) for (let j = i; j < d; j++) { cov[i * d + j] /= n; cov[j * d + i] = cov[i * d + j]; }
  return cov;
}

function matVec(m: Float32Array, v: Float32Array, d: number): Float32Array {
  const out = new Float32Array(d);
  for (let i = 0; i < d; i++) { let s = 0; for (let j = 0; j < d; j++) s += m[i * d + j] * v[j]; out[i] = s; }
  return out;
}

function normalise(v: Float32Array): Float32Array {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n) as Float32Array;
}

/** Power-iterate the leading eigenvector of `m` (d x d), starting from a fixed seed for determinism. */
function leadingEigen(m: Float32Array, d: number, iters = 60): Float32Array {
  let v = new Float32Array(d).map((_, i) => (i % 2 ? -1 : 1) / Math.sqrt(d)) as Float32Array;
  for (let it = 0; it < iters; it++) v = normalise(matVec(m, v, d));
  return v;
}

/** Fit a 2-component PCA over the given feature vectors. */
export function fitPca(vectors: Float32Array[]): Pca {
  const d = vectors[0].length;
  const mean = new Float32Array(d);
  for (const v of vectors) for (let i = 0; i < d; i++) mean[i] += v[i];
  for (let i = 0; i < d; i++) mean[i] /= vectors.length;

  const cov = covariance(vectors, mean);
  const a0 = leadingEigen(cov, d);
  // deflate the covariance by the first component, then extract the second
  const lambda0 = (() => { const mv = matVec(cov, a0, d); let s = 0; for (let i = 0; i < d; i++) s += a0[i] * mv[i]; return s; })();
  const defl = cov.slice();
  for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) defl[i * d + j] -= lambda0 * a0[i] * a0[j];
  const a1 = leadingEigen(defl, d);
  return { mean, axes: [a0, a1] };
}

/** Project a feature vector into the 2D PCA plane. */
export function project(v: Float32Array, pca: Pca): [number, number] {
  const { mean, axes } = pca;
  let x = 0;
  let y = 0;
  for (let i = 0; i < mean.length; i++) { const c = v[i] - mean[i]; x += c * axes[0][i]; y += c * axes[1][i]; }
  return [x, y];
}
