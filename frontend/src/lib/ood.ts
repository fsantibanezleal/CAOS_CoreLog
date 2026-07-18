// Feature-space out-of-distribution (OOD) scoring in the browser. The offline benchmark
// (data-pipeline/cllab/science/ood_bench.py) fit a class-conditional Gaussian (Mahalanobis, Lee et al. 2018)
// and a kNN bank (Sun et al. 2022) on the synthetic training distribution, in the 64-d penultimate feature
// space of the lithology CNN. This is the principled replacement for the weak reconstruction-MSE OOD: a real
// patch lands far from every synthetic class centroid, so its Mahalanobis distance is large. The compact
// statistics ship in data/derived/ood-detector.json; the 64-d feature `f` is a new output of lithology-cnn.onnx.
const base = () => import.meta.env.BASE_URL || '/';

export interface OodDetector {
  space: string;
  detector: 'mahalanobis';
  classes: string[];
  mu: number[][];        // [nClass][dim] class centroids (synthetic training distribution)
  classIndex: number[];
  precision: number[][]; // [dim][dim] shared inverse covariance
  knnBank: number[][];   // [nBank][dim] normalized reference embeddings
  knnK: number;
  idQuantiles: Record<string, number>; // synthetic-ID Mahalanobis quantiles (0.5/0.9/0.95/0.99)
  oodMedian: number;                    // median Mahalanobis of real DCID patches (the benchmark)
}

export interface OodDoc { schema: string; shipped: OodDetector; note: string; }

let _doc: Promise<OodDoc | null> | null = null;
export function loadOodDetector(): Promise<OodDoc | null> {
  return (_doc ??= fetch(`${base()}data/ood-detector.json`)
    .then((r) => (r.ok ? (r.json() as Promise<OodDoc>) : null))
    .catch(() => null));
}

/** Mahalanobis OOD score for one feature vector: min_c (f-mu_c)^T P (f-mu_c). Higher = more out-of-distribution. */
export function mahalanobis(feat: Float32Array | number[], det: OodDetector): number {
  const P = det.precision;
  const dim = P.length;
  let best = Infinity;
  for (const mu of det.mu) {
    // d = feat - mu ; s = d^T P d
    const d = new Float64Array(dim);
    for (let i = 0; i < dim; i++) d[i] = feat[i] - mu[i];
    let s = 0;
    for (let i = 0; i < dim; i++) {
      const Pi = P[i];
      let row = 0;
      for (let j = 0; j < dim; j++) row += Pi[j] * d[j];
      s += d[i] * row;
    }
    if (s < best) best = s;
  }
  return best;
}

/** Map a raw Mahalanobis distance to a calibrated 0..1 novelty, anchored on the synthetic-ID 95th percentile
 * (the operating threshold from the benchmark). 0.5 sits at the threshold; ~1 is deep OOD. */
export function novelty(score: number, det: OodDetector): number {
  const t = det.idQuantiles['0.95'] ?? det.idQuantiles['0.9'] ?? 1;
  const x = score / Math.max(t, 1e-6);
  return 1 - 1 / (1 + Math.max(0, x)); // monotone, 0.5 at score = t
}
