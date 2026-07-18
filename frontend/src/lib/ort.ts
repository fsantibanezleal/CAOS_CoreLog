// Live in-browser inference of the lithology CNN (onnxruntime-web). GRACEFUL: the trained model
// (science/train_litho.py → lithology-cnn.onnx) ships committed; if the file is ever absent or fails to load, the
// loader resolves to null and the App falls back to the classical baseline + says so. The npm package and the CDN wasmPaths
// are pinned to the same version. WASM EP, single-threaded (GitHub Pages has no COOP/COEP for threads).
import * as ort from 'onnxruntime-web';
import { N_LITHO, PATCH } from '../cv/types.ts';

ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';
ort.env.wasm.numThreads = 1;

const base = () => import.meta.env.BASE_URL || '/';
const sessions: Record<string, Promise<ort.InferenceSession | null>> = {};

function get(file: string): Promise<ort.InferenceSession | null> {
  return (sessions[file] ??= (async () => {
    try {
      const head = await fetch(`${base()}${file}`, { method: 'HEAD' });
      if (!head.ok) return null;
      return await ort.InferenceSession.create(`${base()}${file}`, { executionProviders: ['wasm'] });
    } catch {
      return null;
    }
  })());
}

const locks: Record<string, Promise<unknown>> = {};
async function run(file: string, input: string, output: string, flat: Float32Array, dims: number[]): Promise<Float32Array | null> {
  const s = await get(file);
  if (!s) return null;
  const prev = locks[file] || Promise.resolve();
  const job = prev.then(async () => {
    const out = await s.run({ [input]: new ort.Tensor('float32', flat, dims) });
    return out[output].data as Float32Array;
  });
  locks[file] = job.catch(() => {});
  return job;
}

/** Batched lithology CNN: n patches (CHW, each 3*PATCH*PATCH) → n×N_LITHO softmax. null if the model isn't trained. */
export async function runLithoCNNBatch(flat: Float32Array, n: number): Promise<Float32Array | null> {
  return run('lithology-cnn.onnx', 'x', 'p', flat, [n, 3, PATCH, PATCH]);
}

/** Batched lithology CNN returning BOTH the softmax `p` (n×N_LITHO) and the 64-d penultimate feature `f`
 * (n×FEAT_DIM) in one pass. `f` feeds the live Mahalanobis/kNN OOD score. null if the model isn't loaded, or
 * if it is the older single-output export (no `f`), so the caller falls back to the reconstruction OOD. */
export async function runLithoFeatBatch(flat: Float32Array, n: number): Promise<{ probs: Float32Array; feats: Float32Array; dim: number } | null> {
  const s = await get('lithology-cnn.onnx');
  if (!s) return null;
  const prev = locks['lithology-cnn.onnx'] || Promise.resolve();
  const job = prev.then(async () => {
    const out = await s.run({ x: new ort.Tensor('float32', flat, [n, 3, PATCH, PATCH]) });
    const probs = out['p']?.data as Float32Array | undefined;
    const fT = out['f'];
    if (!probs || !fT) return null;
    const feats = fT.data as Float32Array;
    return { probs, feats, dim: feats.length / n };
  });
  locks['lithology-cnn.onnx'] = job.catch(() => {});
  return job;
}

/** Batched real DCID-7 head (real-litho-cnn.onnx): n patches at `size`×`size` → n×7 softmax over DCID-7. null if
 * the model is absent (the App then shows only the synthetic-trained head). */
export async function runRealHeadBatch(flat: Float32Array, n: number, size: number): Promise<Float32Array | null> {
  return run('real-litho-cnn.onnx', 'x', 'p', flat, [n, 3, size, size]);
}

export const realHeadAvailable = async () => (await get('real-litho-cnn.onnx')) != null;

/** Batched OOD autoencoder: n patches → reconstruction; the caller computes per-patch MSE as the OOD score. */
export async function runOODBatch(flat: Float32Array, n: number): Promise<Float32Array | null> {
  return run('core-ood.onnx', 'x', 'xr', flat, [n, 3, PATCH, PATCH]);
}

export const cnnAvailable = async () => (await get('lithology-cnn.onnx')) != null;

export const N_CLASSES = N_LITHO;
