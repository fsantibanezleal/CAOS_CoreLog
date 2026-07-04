// Live in-browser inference of the lithology CNN (onnxruntime-web). GRACEFUL: the trained model
// (science/train_litho.py → lithology-cnn.onnx) ships committed; if the file is ever absent or fails to load, the
// loader resolves to null and the App falls back to the classical baseline + says so. The npm package and the CDN wasmPaths
// are pinned to the SAME version. WASM EP, single-threaded (GitHub Pages has no COOP/COEP for threads).
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

/** Batched OOD autoencoder: n patches → reconstruction; the caller computes per-patch MSE as the OOD score. */
export async function runOODBatch(flat: Float32Array, n: number): Promise<Float32Array | null> {
  return run('core-ood.onnx', 'x', 'xr', flat, [n, 3, PATCH, PATCH]);
}

export const cnnAvailable = async () => (await get('lithology-cnn.onnx')) != null;

export const N_CLASSES = N_LITHO;
